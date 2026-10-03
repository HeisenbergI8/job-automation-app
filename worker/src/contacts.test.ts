import { describe, expect, it, vi } from "vitest";
import domainFixture from "../fixtures/hunter-domain-search.json";
import finderFixture from "../fixtures/hunter-email-finder.json";
import { findContacts, guardFacts, rankContacts, type Candidate, type HunterAccess, type PostingFacts } from "./contacts";
import { HunterLimitReached, parseDomainSearch, parseEmailFinder } from "./hunter";

const job = {
  id: "j1",
  company: "Mail Co",
  role: "Frontend Engineer",
  description: "Join the Platform team at Mail Co (mail.test). Questions? Ana Cruz, our Technical Recruiter, is hiring for this role.",
};
const facts: PostingFacts = {
  domain: "mail.test", domainInPost: true, team: "Platform",
  people: [{ name: "Ana Cruz", title: "Technical Recruiter", email: null }], skills: ["React"],
};

function fakeHunter(searches: number, opts: { limit?: boolean; finds?: boolean } = {}): HunterAccess & { calls: string[] } {
  let left = searches;
  const calls: string[] = [];
  return {
    calls,
    take: () => (left > 0 ? (left--, true) : false),
    stop: () => void (left = 0),
    domainSearch: vi.fn(async () => {
      calls.push("domain");
      if (opts.limit) throw new HunterLimitReached("429");
      return parseDomainSearch(domainFixture);
    }),
    emailFinder: vi.fn(async () => (calls.push("finder"), opts.finds ? parseEmailFinder(finderFixture) : null)),
  };
}
const emails = (contacts: Candidate[]) => contacts.map((x) => x.email);

describe("rankContacts", () => {
  const c = (over: Partial<Candidate>): Candidate => ({ name: "X", title: null, email: `${over.name}@m.test`, source: "hunter", confidence: 50, tier: 3, ...over });
  it("puts the person the post names first, then a manager on the team, then a recruiter, and keeps 2", () => {
    const ranked = rankContacts([c({ name: "Recruiter", tier: 3, confidence: 99 }), c({ name: "Manager", tier: 2 }), c({ name: "Named", tier: 1, confidence: 30 })]);
    expect(ranked.map((x) => x.name)).toEqual(["Named", "Manager"]);
  });
  it("prefers an address printed in the post within a tier, and drops duplicate addresses", () => {
    const ranked = rankContacts([
      c({ name: "Hunter", tier: 2, email: "a@m.test", confidence: 99 }),
      c({ name: "Post", tier: 2, source: "job_post", email: "a@m.test" }),
      c({ name: "Other", tier: 2, email: "b@m.test" }),
    ]);
    expect(ranked.map((x) => x.name)).toEqual(["Post", "Other"]);
  });
});

describe("guardFacts", () => {
  it("drops people and emails the posting doesn't contain, and job-board domains", () => {
    const result = guardFacts(
      { domain: "jobs.lever.co", team: "", skills: ["React", "React"], people: [
        { name: "Ana Cruz", title: "Technical Recruiter", email: "ana@mail.test" },
        { name: "Made Up", title: "CTO", email: "" },
      ] },
      job.description,
    );
    expect(result.people).toEqual([{ name: "Ana Cruz", title: "Technical Recruiter", email: null }]);
    expect(result.domain).toBeNull();
    expect(result.skills).toEqual(["React"]);
  });
});

describe("findContacts (real emails only)", () => {
  it("finds the named recruiter through Hunter's email finder, then the Platform manager", async () => {
    const hunter = fakeHunter(2, { finds: true });
    const contacts = await findContacts(job, facts, hunter);
    expect(contacts.map((x) => [x.name, x.source, x.email])).toEqual([
      ["Ana Cruz", "hunter", "ana.cruz@mail.test"],
      ["Ben Ong", "hunter", "ben.ong@mail.test"],
    ]);
    expect(hunter.calls).toEqual(["domain", "finder"]);
  });

  it("never makes up an address: a named person Hunter can't find is left out", async () => {
    const contacts = await findContacts(job, facts, fakeHunter(2));
    expect(contacts.map((x) => x.name)).toEqual(["Ben Ong", "Carla Reyes"]);
    expect(emails(contacts)).not.toContain("ana.cruz@mail.test");
  });

  it("never offers the sales person or Hunter's generic address", async () => {
    const contacts = await findContacts(job, { ...facts, people: [] }, fakeHunter(1));
    expect(emails(contacts)).toEqual(["ben.ong@mail.test", "carla.reyes@mail.test"]);
  });

  it("finds no one, and says so, without Hunter or once its free limit is used up", async () => {
    expect(await findContacts(job, facts, null)).toEqual([]);
    const limited = fakeHunter(5, { limit: true });
    expect(await findContacts(job, facts, limited)).toEqual([]);
    expect(limited.calls).toEqual(["domain"]); // stopped quietly: no email-finder call after the limit
  });

  it("ignores Hunter's people for an inferred domain that belongs to another company", async () => {
    const hunter = fakeHunter(2, { finds: true });
    const contacts = await findContacts({ ...job, company: "Other Co" }, { ...facts, domainInPost: false }, hunter);
    expect(contacts).toEqual([]);
    expect(hunter.calls).toEqual(["domain"]);
  });

  it("uses an address the post prints, ahead of Hunter's", async () => {
    const printed = { ...job, description: `${job.description} Email ana.cruz@mail.test to apply.` };
    const contacts = await findContacts(printed, { ...facts, people: [{ ...facts.people[0], email: "ana.cruz@mail.test" }] }, null);
    expect(contacts).toEqual([expect.objectContaining({ source: "job_post", email: "ana.cruz@mail.test", tier: 1 })]);
  });
});
