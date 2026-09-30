"use server";

import { isActive, type FinderState } from "@/lib/finder";
import { requireOwner } from "@/lib/supabase/server";
import { loadFinderState } from "./finder-state";

/** The "Find jobs now" button. Pressing again while a run is waiting or going adds nothing. */
export async function requestFinderRun(): Promise<{ state?: FinderState; error?: string }> {
  const supabase = await requireOwner();
  const current = await loadFinderState(supabase);
  if (isActive(current)) return { state: current };

  const { error } = await supabase.from("finder_requests").insert({});
  if (error) return { error: error.message };
  return { state: await loadFinderState(supabase) };
}

/** Polled by the dashboard while a run is waiting or going. */
export async function pollFinder(): Promise<FinderState> {
  return loadFinderState(await requireOwner());
}
