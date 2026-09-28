"use server";

import { revalidatePath } from "next/cache";
import { Constants, type Enums } from "@/lib/supabase/types";
import { requireOwner } from "@/lib/supabase/server";
import type { FormState } from "../actions";

/** ROADMAP 1.6: attach a CV, cover letter or intro sent for this job. */
export async function uploadDocument(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await requireOwner();
  const kind = String(formData.get("kind")) as Enums<"document_kind">;
  const file = formData.get("file");
  if (!Constants.public.Enums.document_kind.includes(kind)) return { error: "Pick a document type." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };

  const storagePath = `${jobId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("application_documents").insert({
    job_id: jobId,
    kind,
    file_name: file.name,
    storage_path: storagePath,
    content_type: file.type || null,
  });
  if (error) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { error: error.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return null;
}
