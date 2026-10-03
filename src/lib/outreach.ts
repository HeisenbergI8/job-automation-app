// ROADMAP stage 7: outreach emails, sent by the owner. The app never sends an email: it builds a link
// to Gmail's compose page and records what the owner did. Pure, so the web app, the worker and the
// tests share it.
import { MAC_SLOW_AFTER_MS } from "@/lib/finder";
import { STATUS_LABELS, type StatusEvent } from "@/lib/jobs";
import type { MasterCv } from "@/lib/master-cv";
import type { Enums, Tables } from "@/lib/supabase/types";
import { findTextInventions } from "@/lib/tailoring/check";

export type OutreachEmail = Pick<
  Tables<"outreach_emails">,
  "id" | "kind" | "to_email" | "to_name" | "subject" | "body" | "status" | "opened_at" | "sent_at"
>;
export type ContactSource = Enums<"contact_source">;
export type Draft = { subject: string; body: string };

/** Owner, 2026-10-02. The view outreach_follow_ups_due uses the same number. */
export const FOLLOW_UP_AFTER_DAYS = 5;

// Owner decision D8: the owner's format. Step 8.3 has the owner try it and `?tf=cm` once.
export const GMAIL_COMPOSE = "https://mail.google.com/mail/?view=cm&fs=1";
/**
 * Not measured (no Gmail in the build sandbox, 2026-10-02). Secondary sources give about 4,096 for
 * Gmail and about 2,000 as the safe browser figure; this is the conservative one.
 */
export const MAX_URL_LENGTH = 2000;
/** A saved draft is at most this long, so its Gmail link stays under MAX_URL_LENGTH. */
export const MAX_BODY_CHARS = 900;
export const MAX_SUBJECT_CHARS = 90;

export type ComposeLink = { href: string; kind: "gmail" | "mailto" };

/** The link the Send button opens: Gmail's compose page, or mailto: when that would be too long or is asked for. */
export function composeLink(email: Pick<OutreachEmail, "to_email" | "subject" | "body">, prefer: "gmail" | "mailto" = "gmail"): ComposeLink {
  const gmail =
    `${GMAIL_COMPOSE}&to=${encodeURIComponent(email.to_email)}` +
    `&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  if (prefer === "gmail" && gmail.length <= MAX_URL_LENGTH) return { href: gmail, kind: "gmail" };
  // RFC 6068: the address keeps its "@", and line breaks in the body are CRLF.
  const to = encodeURIComponent(email.to_email).replace(/%40/g, "@");
  const body = encodeURIComponent(email.body.replace(/\r?\n/g, "\r\n"));
  return { href: `mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${body}`, kind: "mailto" };
}

/** Owner's rule: no em dashes. Applied to every draft before the check, so it always holds. */
export function withoutDashes(text: string) {
  return text.replace(/\s+—\s+/g, ", ").replace(/—/g, "-");
}

/**
 * The no-invention check (src/lib/tailoring/check.ts, unchanged) applied to an email, plus the email's
 * own rules. `allowed` names the company, the role and the recipient. The owner's own name and
 * location are added here, because cvText leaves out name and contact, so a sign-off would be flagged.
 */
export function findEmailInventions(
  master: MasterCv,
  draft: Draft,
  { keywords, allowed }: { keywords: string[]; allowed: string[] },
) {
  const problems = findTextInventions(master, `${draft.subject}\n${draft.body}`, {
    keywords,
    allowed: [...allowed, master.name, master.contact.location].filter(Boolean),
  });
  if (/—/.test(`${draft.subject}${draft.body}`)) problems.push("Uses an em dash.");
  if (draft.body.length > MAX_BODY_CHARS) problems.push(`The body is ${draft.body.length} characters; keep it under ${MAX_BODY_CHARS}.`);
  if (draft.subject.length > MAX_SUBJECT_CHARS) problems.push(`The subject is longer than ${MAX_SUBJECT_CHARS} characters.`);
  // A compose link can't carry a file.
  if (/\battach(ed|ment|ing)?\b/i.test(draft.body)) problems.push("Mentions an attachment, which a compose link can't include.");
  return problems;
}

/** How a contact is labelled (owner decision D10: no verifier, so nothing is called "verified"). */
export function contactLabel(source: ContactSource, confidence: number | null) {
  if (source === "job_post") return "From the job post";
  return confidence != null ? `Found by Hunter (${confidence}% sure)` : "Found by Hunter";
}

/**
 * The follow-up (owner decision D4: a fixed template). It states no claims about the CV, so it
 * needs no no-invention check. No date in the text: the server's day and the owner's can differ.
 */
export function followUpDraft(
  first: { to_name: string | null; subject: string; company: string; role: string },
  ownerName: string,
): Draft {
  // A person gets their first name; a hiring team (worker/src/contacts.ts names it "<company> hiring team")
  // gets "Hi there,", as the first email does.
  const person = first.to_name?.trim() && !/hiring team$/i.test(first.to_name.trim()) ? first.to_name.trim() : null;
  const hello = person ? `Hi ${person.split(/\s+/)[0]},` : "Hi there,";
  // The role and company come from the job as saved, and job titles often hold em dashes.
  return {
    subject: withoutDashes(/^re:/i.test(first.subject) ? first.subject : `Re: ${first.subject}`),
    body: withoutDashes([
      hello,
      "",
      `I wanted to follow up on my earlier note about the ${first.role} role at ${first.company}. ` +
        "I'd still love a quick chat, or a pointer to the right person if that's someone else.",
      "",
      "Thanks for your time,",
      ownerName,
    ].join("\n")),
  };
}

export type TimelineEntry = { key: string; at: string; label: string; note: string | null; kind: "status" | "email" };

/**
 * The job page's timeline (owner decision D1): status events plus sent emails, by time.
 * job_status_events is untouched; "Email sent" is not a status.
 */
export function timelineEntries(
  events: Pick<StatusEvent, "id" | "to_status" | "changed_at" | "note">[],
  emails: Pick<OutreachEmail, "id" | "kind" | "to_email" | "to_name" | "sent_at">[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...events.map((event) => ({
      key: event.id,
      at: event.changed_at,
      label: STATUS_LABELS[event.to_status],
      note: event.note,
      kind: "status" as const,
    })),
    ...emails.flatMap((email) =>
      email.sent_at
        ? [{
            key: `email-${email.id}`,
            at: email.sent_at,
            label: email.kind === "follow_up" ? "Follow-up email sent" : "Email sent",
            note: `To ${email.to_name ? `${email.to_name} (${email.to_email})` : email.to_email}`,
            kind: "email" as const,
          }]
        : [],
    ),
  ];
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export type OutreachRequest = Pick<Tables<"outreach_requests">, "id" | "kind" | "requested_at" | "picked_up_at" | "finished_at" | "error">;
export type RequestState =
  | { kind: "none" }
  | { kind: "waiting"; slow: boolean }
  | { kind: "working" }
  | { kind: "done" }
  | { kind: "failed"; error: string };

/** A request still being worked on after this long stopped without saying so. */
export const REQUEST_STALE_MS = 15 * 60_000;
/** How long a finished request's result is shown. */
export const REQUEST_RESULT_FOR_MS = 10 * 60_000;

/** Where the latest "Find people" or "Use this person" request stands, for the waiting state on the page. */
export function requestState(request: OutreachRequest | null, now: number): RequestState {
  if (!request) return { kind: "none" };
  const age = (time: string) => now - Date.parse(time);
  if (!request.picked_up_at) return { kind: "waiting", slow: age(request.requested_at) > MAC_SLOW_AFTER_MS };
  if (!request.finished_at) {
    return age(request.picked_up_at) > REQUEST_STALE_MS
      ? { kind: "failed", error: "Your Mac stopped before finishing. Try again." }
      : { kind: "working" };
  }
  if (age(request.finished_at) > REQUEST_RESULT_FOR_MS) return { kind: "none" };
  return request.error ? { kind: "failed", error: request.error } : { kind: "done" };
}

export const isBusy = (state: RequestState) => state.kind === "waiting" || state.kind === "working";
