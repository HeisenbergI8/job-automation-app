// ROADMAP stage 5: the daily finder. Reads the company career pages in Settings and, with a JSearch key,
// LinkedIn/Indeed/JobStreet via JSearch, its own search of free job APIs (ownsearch.ts), OnlineJobs.ph's job search and the owner's job-alert emails; skips jobs already saved or already scored; removes duplicates,
// scores, checks the best against their full postings (verify.ts), saves up to 3 that pass as `found`, logs the run in
// worker_runs and tells the owner on Telegram.
//   npm start        hosted project (worker/.env); what the daily schedule runs
//   npm run dev      local stack (worker/.env.local)
//   --dry-run        reads and scores, records board errors, saves no jobs and sends nothing
import { parseMasterCv } from "@/lib/master-cv";
import type { TablesInsert } from "@/lib/supabase/types";
import { readJobAlerts, type AlertEmail } from "./alerts";
import { createServiceClient } from "./db";
import { dedupe, NEW_WITHIN_DAYS, recentOnly } from "./dedupe";
import { batchMessage, needsManualMessage, sendTelegram } from "./notify";
import { claudeCodeScorer, rank, type Ranked } from "./scoring";
import { LOOKUPS_PER_DAY, lookUpPosting, searchJSearch, todaysSearches } from "./jsearch";
import { searchOnlineJobs } from "./onlinejobs";
import { MAX_SEARCHES, searchOwn } from "./ownsearch";
import { fetchBoard, type Posting } from "./sources";
import { toRemember, verifyPicks, type Checked } from "./verify";

const dryRun = process.argv.includes("--dry-run");
const db = createServiceClient();
const send = dryRun ? async (text: string) => (console.log(`[dry run; not sent]\n${text}\n`), false) : sendTelegram;
// Supabase reports errors as plain `{ message, … }` objects, not `Error`s.
// Counted as searches happen, so even a run that fails later records them (option A's daily check).
let jsearchSearches = 0;
let jsearchLookups = 0;
// Set by watch.ts when the owner pressed "Find jobs now", so the app can follow this run.
const requestId = process.env.FINDER_REQUEST_ID?.trim();
let runId: string | undefined;

/** Records what the run is doing now, for the live progress in the app. A failure here never stops the run. */
async function stage(name: "career_pages" | "job_sites" | "onlinejobs" | "emails" | "scoring" | "checking" | "saving" | null) {
  if (!runId) return;
  const { error } = await db.from("worker_runs").update({ stage: name }).eq("id", runId);
  if (error) console.log(`Couldn't record the stage (${name}): ${error.message}`);
}

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
  await stage("career_pages");
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

  // LinkedIn, Indeed, JobStreet and others through JSearch, when the owner has set up a key: on the
  // first run of the day only (owner's option A), so three daily runs fit the free 200 a month. Dry
  // runs skip it too.
  const fromCareerPages = postings.length;
  await stage("job_sites");
  if (process.env.JSEARCH_API_KEY?.trim() && dryRun) console.log("Dry run: JSearch skipped to save your monthly searches.");
  else if (process.env.JSEARCH_API_KEY?.trim() && (await jsearchRanToday())) console.log("JSearch already ran today; career pages only.");
  else if (process.env.JSEARCH_API_KEY?.trim()) {
    for (const search of todaysSearches(settings.data)) {
      jsearchSearches++;
      try {
        const found = await searchJSearch(search, settings.data.remote_preference === "remote");
        console.log(`JSearch "${search.role}" (${search.country}): ${found.length} jobs`);
        postings.push(...found);
      } catch (error) {
        errors.push(`JSearch "${search.role}" (${search.country}): ${message(error)}`);
        if (/limit is used up|refused the key/.test(message(error))) break;
      }
    }
  }

  const fromJSearch = postings.length - fromCareerPages;

  // The finder's own search (worker/jobsearch/jobsearch.py): free job APIs, and LinkedIn, Indeed and
  // Glassdoor too when SCRAPE_JOB_SITES=true. No monthly limit, so every run, dry runs included. A
  // source that fails fails the same way on every search, so each message is reported once.
  const ownErrors = new Set<string>();
  for (const search of todaysSearches(settings.data, new Date(), MAX_SEARCHES)) {
    try {
      const found = await searchOwn(search, settings.data.remote_preference === "remote");
      console.log(`Own search "${search.role}" (${search.country}): ${found.postings.length} jobs`);
      postings.push(...found.postings);
      for (const problem of found.errors) ownErrors.add(`Own search: ${problem}`);
    } catch (error) {
      ownErrors.add(`Own search "${search.role}" (${search.country}): ${message(error)}`);
      if (/isn't installed/.test(message(error))) break;
    }
  }
  errors.push(...ownErrors);
  const fromOwnSearch = postings.length - fromCareerPages - fromJSearch;

  // OnlineJobs.ph: its public job search, one search per target role (its alert emails are read below too).
  await stage("onlinejobs");
  const onlineJobs = await searchOnlineJobs(settings.data.target_roles, errors);
  postings.push(...onlineJobs);

  // The owner's own LinkedIn, JobStreet, Indeed and OnlineJobs.ph job-alert emails, when Gmail is set up. Each email
  // is read once; it's marked as read (processed_emails) after the day's picks are saved.
  let alertEmails: AlertEmail[] = [];
  await stage("emails");
  if (process.env.GMAIL_ADDRESS?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()) {
    const { data: done, error } = await db.from("processed_emails").select("message_id");
    if (error) throw error;
    try {
      alertEmails = await readJobAlerts(new Set(done.map((row) => row.message_id)), errors);
      for (const email of alertEmails) postings.push(...email.postings);
    } catch (error) {
      errors.push(`Gmail: ${message(error)}`);
    }
  }
  console.log(
    `Read ${fromCareerPages} from career pages, ${fromJSearch} from JSearch, ${fromOwnSearch} from the own search, ${onlineJobs.length} from OnlineJobs.ph and ${postings.length - fromCareerPages - fromJSearch - fromOwnSearch - onlineJobs.length} from ${alertEmails.length} new job-alert emails.`,
  );

  // Only jobs posted in the last week, minus saved jobs and jobs Claude already scored.
  const recent = recentOnly(postings);
  console.log(`${recent.length} of them were posted in the last ${NEW_WITHIN_DAYS} days.`);
  const fresh = dedupe(recent, [...saved.data, ...seen.data]);
  await stage("scoring");
  const scorer = process.env.SCORER === "keywords" ? null : claudeCodeScorer(settings.data, parseMasterCv(settings.data.master_cv));
  const { ranked, errors: scoringErrors, unreviewedAlerts } = await rank(fresh, settings.data, scorer);
  const bySite = ranked.reduce<Record<string, number>>((count, job) => ((count[job.site] = (count[job.site] ?? 0) + 1), count), {});
  console.log(`Reviewed ${ranked.length}: ${Object.entries(bySite).map(([site, n]) => `${n} ${site}`).join(", ")}.`);
  errors.push(...scoringErrors);
  if (unreviewedAlerts.length) console.log(`${unreviewedAlerts.length} alert jobs will be reviewed on the next run.`);
  return { fetched: postings.length, fresh: fresh.length, ranked, alertEmails, unreviewedAlerts, criteria: settings.data, scorer };
}

/** Whether a real run already used JSearch today (the Mac's local day). */
async function jsearchRanToday() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("worker_runs")
    .select("id", { count: "exact", head: true })
    .gt("jsearch_searches", 0)
    .gte("started_at", midnight.toISOString());
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** JSearch lookups real runs made today (the Mac's local day), against LOOKUPS_PER_DAY. */
async function lookupsUsedToday() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { data, error } = await db.from("worker_runs").select("jsearch_lookups").gte("started_at", midnight.toISOString());
  if (error) throw error;
  return data.reduce((sum, run) => sum + run.jsearch_lookups, 0);
}

/** Records the jobs that can't be picked on a later run (see `toRemember`), after the picks are saved. */
async function rememberRejected(jobs: Checked[]) {
  const rejected = toRemember(jobs);
  if (!rejected.length) return;
  const { error } = await db.from("seen_postings").upsert(
    rejected.map(({ url, company, role, location, score }) => ({ url, company, role, location, score })),
    { onConflict: "url", ignoreDuplicates: true },
  );
  if (error) throw error;
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
  runId = run.id;
  if (requestId) {
    const { error: linkError } = await db.from("finder_requests").update({ run_id: run.id }).eq("id", requestId);
    if (linkError) console.log(`Couldn't link the run to its request: ${linkError.message}`);
  }
  const errors: string[] = [];

  try {
    const { fetched, fresh, ranked, alertEmails, unreviewedAlerts, criteria, scorer: claude } = await findJobs(errors);
    // Only jobs whose full posting Claude scored PASS_MARK or more (verify.ts). Gmail jobs are looked
    // up on JSearch first, within the day's budget; dry runs make no lookups.
    await stage("checking");
    const canLookUp = !dryRun && Boolean(process.env.JSEARCH_API_KEY?.trim());
    const { picks, jobs, lookups, problems, waiting: waitingForLookup } = await verifyPicks(ranked, {
      scorer: claude,
      lookUp: canLookUp ? (job) => lookUpPosting(job, criteria.locations) : null,
      lookupsLeft: canLookUp ? Math.max(0, LOOKUPS_PER_DAY - (await lookupsUsedToday())) : 0,
    });
    jsearchLookups = lookups;
    errors.push(...problems);
    // An alert email counts as read only once every job in it has been reviewed and, if it was worth
    // a lookup, looked up (or skipped as seen, saved, old or a dealbreaker); otherwise the next run
    // reads it again. Alert emails are read for two days (alerts.ts), so nothing waits for ever.
    const waiting = new Set([...unreviewedAlerts.map((job) => job.url), ...waitingForLookup]);
    const readEmails = alertEmails.filter((email) => !email.postings.some((posting) => waiting.has(posting.url)));
    // A note goes first, so it is the first thing the owner reads, in the app and on Telegram.
    await stage("saving");
    const top = picks.map((job) => (job.note ? { ...job, reasons: [job.note, ...job.reasons] } : job));
    if (!dryRun && top.length) {
      const { error: insertError } = await db
        .from("jobs")
        .upsert(top.map(toJob), { onConflict: "url", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
    if (!dryRun) await rememberRejected(jobs);
    if (!dryRun && readEmails.length) {
      const { error: emailsError } = await db.from("processed_emails").upsert(
        readEmails.map((email) => ({ message_id: email.messageId, site: email.site, jobs_found: email.postings.length })),
        { onConflict: "message_id", ignoreDuplicates: true },
      );
      if (emailsError) throw emailsError;
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
        stage: null,
        scorer,
        fetched,
        new_postings: fresh,
        scored: ranked.length,
        saved: dryRun ? 0 : top.length,
        errors,
        notified,
        jsearch_searches: jsearchSearches,
        jsearch_lookups: jsearchLookups,
      })
      .eq("id", run.id);
    if (logError) throw logError;
    console.log(`Done: ${fetched} read, ${fresh} new, ${dryRun ? 0 : top.length} saved, ${errors.length} problems.`);
  } catch (failure) {
    errors.push(message(failure));
    await db
      .from("worker_runs")
      .update({ finished_at: new Date().toISOString(), ok: false, stage: null, errors, jsearch_searches: jsearchSearches, jsearch_lookups: jsearchLookups })
      .eq("id", run.id);
    await send(`<b>The daily job finder failed.</b>\n${message(failure).replace(/[<>&]/g, "")}`).catch(() => {});
    throw failure;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
