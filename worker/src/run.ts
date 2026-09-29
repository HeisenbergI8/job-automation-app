// ROADMAP stage 5: the daily finder. Reads the company career pages in Settings and, with a JSearch key,
// LinkedIn/Indeed/JobStreet via JSearch; skips jobs already saved or already scored; removes duplicates,
// scores, saves up to 3 jobs scoring MIN_FIT or more as `found`, logs the run in worker_runs and tells the owner on Telegram.
//   npm start        hosted project (worker/.env); what the daily schedule runs
//   npm run dev      local stack (worker/.env.local)
//   --dry-run        reads and scores, records board errors, saves no jobs and sends nothing
import { parseMasterCv } from "@/lib/master-cv";
import type { TablesInsert } from "@/lib/supabase/types";
import { createServiceClient } from "./db";
import { dedupe } from "./dedupe";
import { batchMessage, needsManualMessage, sendTelegram } from "./notify";
import { claudeCodeScorer, pickTop, rank, type Ranked } from "./scoring";
import { searchJSearch, todaysSearches } from "./jsearch";
import { fetchBoard, type Posting } from "./sources";

const dryRun = process.argv.includes("--dry-run");
const db = createServiceClient();
const send = dryRun ? async (text: string) => (console.log(`[dry run; not sent]\n${text}\n`), false) : sendTelegram;
// Supabase reports errors as plain `{ message, … }` objects, not `Error`s.
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : String(error);

function toJob(job: Ranked): TablesInsert<"jobs"> {
  return {
    site: job.site,
    url: job.url,
    company: job.company,
    role: job.role,
    location: job.location,
    description: job.description,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    salary_raw: job.salary_raw,
    fit_score: job.score,
    fit_reasons: job.reasons,
    // No status: new jobs start as `found` (the jobs_guard_status trigger enforces it).
  };
}

async function findJobs(errors: string[]) {
  const [settings, boards, saved, seen] = await Promise.all([
    db.from("settings").select("*").single(),
    db.from("career_boards").select("*").order("created_at"),
    db.from("jobs").select("url, company, role, location"),
    db.from("seen_postings").select("url, company, role, location"),
  ]);
  if (settings.error) throw settings.error;
  if (boards.error) throw boards.error;
  if (saved.error) throw saved.error;
  if (seen.error) throw seen.error;
  if (!boards.data.length) errors.push("No company career pages in Settings yet.");

  const postings: Posting[] = [];
  for (const board of boards.data) {
    let lastError: string | null = null;
    try {
      postings.push(...(await fetchBoard(board)));
    } catch (error) {
      lastError = message(error);
      errors.push(`${board.company ?? board.slug} (${board.ats}): ${lastError}`);
    }
    const { error } = await db
      .from("career_boards")
      .update({ last_checked_at: new Date().toISOString(), last_error: lastError })
      .eq("id", board.id);
    if (error) throw error;
  }

  // LinkedIn, Indeed, JobStreet and others through JSearch, when the owner has set up a key.
  if (process.env.JSEARCH_API_KEY?.trim()) {
    for (const search of todaysSearches(settings.data)) {
      try {
        postings.push(...(await searchJSearch(search, settings.data.remote_preference === "remote")));
      } catch (error) {
        errors.push(`JSearch "${search.role}" (${search.country}): ${message(error)}`);
        if (/limit is used up|refused the key/.test(message(error))) break;
      }
    }
  }

  // Saved jobs and jobs Claude already scored are skipped, so each run reviews jobs it hasn't seen.
  const fresh = dedupe(postings, [...saved.data, ...seen.data]);
  const scorer = process.env.SCORER === "keywords" ? null : claudeCodeScorer(settings.data, parseMasterCv(settings.data.master_cv));
  const { ranked, errors: scoringErrors } = await rank(fresh, settings.data, scorer);
  errors.push(...scoringErrors);

  // Remember what Claude scored (a keyword-only score is retried on a later run).
  const reviewed = ranked.filter((job) => job.scoredBy === "claude-code");
  if (!dryRun && reviewed.length) {
    const { error } = await db.from("seen_postings").upsert(
      reviewed.map(({ url, company, role, location, score }) => ({ url, company, role, location, score })),
      { onConflict: "url", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  return { fetched: postings.length, fresh: fresh.length, ranked };
}

async function notifyNeedsManual(until: string) {
  const { data: last, error: lastError } = await db
    .from("worker_runs")
    .select("finished_at")
    .eq("ok", true)
    .eq("dry_run", false)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;
  const since = last?.finished_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await db
    .from("job_status_events")
    .select("note, jobs(company, role, url)")
    .eq("to_status", "needs_manual")
    .gt("changed_at", since)
    .lte("changed_at", until);
  if (error) throw error;
  for (const event of events) {
    if (event.jobs) await send(needsManualMessage(event.jobs, event.note));
  }
}

async function main() {
  const { data: run, error } = await db.from("worker_runs").insert({ dry_run: dryRun }).select("id").single();
  if (error) {
    // No run row can be written (database unreachable, wrong URL or key), so Telegram is the only
    // way the owner hears about it.
    await send(`<b>The daily job finder couldn't start.</b>\n${message(error).replace(/[<>&]/g, "")}\nCheck worker/.env and worker/logs/finder.log.`).catch(() => {});
    throw error;
  }
  const errors: string[] = [];

  try {
    const { fetched, fresh, ranked } = await findJobs(errors);
    // 0–3 jobs: only those scoring MIN_FIT or more. A note (e.g. a link that won't open) goes first,
    // so it is the first thing the owner reads, in the app and on Telegram.
    const top = pickTop(ranked).map((job) => (job.note ? { ...job, reasons: [job.note, ...job.reasons] } : job));
    if (!dryRun && top.length) {
      const { error: insertError } = await db
        .from("jobs")
        .upsert(top.map(toJob), { onConflict: "url", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }

    const notified = await send(batchMessage(top, errors, fresh));
    const until = new Date().toISOString();
    if (!dryRun) await notifyNeedsManual(until);

    const scorer = [...new Set(ranked.map((job) => job.scoredBy))].sort().join("+") || null;
    const { error: logError } = await db
      .from("worker_runs")
      .update({
        finished_at: until,
        ok: true,
        scorer,
        fetched,
        new_postings: fresh,
        scored: ranked.length,
        saved: dryRun ? 0 : top.length,
        errors,
        notified,
      })
      .eq("id", run.id);
    if (logError) throw logError;
    console.log(`Done: ${fetched} read, ${fresh} new, ${dryRun ? 0 : top.length} saved, ${errors.length} problems.`);
  } catch (failure) {
    errors.push(message(failure));
    await db.from("worker_runs").update({ finished_at: new Date().toISOString(), ok: false, errors }).eq("id", run.id);
    await send(`<b>The daily job finder failed.</b>\n${message(failure).replace(/[<>&]/g, "")}`).catch(() => {});
    throw failure;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
