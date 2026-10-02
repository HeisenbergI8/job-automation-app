// Review of worker/src/watch.ts (73 lines). launchd runs it every 30 seconds; it starts a finder run
// when the owner pressed "Find jobs now" (finder_requests). Stage 7 adds outreach requests in front.

// IMPORTANT: it claims EVERY waiting finder_requests row at once and starts a full run, so a "kind"
// column on finder_requests would have every "Find people" press start a job search. Hence a separate
// outreach_requests table.
const { data: claimed } = await db
  .from("finder_requests")
  .update({ picked_up_at: new Date().toISOString() })
  .in("id", waiting.map((request) => request.id))
  .is("picked_up_at", null) // NOTE: the claim guard that makes a request run once; reused for outreach
  .select("id, requested_at");

// IMPORTANT: it waits for the run to end. Per the header comment, "launchd never starts it again while
// it is still running", so a requested run blocks the next check, and outreach requests wait behind it.
const child = spawn("npm", ["run", "--silent", ...script], { cwd: WORKER, env: { ...process.env, FINDER_REQUEST_ID: ids.at(-1) } });
const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));

// NOTE: local testing without saving: FINDER_RUN_SCRIPT="dev -- --dry-run" npx tsx --env-file=.env.local src/watch.ts
