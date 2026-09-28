"use client";

import { useActionState } from "react";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { changeStatus } from "../actions";

export function StatusControl({ jobId, nextStatuses }: { jobId: string; nextStatuses: JobStatus[] }) {
  const [state, formAction, pending] = useActionState(changeStatus.bind(null, jobId), null);

  if (nextStatuses.length === 0) {
    return <p className="text-sm text-muted">This status is final.</p>;
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="field">
        Move to
        <select name="status" required>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Note <span className="font-normal text-muted">(optional)</span></span>
        <input name="note" placeholder="e.g. Recruiter call booked" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Change status"}</button>
    </form>
  );
}
