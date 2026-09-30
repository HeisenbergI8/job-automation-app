"use client";

import { useActionState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { adaptIntroForJob, decideIntro, recordIntroSent, tailorApplication } from "./tailoring-actions";

export function TailorButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(tailorApplication.bind(null, jobId), null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Tailoring…" : "Tailor CV and cover letter"}
        </button>
        {pending && <span className="text-sm text-muted">This takes a minute or two.</span>}
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function NewIntroForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(adaptIntroForJob.bind(null, jobId), null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="field">
        <span>What the application asks for <span className="font-normal text-muted">(length, word count, questions)</span></span>
        <textarea name="requirements" rows={3} placeholder="e.g. In under 100 words, why do you want to work here?" required />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div>
        <button className="btn" disabled={pending}>{pending ? "Adapting…" : "Adapt my intro"}</button>
      </div>
    </form>
  );
}

const STATUS_STYLES = {
  pending: "text-warn",
  approved: "text-accent",
  rejected: "text-muted",
};

export function IntroAdaptation({
  adaptation,
  sent,
}: {
  adaptation: Tables<"intro_adaptations">;
  sent: boolean;
}) {
  const [decideState, decideAction, deciding] = useActionState(
    decideIntro.bind(null, adaptation.id, adaptation.job_id),
    null,
  );
  const [sendState, sendAction, sending] = useActionState(
    recordIntroSent.bind(null, adaptation.id, adaptation.job_id),
    null,
  );
  const error = decideState?.error ?? sendState?.error;

  return (
    <div className="rounded-xl border border-border p-4 text-sm">
      <div className="mb-2 flex justify-between gap-3">
        <span className="text-muted">{adaptation.requirements}</span>
        <span className={`shrink-0 font-medium capitalize ${STATUS_STYLES[adaptation.status]}`}>
          {adaptation.status === "pending" ? "Waiting for your OK" : adaptation.status}
        </span>
      </div>
      {adaptation.status === "pending" ? (
        <form action={decideAction} className="flex flex-col gap-2">
          <textarea name="adapted_text" rows={6} defaultValue={adaptation.adapted_text} className="input" />
          <div className="flex gap-2">
            <button name="decision" value="approve" className="btn-primary" disabled={deciding}>Approve</button>
            <button name="decision" value="reject" className="btn" disabled={deciding}>Reject</button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap">{adaptation.adapted_text}</p>
      )}
      {adaptation.status === "approved" && (
        <form action={sendAction} className="mt-2">
          {sent ? (
            <span className="text-muted">Recorded as sent.</span>
          ) : (
            <button className="btn" disabled={sending}>Record as sent for this application</button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}
    </div>
  );
}
