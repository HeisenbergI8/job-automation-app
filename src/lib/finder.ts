import type { Tables } from "./supabase/types";

// The "Find jobs now" button (owner request 2026-09-30). The app leaves a finder_requests row; the
// owner's Mac picks it up (worker/src/watch.ts) and starts a run that reports its stage as it goes.

export type FinderRun = Pick<
  Tables<"worker_runs">,
  "id" | "started_at" | "finished_at" | "ok" | "stage" | "fetched" | "new_postings" | "scored" | "saved" | "errors"
>;
export type FinderRequest = Pick<Tables<"finder_requests">, "id" | "requested_at" | "picked_up_at" | "run_id">;

export const RUN_COLUMNS = "id, started_at, finished_at, ok, stage, fetched, new_postings, scored, saved, errors";

/** The run's steps, in order, as worker/src/run.ts reports them. */
export const STAGES = [
  { id: "career_pages", label: "Reading company career pages" },
  { id: "job_sites", label: "Searching LinkedIn, Indeed and JobStreet" },
  { id: "onlinejobs", label: "Searching OnlineJobs.ph" },
  { id: "emails", label: "Reading your job-alert emails" },
  { id: "scoring", label: "Scoring new jobs against your CV" },
  { id: "checking", label: "Checking the best against their full postings" },
  { id: "saving", label: "Saving the best matches" },
  { id: "outreach", label: "Finding people to email and drafting emails" },
] as const;

// The Mac checks every 30 seconds; past this, it is probably asleep or the check isn't installed.
export const MAC_SLOW_AFTER_MS = 90_000;
// A run still marked as running after this long crashed without saying so (as in watch.ts).
export const STALE_RUN_MS = 45 * 60_000;
// How long a finished run is shown as the result of the last press.
export const RESULT_FOR_MS = 15 * 60_000;

export type FinderState =
  | { kind: "idle"; lastRun: FinderRun | null }
  | { kind: "waiting"; since: string; slow: boolean }
  | { kind: "starting"; since: string }
  | { kind: "running"; run: FinderRun }
  | { kind: "done"; run: FinderRun }
  | { kind: "failed"; run: FinderRun };

/**
 * What the finder is doing now. `latestRun` is the most recent run, scheduled or requested;
 * `requestRun` is the run linked to the latest request, when there is one.
 */
export function finderState(
  request: FinderRequest | null,
  requestRun: FinderRun | null,
  latestRun: FinderRun | null,
  now: number,
): FinderState {
  const age = (time: string) => now - new Date(time).getTime();
  const live = (run: FinderRun | null) => run != null && run.ok === null && age(run.started_at) < STALE_RUN_MS;

  if (request && !request.picked_up_at) {
    return { kind: "waiting", since: request.requested_at, slow: age(request.requested_at) > MAC_SLOW_AFTER_MS };
  }
  if (request && !request.run_id && age(request.picked_up_at ?? request.requested_at) < 2 * 60_000) {
    return { kind: "starting", since: request.picked_up_at ?? request.requested_at };
  }
  // A scheduled run in progress shows too, even without a press.
  const current = live(requestRun) ? requestRun : live(latestRun) ? latestRun : null;
  if (current) return { kind: "running", run: current };

  const result = request ? requestRun : null;
  if (result?.finished_at && age(result.finished_at) < RESULT_FOR_MS) {
    return result.ok ? { kind: "done", run: result } : { kind: "failed", run: result };
  }
  return { kind: "idle", lastRun: latestRun?.finished_at ? latestRun : null };
}

export const isActive = (state: FinderState) => state.kind === "waiting" || state.kind === "starting" || state.kind === "running";
