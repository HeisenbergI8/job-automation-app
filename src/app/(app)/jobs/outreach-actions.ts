"use server";

import { revalidatePath } from "next/cache";
import { isBusy, requestState, type RequestState } from "@/lib/outreach";
import { requireOwner } from "@/lib/supabase/server";

export type OutreachResult = { error?: string; state?: RequestState };
type Client = Awaited<ReturnType<typeof requireOwner>>;

const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** The Send button was clicked and Gmail is opening. Only a draft moves; opening it again changes nothing. */
export async function markOpened(emailId: string): Promise<OutreachResult> {
  if (!isId(emailId)) return { error: "Unknown email." };
  const supabase = await requireOwner();
  const { error } = await supabase.from("outreach_emails").update({ status: "opened" }).eq("id", emailId).eq("status", "draft");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/**
 * "I sent it": the database stamps sent_at, and the job page's timeline shows it (owner decision D1).
 * The job's status is not changed (owner decision D11).
 */
export async function markSent(emailId: string): Promise<OutreachResult> {
  if (!isId(emailId)) return { error: "Unknown email." };
  const supabase = await requireOwner();
  const { error } = await supabase.from("outreach_emails").update({ status: "sent" }).eq("id", emailId).in("status", ["draft", "opened"]);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

async function latestState(supabase: Client, jobId: string) {
  const { data } = await supabase
    .from("outreach_requests")
    .select("id, kind, requested_at, picked_up_at, finished_at, error")
    .eq("job_id", jobId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return requestState(data ?? null, Date.now());
}

/** "Find people" or "Use this person": a request for the owner's Mac. Pressing again while one is waiting adds nothing. */
export async function requestOutreach(jobId: string, contactId: string | null): Promise<OutreachResult> {
  if (!isId(jobId) || (contactId != null && !isId(contactId))) return { error: "Unknown job or contact." };
  const supabase = await requireOwner();
  const current = await latestState(supabase, jobId);
  if (isBusy(current)) return { state: current };
  const { error } = await supabase
    .from("outreach_requests")
    .insert({ job_id: jobId, kind: contactId ? "redraft" : "find_people", contact_id: contactId });
  if (error) return { error: error.message };
  return { state: await latestState(supabase, jobId) };
}

/** Polled while a request is waiting or being worked on. */
export async function pollOutreach(jobId: string): Promise<RequestState> {
  if (!isId(jobId)) return { kind: "none" };
  return latestState(await requireOwner(), jobId);
}
