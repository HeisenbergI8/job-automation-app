// Starts the finder when the owner presses "Find jobs now" in the app. launchd runs this every 30
// seconds (npm run schedule); it exits at once when nothing is waiting. launchd never starts it again
// while it is still running, so a run in progress holds back the next check.
//   npm run watch    check once, against the hosted project (worker/.env)
// FINDER_RUN_SCRIPT picks the npm script it starts (default "start"). To try it on the local stack
// without saving or sending anything:
//   FINDER_RUN_SCRIPT="dev -- --dry-run" npx tsx --env-file=.env.local src/watch.ts
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { createServiceClient } from "./db";

const db = createServiceClient();
// A run still marked as running after this long crashed without saying so.
const STALE_MINUTES = 45;
const WORKER = join(import.meta.dirname, "..");

async function main() {
  const { data: waiting, error } = await db
    .from("finder_requests")
    .select("id")
    .is("picked_up_at", null)
    .order("requested_at");
  if (error) throw error;
  if (!waiting.length) return;

  // Claim every waiting request at once: several presses while the Mac was asleep make one run.
  const { data: claimed, error: claimError } = await db
    .from("finder_requests")
    .update({ picked_up_at: new Date().toISOString() })
    .in("id", waiting.map((request) => request.id))
    .is("picked_up_at", null)
    .select("id, requested_at")
    .order("requested_at");
  if (claimError) throw claimError;
  if (!claimed.length) return;
  const ids = claimed.map((request) => request.id);

  // A run already under way, such as a scheduled one: the app follows that run instead of a second one.
  const { data: running, error: runningError } = await db
    .from("worker_runs")
    .select("id")
    .is("ok", null)
    .gte("started_at", new Date(Date.now() - STALE_MINUTES * 60_000).toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runningError) throw runningError;
  if (running) {
    const { error: linkError } = await db.from("finder_requests").update({ run_id: running.id }).in("id", ids);
    if (linkError) throw linkError;
    console.log(`${new Date().toISOString()} Find jobs now: a run is already going, so it follows that one.`);
    return;
  }

  console.log(`${new Date().toISOString()} Find jobs now: starting a run.`);
  // The run writes to the same log as the scheduled runs.
  mkdirSync(join(WORKER, "logs"), { recursive: true });
  const log = openSync(join(WORKER, "logs", "finder.log"), "a");
  const script = (process.env.FINDER_RUN_SCRIPT?.trim() || "start").split(/\s+/);
  const child = spawn("npm", ["run", "--silent", ...script], {
    cwd: WORKER,
    env: { ...process.env, FINDER_REQUEST_ID: ids.at(-1) },
    stdio: ["ignore", log, log],
  });
  const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
  console.log(`${new Date().toISOString()} Find jobs now: the run ended (exit code ${code}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
