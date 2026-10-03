import { describe, expect, it, vi } from "vitest";
import type { MasterCv } from "@/lib/master-cv";
import { askClaudeCode } from "./scoring";
import type { Candidate, PostingFacts } from "./contacts";
import type { Db } from "./db";
import { draftEmail, outreachForJob } from "./outreach";

// outreachForJob's posting read and contact search, faked: no real email was found for this job.
vi.mock("./contacts", async (original) => ({
  ...(await original<typeof import("./contacts")>()),
  readPosting: vi.fn(async () => ({ domain: "mail.test", domainInPost: true, team: null, people: [], skills: [] })),
  findContacts: vi.fn(async () => []),
}));
vi.mock("./scoring", async (original) => ({ ...(await original<typeof import("./scoring")>()), askClaudeCode: vi.fn() }));

const master: MasterCv = {
  name: "Sample Owner",
  headline: "Frontend Engineer",
  contact: { email: "owner@example.local", phone: "", location: "Manila", links: [] },
  summary: "Frontend engineer building React and TypeScript products.",
  skills: ["React", "TypeScript", "Next.js"],
  experience: [{ employer: "Northwind", title: "Senior Frontend Engineer", location: "Remote", start: "Jan 2022", end: "Present",
    bullets: ["Led the rebuild of a customer dashboard in Next.js"] }],
  education: [],
  certifications: [],
};
const job = { id: "j1", company: "Mail Co", role: "Frontend Engineer", description: "We use React, TypeScript and GraphQL." };
const contact: Candidate = { name: "Ana Cruz", title: "Technical Recruiter", email: "ana.cruz@mail.test", source: "hunter", confidence: 92, tier: 1 };
const facts: PostingFacts = { domain: "mail.test", domainInPost: true, team: null, people: [], skills: ["React", "TypeScript", "GraphQL"] };

const answer = (subject: string, body: string) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: { subject, body } });
const good = "Hi Ana,\n\nI'd love to talk about the Frontend Engineer role at Mail Co.\nAt Northwind I led the rebuild of a customer dashboard in Next.js.\nWould you be open to a quick chat?\n\nThanks,\nSample Owner";

describe("draftEmail", () => {
  it("returns a draft that passes, with em dashes removed", async () => {
    const ask = vi.fn(async () => answer("Frontend Engineer role — Mail Co", good.replace("Mail Co.", "Mail Co — happy to share more.")));
    const draft = await draftEmail(master, job, contact, facts, ask);
    expect(draft.subject).toBe("Frontend Engineer role, Mail Co");
    expect(draft.body).not.toContain("—");
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("rejects a draft claiming a skill the master CV doesn't have, and asks again with the problem", async () => {
    const invented = good.replace("in Next.js.", "in Next.js and GraphQL.");
    const ask = vi.fn<(prompt: string, system: string, schema: string) => Promise<string>>()
      .mockResolvedValueOnce(answer("Frontend Engineer role", invented))
      .mockResolvedValueOnce(answer("Frontend Engineer role", good));
    const draft = await draftEmail(master, job, contact, facts, ask);
    expect(draft.body).toBe(good);
    expect(ask.mock.calls[1][0]).toContain('Mentions "GraphQL", which isn\'t in the master CV.');
  });

  it("throws when the second draft is rejected too, so nothing invented is ever saved", async () => {
    const ask = vi.fn(async () => answer("Frontend Engineer role", good.replace("in Next.js.", "in Next.js and GraphQL.")));
    await expect(draftEmail(master, job, contact, facts, ask)).rejects.toThrow(/no-invention check: Mentions "GraphQL"/);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("rejects a body over the length limit", async () => {
    const ask = vi.fn(async () => answer("Frontend Engineer role", `${good}\n${"I enjoy React. ".repeat(80)}`));
    await expect(draftEmail(master, job, contact, facts, ask)).rejects.toThrow(/keep it under/);
  });

  it("never drafts without a real email: no contact means no draft and no Claude call", async () => {
    const writes: string[] = [];
    const db = {
      from: (table: string) => ({
        delete: () => ({ eq: async () => (writes.push(`delete ${table}`), { error: null }) }),
        insert: () => { throw new Error(`unexpected insert into ${table}`); },
        upsert: () => { throw new Error(`unexpected upsert into ${table}`); },
      }),
    } as unknown as Db;
    expect(await outreachForJob(db, master, job, null)).toEqual({ drafted: false });
    expect(writes).toEqual(["delete job_contacts"]);
    expect(askClaudeCode).not.toHaveBeenCalled();
  });

  it("tells Claude which job skills the CV doesn't support", async () => {
    const ask = vi.fn<(prompt: string, system: string, schema: string) => Promise<string>>(async () => answer("Frontend Engineer role", good));
    await draftEmail(master, job, contact, facts, ask);
    expect(ask.mock.calls[0][0]).toContain("never mention them: GraphQL");
    expect(ask.mock.calls[0][0]).not.toContain("owner@example.local");
  });
});
