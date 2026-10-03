"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Mail, Search } from "lucide-react";
import { composeLink, isBusy, type OutreachEmail, type RequestState } from "@/lib/outreach";
import { markOpened, pollOutreach, requestOutreach } from "./outreach-actions";

const POLL_MS = 3000;
const noSubscribe = () => () => {};
const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/** A "Find people" / "Use this person" request and its waiting state, shared by the button and the job page. */
export function useOutreachRequest(jobId: string, initial: RequestState) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pressing, startPress] = useTransition();
  const busy = isBusy(state);
  const wasBusy = useRef(busy);

  useEffect(() => {
    if (!busy) return;
    const poll = setInterval(async () => {
      try {
        setState(await pollOutreach(jobId));
      } catch {
        // A missed check is retried on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [busy, jobId]);

  // The Mac finished: reload so the new contacts and draft appear.
  useEffect(() => {
    if (wasBusy.current && !busy) router.refresh();
    wasBusy.current = busy;
  }, [busy, router]);

  const request = (contactId: string | null) =>
    startPress(async () => {
      setError(null);
      const result = await requestOutreach(jobId, contactId);
      if (result.error) setError(`Couldn't ask your Mac: ${result.error}`);
      if (result.state) setState(result.state);
    });

  return { state, error, busy: busy || pressing, request };
}

/** What the Mac is doing, in a line. */
export function RequestStatus({ state, error }: { state: RequestState; error: string | null }) {
  const text =
    error ??
    (state.kind === "waiting"
      ? state.slow
        ? "Waiting for your Mac. It may be asleep, or busy with a job search; this starts once it checks in."
        : "Sent to your Mac. It checks every 30 seconds."
      : state.kind === "working"
        ? "Your Mac is reading the posting and looking for people. This takes a minute or two."
        : state.kind === "failed"
          ? state.error
          : null);
  if (!text) return null;
  const bad = error != null || state.kind === "failed";
  return <p role="status" aria-live="polite" className={`text-xs ${bad ? "text-danger" : "text-muted"}`}>{text}</p>;
}

type Props = {
  jobId: string;
  email: Pick<OutreachEmail, "id" | "to_email" | "subject" | "body" | "status"> | null;
  request: RequestState;
  label?: string;
};

/** ROADMAP 7.4: opens the draft in Gmail's compose page. The owner presses Send there; the app never sends. */
export function SendEmailButton({ jobId, email, request, label = "Send email" }: Props) {
  const apple = useSyncExternalStore(noSubscribe, isAppleMobile, () => false);
  const { state, error, busy, request: ask } = useOutreachRequest(jobId, request);

  if (email) {
    if (email.status === "sent") return <span className="text-xs text-muted">Sent</span>;
    const link = composeLink(email, apple ? "mailto" : "gmail");
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        onClick={() => void markOpened(email.id)}
        className="btn-primary whitespace-nowrap"
        title={`To ${email.to_email}`}
      >
        <Mail className="size-4" aria-hidden="true" />
        {email.status === "opened" ? "Open again" : label}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled className="btn whitespace-nowrap opacity-60" title="No real email address found for this job">
          <Mail className="size-4" aria-hidden="true" />
          No email found
        </button>
        <button type="button" onClick={() => ask(null)} disabled={busy} className="text-sm font-medium text-accent hover:underline disabled:opacity-60">
          <Search className="mr-1 inline size-3.5" aria-hidden="true" />
          {busy ? "Finding people…" : "Find people"}
        </button>
      </div>
      <RequestStatus state={state} error={error} />
    </div>
  );
}
