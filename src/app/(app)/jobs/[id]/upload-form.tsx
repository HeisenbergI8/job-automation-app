"use client";

import { useActionState } from "react";
import { uploadDocument } from "./document-actions";

export function UploadForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(uploadDocument.bind(null, jobId), null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="field">
        Type
        <select name="kind">
          <option value="cv">CV</option>
          <option value="cover_letter">Cover letter</option>
          <option value="intro">Intro</option>
        </select>
      </label>
      <label className="field max-w-full">
        <span>File <span className="font-normal text-muted">(up to 4MB)</span></span>
        <input name="file" type="file" required className="min-w-0 max-w-full" />
      </label>
      <button className="btn" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
