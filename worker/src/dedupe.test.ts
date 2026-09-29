import { describe, expect, it } from "vitest";
import { dedupe, dedupeKey, recentOnly } from "./dedupe";
import type { Posting } from "./sources";

const posting = (overrides: Partial<Posting>): Posting => ({
  site: "lever",
  url: "https://jobs.lever.co/acme/1",
  company: "Acme",
  role: "Frontend Engineer",
  location: "Remote",
  description: "",
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  salary_raw: null,
  remote: true,
  ...overrides,
});

describe("dedupeKey", () => {
  it("ignores case, punctuation, company suffixes and common abbreviations", () => {
    expect(dedupeKey({ company: "Acme, Inc.", role: "Sr. Frontend Eng", location: "Remote - Manila" })).toBe(
      dedupeKey({ company: "ACME", role: "Senior Frontend Engineer", location: "Remote, Manila" }),
    );
  });

  it("keeps different locations apart", () => {
    expect(dedupeKey({ company: "Acme", role: "Dev", location: "Manila" })).not.toBe(
      dedupeKey({ company: "Acme", role: "Dev", location: "Cebu" }),
    );
  });
});

describe("recentOnly", () => {
  it("keeps jobs from the last 7 days and jobs with no date", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const jobs = [
      posting({ url: "new", posted_at: "2026-09-27T00:00:00Z" }),
      posting({ url: "edge", posted_at: "2026-09-22T12:00:00Z" }),
      posting({ url: "old", posted_at: "2026-08-01T00:00:00Z" }),
      posting({ url: "undated", posted_at: null }),
    ];
    expect(recentOnly(jobs, now).map((job) => job.url)).toEqual(["new", "edge", "undated"]);
  });
});

describe("dedupe", () => {
  it("keeps the first of the same job found on two boards", () => {
    const greenhouse = posting({ site: "greenhouse", url: "https://job-boards.greenhouse.io/acme/jobs/1" });
    const ashby = posting({ site: "ashby", url: "https://jobs.ashbyhq.com/acme/1", company: "Acme Inc" });
    expect(dedupe([greenhouse, ashby], [])).toEqual([greenhouse]);
  });

  it("drops jobs already saved, by URL or by company, role and location", () => {
    const sameUrl = posting({});
    const sameJob = posting({ url: "https://jobs.lever.co/acme/2", role: "frontend engineer" });
    const newJob = posting({ url: "https://jobs.lever.co/acme/3", role: "Backend Engineer" });
    const saved = [{ url: "https://jobs.lever.co/acme/1", company: "Acme", role: "Frontend Engineer", location: "Remote" }];
    expect(dedupe([sameUrl, sameJob, newJob], saved)).toEqual([newJob]);
  });
});
