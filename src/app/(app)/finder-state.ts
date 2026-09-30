import "server-only";
import { finderState, RUN_COLUMNS, type FinderState } from "@/lib/finder";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** The latest press and run, read as the owner. Errors read as "nothing yet" so the dashboard never breaks on them. */
export async function loadFinderState(supabase: Client): Promise<FinderState> {
  const [{ data: request }, { data: latestRun }] = await Promise.all([
    supabase.from("finder_requests").select("id, requested_at, picked_up_at, run_id").order("requested_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("worker_runs").select(RUN_COLUMNS).eq("dry_run", false).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let requestRun = null;
  if (request?.run_id) {
    requestRun =
      request.run_id === latestRun?.id
        ? latestRun
        : (await supabase.from("worker_runs").select(RUN_COLUMNS).eq("id", request.run_id).maybeSingle()).data;
  }
  return finderState(request ?? null, requestRun, latestRun ?? null, Date.now());
}
