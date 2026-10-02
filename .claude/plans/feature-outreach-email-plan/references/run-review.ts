// Review of worker/src/run.ts (318 lines). The daily pipeline: find, score, verify, save up to 3 as
// `found`, log the run in worker_runs, send the Telegram batch. Stage 7 adds an "outreach" stage after
// saving and before the Telegram message.

// NOTE: module-level counters, written in BOTH the success and the failure update, so a failed run
// still records the quota it used. Stage 7 adds `hunterLookups` the same way.
let jsearchSearches = 0;
let jsearchLookups = 0;

// IMPORTANT: the stage names are a written-out union; "outreach" must be added here and to STAGES in
// src/lib/finder.ts (the dashboard's live progress).
async function stage(name: "career_pages" | "job_sites" | "onlinejobs" | "emails" | "scoring" | "checking" | "saving" | null) {
  /* updates worker_runs.stage */
}

// In main(), after verifyPicks:
//     await stage("saving");
//     const top = picks.map(...);
//     if (!dryRun && top.length) {
//       const { error: insertError } = await db
//         .from("jobs")
//         .upsert(top.map(toJob), { onConflict: "url", ignoreDuplicates: true });
//       if (insertError) throw insertError;
//     }
// IMPORTANT: no .select(), so the run never learns the new jobs' ids. Stage 7 needs them (contacts and
// drafts reference jobs.id). Adding .select("id, company, role, description") returns only the inserted
// rows under ignoreDuplicates. QUESTION: believed correct for PostgREST's resolution=ignore-duplicates;
// not run in the planning sandbox (no local stack). Checked in plan Step 8.1.

//     if (!dryRun) await rememberRejected(jobs);
//     ... processed_emails upsert ...
//     const notified = await send(batchMessage(top, errors, fresh));
// NOTE: outreach goes right before this line, so the Telegram message can count ready emails.

// NOTE: `criteria` returned from findJobs is the full settings row (select("*")), so master_cv is
// available; parseMasterCv is already imported here.

// NOTE: dry runs skip JSearch "to save your monthly searches"; stage 7 skips Hunter and drafting likewise.
