import { describe, expect, it } from "vitest";
import type { MasterCv } from "@/lib/master-cv";
import {
  composeLink, contactLabel, findEmailInventions, followUpDraft, GMAIL_COMPOSE, MAX_BODY_CHARS, MAX_URL_LENGTH,
  requestState, timelineEntries, withoutDashes,
} from "./outreach";

const master: MasterCv = {
  name: "Sample Owner",
  headline: "Frontend Engineer",
  contact: { email: "owner@example.local", phone: "", location: "Manila", links: [] },
  summary: "Frontend engineer with six years of experience building React and TypeScript products.",
  skills: ["React", "TypeScript", "Next.js"],
  experience: [{
    employer: "Northwind", title: "Senior Frontend Engineer", location: "Remote", start: "Jan 2022", end: "Present",
    bullets: ["Led the rebuild of a customer dashboard in Next.js used by 40,000 people a month"],
  }],
  education: [],
  certifications: [],
};
const keywords = ["React", "TypeScript", "GraphQL", "Kubernetes"];
const allowed = ["Mail Co", "Frontend Engineer", "Ana Cruz"];
const faithful = {
  subject: "Frontend Engineer role at Mail Co",
  body: [
    "Hi Ana,",
    "",
    "I saw the Frontend Engineer opening at Mail Co and wanted to reach out directly.",
    "At Northwind I led the rebuild of a customer dashboard in Next.js used by 40,000 people a month.",
    "Most of my work is React and TypeScript, which matches what the role asks for.",
    "Would you be open to a quick chat, or could you point me to the right person?",
    "",
    "Thanks,",
    "Sample Owner",
  ].join("\n"),
};

describe("composeLink", () => {
  it("builds a Gmail compose link with every part encoded", () => {
    const email = { to_email: "ana+jobs@mail.test", subject: "R&D? #1 100% \"yes\"", body: "Hi Ana,\n\nCafé & co: a+b=c\nThanks" };
    const link = composeLink(email);
    expect(link.kind).toBe("gmail");
    expect(link.href.startsWith(`${GMAIL_COMPOSE}&to=`)).toBe(true);
    expect(link.href).not.toMatch(/[ \n"#]/);
    const params = new URL(link.href).searchParams;
    expect(params.get("to")).toBe(email.to_email);
    expect(params.get("su")).toBe(email.subject);
    expect(params.get("body")).toBe(email.body);
  });

  it("keeps a normal draft under the length limit", () => {
    expect(faithful.body.length).toBeLessThan(MAX_BODY_CHARS);
    const link = composeLink({ to_email: "ana.cruz@mail.test", ...faithful });
    expect(link.kind).toBe("gmail");
    expect(link.href.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
  });

  it("falls back to mailto: with CRLF line breaks when the Gmail link would be too long", () => {
    const link = composeLink({ to_email: "ana.cruz@mail.test", subject: "Hi", body: `Line one\n${"x".repeat(2100)}` });
    expect(link.kind).toBe("mailto");
    expect(link.href.startsWith("mailto:ana.cruz@mail.test?subject=Hi&body=Line%20one%0D%0A")).toBe(true);
  });

  it("gives mailto: when asked (phones, owner decision D9)", () => {
    expect(composeLink({ to_email: "a@b.test", ...faithful }, "mailto").kind).toBe("mailto");
  });
});

describe("findEmailInventions", () => {
  it("accepts a draft that only uses the CV, the job and the recipient", () => {
    expect(findEmailInventions(master, faithful, { keywords, allowed })).toEqual([]);
  });

  it("rejects a draft that claims a skill the master CV doesn't have", () => {
    const draft = { ...faithful, body: faithful.body.replace("React and TypeScript", "React, TypeScript and graphql") };
    expect(findEmailInventions(master, draft, { keywords, allowed })).toEqual(['Mentions "GraphQL", which isn\'t in the master CV.']);
  });

  it("rejects an invented tool that isn't among the job's keywords", () => {
    const draft = { ...faithful, body: `${faithful.body}\nI also run Docker in production.` };
    expect(findEmailInventions(master, draft, { keywords, allowed })).toContain('Mentions "Docker", which isn\'t in the master CV.');
  });

  it("flags an em dash, a long body and an attachment", () => {
    const draft = { subject: faithful.subject, body: `${faithful.body} — see my CV attached.${" ok".repeat(400)}` };
    expect(findEmailInventions(master, draft, { keywords, allowed })).toEqual(expect.arrayContaining([
      "Uses an em dash.",
      expect.stringContaining("keep it under"),
      "Mentions an attachment, which a compose link can't include.",
    ]));
  });
});

describe("withoutDashes", () => {
  it("turns spaced em dashes into commas and the rest into hyphens", () => {
    expect(withoutDashes("I build apps — mostly React—fast")).toBe("I build apps, mostly React-fast");
  });
});

describe("contactLabel", () => {
  it("says where a real address came from, with Hunter's score", () => {
    expect(contactLabel("job_post", 95)).toBe("From the job post");
    expect(contactLabel("hunter", 88)).toBe("Found by Hunter (88% sure)");
  });
});

describe("followUpDraft", () => {
  it("replies to the same person by first name, once", () => {
    const draft = followUpDraft({ to_name: "Ana Cruz", subject: "Re: Frontend Engineer role", company: "Mail Co", role: "Frontend Engineer" }, "Sample Owner");
    expect(draft.subject).toBe("Re: Frontend Engineer role");
    expect(draft.body.startsWith("Hi Ana,\n")).toBe(true);
    expect(draft.body).not.toContain("—");
    expect(draft.body.length).toBeLessThan(MAX_BODY_CHARS);
  });

  it("greets a hiring team as \"Hi there,\", like the first email", () => {
    const draft = followUpDraft({ to_name: "Kappa hiring team", subject: "Frontend Engineer role", company: "Kappa", role: "Frontend Engineer" }, "Sample Owner");
    expect(draft.body.startsWith("Hi there,\n")).toBe(true);
  });

  it("keeps the owner's no-em-dash rule when the job title has one", () => {
    const draft = followUpDraft({ to_name: null, subject: "Senior Engineer — Platform", company: "Acme — Labs", role: "Senior Engineer — Platform" }, "Sample Owner");
    expect(`${draft.subject}${draft.body}`).not.toContain("—");
    expect(draft.body).toContain("the Senior Engineer, Platform role at Acme, Labs.");
  });
});

describe("timelineEntries", () => {
  const events = [
    { id: "e1", to_status: "found" as const, changed_at: "2026-10-01T01:00:00+00:00", note: null },
    { id: "e2", to_status: "applied" as const, changed_at: "2026-10-03T01:00:00+00:00", note: null },
  ];
  it("adds a dated 'Email sent' entry between status events, and nothing for drafts", () => {
    const entries = timelineEntries(events, [
      { id: "m1", kind: "first", to_email: "ana.cruz@mail.test", to_name: "Ana Cruz", sent_at: "2026-10-02T01:00:00+00:00" },
      { id: "m2", kind: "follow_up", to_email: "ana.cruz@mail.test", to_name: "Ana Cruz", sent_at: null },
    ]);
    expect(entries.map((entry) => entry.label)).toEqual(["Found", "Email sent", "Applied"]);
    expect(entries[1]).toMatchObject({ kind: "email", at: "2026-10-02T01:00:00+00:00", note: "To Ana Cruz (ana.cruz@mail.test)" });
  });
});

describe("requestState", () => {
  const now = Date.parse("2026-10-02T10:00:00Z");
  const base = { id: "r", kind: "find_people" as const, requested_at: "2026-10-02T09:59:30Z", picked_up_at: null, finished_at: null, error: null };
  it("follows a request from waiting to done", () => {
    expect(requestState(null, now)).toEqual({ kind: "none" });
    expect(requestState(base, now)).toEqual({ kind: "waiting", slow: false });
    expect(requestState({ ...base, requested_at: "2026-10-02T09:55:00Z" }, now)).toEqual({ kind: "waiting", slow: true });
    expect(requestState({ ...base, picked_up_at: "2026-10-02T09:59:50Z" }, now)).toEqual({ kind: "working" });
    expect(requestState({ ...base, picked_up_at: "2026-10-02T09:59:50Z", finished_at: "2026-10-02T09:59:59Z" }, now)).toEqual({ kind: "done" });
  });
  it("reports a failure, and a Mac that stopped part-way", () => {
    const failed = { ...base, picked_up_at: "2026-10-02T09:59:50Z", finished_at: "2026-10-02T09:59:59Z", error: "No one found." };
    expect(requestState(failed, now)).toEqual({ kind: "failed", error: "No one found." });
    expect(requestState({ ...base, picked_up_at: "2026-10-02T09:30:00Z" }, now).kind).toBe("failed");
  });
});
