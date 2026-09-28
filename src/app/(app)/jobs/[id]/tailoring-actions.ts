"use server";

import { revalidatePath } from "next/cache";
import { cvText, masterCvProblems, parseMasterCv } from "@/lib/master-cv";
import { requireOwner } from "@/lib/supabase/server";
import { keywordScore } from "@/lib/tailoring/ats";
import { adaptIntro, extractKeywords, tailorCv, writeCoverLetter } from "@/lib/tailoring/generate";
import { renderCoverLetterPdf, renderCvPdf } from "@/lib/tailoring/pdf";
import type { FormState } from "../actions";

type Supabase = Awaited<ReturnType<typeof requireOwner>>;

/** Everything tailoring needs, or the reason it can't run yet. */
async function loadContext(supabase: Supabase, jobId: string) {
  const [{ data: job }, { data: settings }] = await Promise.all([
    supabase.from("jobs").select("id, company, role, description, ats_keywords").eq("id", jobId).single(),
    supabase.from("settings").select("master_cv, self_intro").single(),
  ]);
  if (!job) return { error: "Job not found." } as const;
  if (!job.description?.trim()) return { error: "Save the job description first: tailoring works from it." } as const;
  const master = parseMasterCv(settings?.master_cv);
  if (!master || masterCvProblems(master).length) return { error: "Fill in your master CV in Settings first." } as const;

  let keywords = job.ats_keywords;
  if (!keywords) {
    keywords = await extractKeywords(job.description);
    await supabase.from("jobs").update({ ats_keywords: keywords }).eq("id", jobId);
  }
  return { job: { ...job, description: job.description }, master, keywords, intro: settings?.self_intro ?? null };
}

async function storeDocument(
  supabase: Supabase,
  document: { jobId: string; kind: "cv" | "cover_letter" | "intro"; fileName: string; body: Uint8Array | string; contentType: string } & {
    ats_score_before?: number;
    ats_score_after?: number;
    intro_adaptation_id?: string;
  },
) {
  const { jobId, kind, fileName, body, contentType, ...extra } = document;
  const storagePath = `${jobId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, body, { contentType });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from("application_documents").insert({
    job_id: jobId,
    kind,
    file_name: fileName,
    storage_path: storagePath,
    content_type: contentType,
    ...extra,
  });
  if (error) {
    await supabase.storage.from("documents").remove([storagePath]);
    throw new Error(error.message);
  }
}

const fileSlug = (text: string) => text.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/** 4.3–4.5: tailor the CV, write the cover letter, render both and record them on the job. */
export async function tailorApplication(jobId: string): Promise<FormState> {
  const supabase = await requireOwner();
  try {
    const context = await loadContext(supabase, jobId);
    if ("error" in context) return { error: context.error! };
    const { job, master, keywords } = context;

    const [tailored, paragraphs] = await Promise.all([
      tailorCv(master, job, keywords),
      writeCoverLetter(master, job, keywords),
    ]);
    const cv = { ...tailored, name: master.name, contact: master.contact };
    const base = `${fileSlug(master.name)}-${fileSlug(job.company)}`;

    await storeDocument(supabase, {
      jobId,
      kind: "cv",
      fileName: `${base}-CV.pdf`,
      body: await renderCvPdf(cv),
      contentType: "application/pdf",
      ats_score_before: keywordScore(keywords, cvText(master)).score,
      ats_score_after: keywordScore(keywords, cvText(tailored)).score,
    });
    await storeDocument(supabase, {
      jobId,
      kind: "cover_letter",
      fileName: `${base}-Cover-Letter.pdf`,
      body: await renderCoverLetterPdf({ cv, company: job.company, paragraphs, date: new Date() }),
      contentType: "application/pdf",
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/jobs/${jobId}`);
  return null;
}

/** 4.6: adapt the self-intro to what this application asks for. It waits for approval. */
export async function adaptIntroForJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();
  const requirements = String(formData.get("requirements") ?? "").trim();
  if (!requirements) return { error: "Describe what the application asks for." };
  try {
    const context = await loadContext(supabase, jobId);
    if ("error" in context) return { error: context.error! };
    if (!context.intro) return { error: "Write your self-introduction in Settings first." };

    const text = await adaptIntro(context.master, context.intro, context.job, requirements, context.keywords);
    const { error } = await supabase
      .from("intro_adaptations")
      .insert({ job_id: jobId, requirements, adapted_text: text });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/jobs/${jobId}`);
  return null;
}

/** 4.6: approve (with any edits) or reject a pending intro. */
export async function decideIntro(adaptationId: string, jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();
  const approve = formData.get("decision") === "approve";
  const text = String(formData.get("adapted_text") ?? "").trim();
  if (approve && !text) return { error: "The intro is empty." };

  const { error } = await supabase
    .from("intro_adaptations")
    .update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString(), ...(approve && { adapted_text: text }) })
    .eq("id", adaptationId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return null;
}

/** 4.6: record an approved intro as sent. The database refuses one that isn't approved. */
export async function recordIntroSent(adaptationId: string, jobId: string): Promise<FormState> {
  const supabase = await requireOwner();
  const { data: adaptation } = await supabase
    .from("intro_adaptations")
    .select("adapted_text")
    .eq("id", adaptationId)
    .single();
  if (!adaptation) return { error: "Intro not found." };
  try {
    await storeDocument(supabase, {
      jobId,
      kind: "intro",
      fileName: "Intro.txt",
      body: adaptation.adapted_text,
      contentType: "text/plain; charset=utf-8",
      intro_adaptation_id: adaptationId,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/jobs/${jobId}`);
  return null;
}
