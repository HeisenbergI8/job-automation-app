"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteJob } from "../actions";

/** Deleting takes two clicks: the first asks, the second deletes. It can't be undone. */
export function DeleteJob({ jobId, company }: { jobId: string; company: string }) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(deleteJob.bind(null, jobId), null);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Delete job
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm" role="alert">
        Delete this {company} job, its status history and its documents? This can&apos;t be undone.
        {state?.error && <span className="mt-1 block text-danger">{state.error}</span>}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => setAsking(false)} disabled={pending}>Cancel</button>
        <button className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-background shadow-rest disabled:opacity-50" disabled={pending}>
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </form>
  );
}
