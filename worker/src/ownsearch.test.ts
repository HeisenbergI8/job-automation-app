import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOwnSearch, searchOwn } from "./ownsearch";

afterEach(() => vi.unstubAllEnvs());

// The shape jobsearch.py's posting() prints.
const job = {
  site: "remotive",
  url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-1",
  company: "Acme",
  role: "AI Engineer",
  location: "Worldwide",
  description: "Build models",
  salary_min: null,
  salary_max: 120000,
  salary_currency: "USD",
  salary_raw: null,
  remote: true,
  posted_at: "2026-10-01T08:00:00+00:00",
};

describe("parseOwnSearch", () => {
  it("passes on jobs and the sources' problems", () => {
    const { postings, errors } = parseOwnSearch(JSON.stringify({ jobs: [job], errors: ["jobicy: HTTP Error 429"] }));
    expect(postings).toEqual([job]);
    expect(errors).toEqual(["jobicy: HTTP Error 429"]);
  });

  it("leaves out a job that doesn't fit and says so, keeping the rest", () => {
    const { postings, errors } = parseOwnSearch(JSON.stringify({ jobs: [job, { ...job, url: "not a link" }], errors: [] }));
    expect(postings).toHaveLength(1);
    expect(errors).toEqual(["1 unreadable job was left out."]);
  });

  it("throws on output that isn't an answer", () => {
    expect(() => parseOwnSearch("Traceback (most recent call last):")).toThrow();
  });
});

describe("searchOwn", () => {
  it("says when Python isn't there", async () => {
    vi.stubEnv("PYTHON_BIN", "/no/such/python3");
    await expect(searchOwn({ role: "AI Engineer", country: "ph" }, true)).rejects.toThrow("Python 3 isn't installed");
  });
});
