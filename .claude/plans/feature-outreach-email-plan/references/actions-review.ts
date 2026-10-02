// Review of src/app/(app)/jobs/actions.ts (116 lines). The pattern for outreach-actions.ts: "use server",
// requireOwner(), validate, write, revalidatePath("/", "layout"), return { error } (or null).

export type FormState = { error: string } | null;

export async function changeStatus(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();
  const to = String(formData.get("status")) as JobStatus;
  if (!JOB_STATUSES.includes(to)) return { error: "Unknown status." };
  // IMPORTANT: the only way the app changes a job's status. Stage 7's "I sent it" does NOT call it
  // (open decision D11): an outreach email is not an application.
  const { error } = await supabase.rpc("set_job_status", { p_job_id: jobId, p_to: to, p_note: /* ... */ undefined });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return null;
}

// NOTE: deleteJob relies on `on delete cascade` for child rows. Stage 7's tables cascade from jobs too,
// and referential actions run as the table owner, so the owner's missing DELETE on them doesn't block it.
export async function deleteJob(jobId: string): Promise<FormState> {
  /* removes Storage files, then supabase.from("jobs").delete().eq("id", jobId) */
}
