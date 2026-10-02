// Owner's rule (2026-09-30): a job reaches the owner only after Claude has read its full posting and
// scored it PASS_MARK or more. Career pages, OnlineJobs.ph and JSearch searches carry the full
// posting already. A Gmail alert carries a title and a line or two, so before one can be picked its
// full posting is looked up on JSearch (the finder doesn't open LinkedIn or JobStreet for this) and
// Claude scores it again from that. One not found there is never sent.
import { TOP, type Ranked, type Scorer } from "./scoring";

export const PASS_MARK = 70;
/** A Gmail job's email-based score must reach this to be worth one of the day's few lookups. */
export const LOOK_UP_FROM = 50;

export type Checked = Ranked & {
  /** A Gmail job whose full posting was found and scored. */
  fullPostingChecked?: boolean;
  /** A Gmail job JSearch had no posting for: never sent, and remembered so it isn't looked up again. */
  notFound?: boolean;
};

export type LookUp = (job: Ranked) => Promise<{ description: string } | null>;

/**
 * Walks `ranked` (best first) until TOP jobs pass or the candidates run out, spending at most
 * `lookupsLeft` lookups on Gmail jobs. Returns the picks (best first), every job with its final
 * score, how many lookups were made, and problems worth telling the owner.
 */
export async function verifyPicks(
  ranked: Ranked[],
  { scorer, lookUp, lookupsLeft }: { scorer: Scorer | null; lookUp: LookUp | null; lookupsLeft: number },
) {
  const jobs: Checked[] = [...ranked];
  const picks: Checked[] = [];
  const problems: string[] = [];
  let left = lookupsLeft;
  let lookups = 0;
  let skipped = 0;
  // Gmail jobs worth a lookup that didn't get a full check this run. Their emails stay unread
  // (run.ts), so a later run with lookups left sees them again.
  const waiting: string[] = [];

  for (let index = 0; index < jobs.length && picks.length < TOP; index++) {
    const job = jobs[index];
    if (job.eligible === false) continue;

    if (!job.fromAlert) {
      // A keyword-only score means Claude never read it, so it can't have passed.
      if (job.scoredBy === "claude-code" && job.score >= PASS_MARK) picks.push(job);
      continue;
    }

    if (job.score < LOOK_UP_FROM) continue;
    if (!scorer || !lookUp || lookups >= left) {
      skipped++;
      waiting.push(job.url);
      continue;
    }

    lookups++;
    let full: { description: string } | null;
    try {
      full = await lookUp(job);
    } catch (error) {
      problems.push(`Couldn't look up "${job.role}" at ${job.company} on JSearch: ${(error as Error).message}`);
      waiting.push(job.url);
      if (/limit is used up|refused the key/.test((error as Error).message)) left = lookups;
      continue;
    }
    if (!full?.description) {
      jobs[index] = { ...job, notFound: true };
      continue;
    }

    try {
      const fit = await scorer({ ...job, description: full.description });
      const checked: Checked = { ...job, ...fit, description: full.description, scoredBy: "claude-code", fullPostingChecked: true };
      jobs[index] = checked;
      if (checked.eligible !== false && checked.score >= PASS_MARK) picks.push(checked);
    } catch (error) {
      problems.push(`Couldn't score the full posting of "${job.role}" at ${job.company}: ${(error as Error).message}`);
      waiting.push(job.url);
    }
  }

  if (skipped) {
    problems.push(
      !lookUp
        ? `${skipped} Gmail ${skipped === 1 ? "job wasn't" : "jobs weren't"} checked: JSearch isn't available on this run.`
        : `${skipped} Gmail ${skipped === 1 ? "job wasn't" : "jobs weren't"} checked: today's ${lookupsLeft} JSearch lookups are used up.`,
    );
  }
  return { picks: picks.sort((a, b) => b.score - a.score), jobs, lookups, problems, waiting };
}

/**
 * Jobs to remember as reviewed, so later runs skip them: any Claude found ineligible; any it scored
 * from the full posting below PASS_MARK, since those can never be sent; Gmail jobs it scored from the
 * email below LOOK_UP_FROM; and Gmail jobs JSearch couldn't find. A keyword-only score, or a Gmail job
 * worth a lookup that didn't get one today, stays in the running.
 */
export function toRemember(jobs: Checked[]) {
  return jobs.filter((job) => {
    if (job.notFound) return true;
    if (job.scoredBy !== "claude-code") return false;
    if (job.eligible === false) return true;
    const fullText = !job.fromAlert || job.fullPostingChecked;
    return job.score < (fullText ? PASS_MARK : LOOK_UP_FROM);
  });
}
