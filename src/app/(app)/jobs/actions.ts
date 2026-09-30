"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";

export type FormState = { error: string } | null;

/**
 * The one way the web app changes a job's status (ROADMAP 1.2). The move is validated, the job
 * updated and the event row written together by the database's set_job_status().
 */
export async function changeStatus(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();
  const to = String(formData.get("status")) as JobStatus;
  if (!JOB_STATUSES.includes(to)) return { error: "Unknown status." };

  const { error } = await supabase.rpc("set_job_status", {
    p_job_id: jobId,
    p_to: to,
    p_note: String(formData.get("note") ?? "").trim() || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return null;
}

/**
 * Deletes a job for good. Its status history, document records and intro adaptations go with it
 * (on delete cascade); the uploaded files are removed from Storage first, since nothing cascades
 * there. The finder remembers every posting it scored in seen_postings, so it won't add it again.
 */
export async function deleteJob(jobId: string): Promise<FormState> {
  const supabase = await requireOwner();

  // Read first and stop on failure: once the job is gone, so are the paths of its files.
  const { data: documents, error: documentsError } = await supabase.from("application_documents").select("storage_path").eq("job_id", jobId);
  if (documentsError) return { error: documentsError.message };
  if (documents.length) {
    const { error } = await supabase.storage.from("documents").remove(documents.map((doc) => doc.storage_path));
    if (error) return { error: `The job's files couldn't be removed: ${error.message}` };
  }

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/jobs");
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/,/g, "");
  return text ? Number(text) : null;
}

function optionalText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || null;
}

/** ROADMAP 1.5: add a job by pasting its link. It starts as `found`. */
export async function addJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();

  let url: URL;
  try {
    url = new URL(String(formData.get("url")).trim());
  } catch {
    return { error: "Paste a full link, starting with https://" };
  }

  const salaryMin = optionalNumber(formData.get("salary_min"));
  const salaryMax = optionalNumber(formData.get("salary_max"));
  if ([salaryMin, salaryMax].some((value) => value != null && Number.isNaN(value))) {
    return { error: "Salary must be a number." };
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      url: url.toString(),
      site: optionalText(formData.get("site")) ?? siteFromUrl(url),
      company: String(formData.get("company")).trim(),
      role: String(formData.get("role")).trim(),
      location: optionalText(formData.get("location")),
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: optionalText(formData.get("salary_currency"))?.toUpperCase(),
      salary_raw: optionalText(formData.get("salary_raw")),
      description: optionalText(formData.get("description")),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.code === "23505" ? "That link is already saved." : error.message };
  }
  revalidatePath("/", "layout");
  redirect(`/jobs/${data.id}`);
}

const KNOWN_SITES: Record<string, string> = {
  "greenhouse.io": "greenhouse",
  "lever.co": "lever",
  "ashbyhq.com": "ashby",
  "linkedin.com": "linkedin",
  "indeed.com": "indeed",
  "jobstreet.com": "jobstreet",
};

function siteFromUrl(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  const known = Object.entries(KNOWN_SITES).find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return known ? known[1] : host;
}
