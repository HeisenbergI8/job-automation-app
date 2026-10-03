"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { contactLabel, type OutreachEmail, type RequestState } from "@/lib/outreach";
import type { Tables } from "@/lib/supabase/types";
import { markSent } from "../outreach-actions";
import { RequestStatus, SendEmailButton, useOutreachRequest } from "../send-email-button";

type Contact = Pick<Tables<"job_contacts">, "id" | "name" | "title" | "email" | "source" | "confidence" | "rank">;
type Email = Pick<OutreachEmail, "id" | "kind" | "to_email" | "to_name" | "subject" | "body" | "status" | "sent_at"> & { contact_id: string | null };

function ContactLine({ contact }: { contact: Contact }) {
  return (
    <div className="text-sm">
      <div className="font-medium">{contact.name}{contact.title && <span className="font-normal text-muted"> · {contact.title}</span>}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="break-all">{contact.email}</span>
        <span className="chip">{contactLabel(contact.source, contact.confidence)}</span>
      </div>
    </div>
  );
}

function SentControl({ email }: { email: Email }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (email.status === "sent") {
    return <p className="text-sm text-muted">Sent {new Date(email.sent_at!).toLocaleDateString("en", { dateStyle: "medium" })}. It&apos;s on the timeline.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const result = await markSent(email.id);
          if (result.error) setError(result.error);
          else router.refresh();
        })}
        className="btn self-start"
      >
        {pending ? "Saving…" : "I sent it"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** ROADMAP 7.4 / 7.5: who the email is to, the draft, Send, "I sent it", another contact, the follow-up. */
export function OutreachPanel({ jobId, contacts, first, followUp, request }: {
  jobId: string; contacts: Contact[]; first: Email | null; followUp: Email | null; request: RequestState;
}) {
  const { state, error, busy, request: ask } = useOutreachRequest(jobId, request);
  const to = contacts.find((contact) => contact.id === first?.contact_id);
  const others = contacts.filter((contact) => contact.id !== first?.contact_id);

  if (!first) return <SendEmailButton jobId={jobId} email={null} request={request} />;

  return (
    <div className="flex flex-col gap-4">
      {to ? <ContactLine contact={to} /> : <p className="text-sm">To {first.to_name ?? first.to_email}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-foreground">Read the draft: {first.subject}</summary>
        <p className="mt-2 whitespace-pre-wrap leading-6">{first.body}</p>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <SendEmailButton jobId={jobId} email={first} request={request} />
        <SentControl email={first} />
      </div>
      <p className="text-xs text-muted">Gmail opens with everything filled in. Change anything you like, then press Send there.</p>

      {first.status !== "sent" && others.length > 0 && (
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-semibold text-muted uppercase">Or write to</h3>
          {others.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between gap-3">
              <ContactLine contact={contact} />
              <button type="button" disabled={busy} onClick={() => ask(contact.id)} className="shrink-0 text-sm font-medium text-accent hover:underline disabled:opacity-60">
                {busy ? "Redrafting…" : "Use this person"}
              </button>
            </div>
          ))}
          <RequestStatus state={state} error={error} />
        </div>
      )}

      {followUp && (
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold">Follow-up</h3>
          <p className="mb-2 text-xs text-muted">No reply after 5 days. Or reply in the first email&apos;s Gmail thread and paste this.</p>
          <div className="flex flex-wrap items-center gap-3">
            <SendEmailButton jobId={jobId} email={followUp} request={request} label="Send follow-up" />
            <SentControl email={followUp} />
          </div>
        </div>
      )}
    </div>
  );
}
