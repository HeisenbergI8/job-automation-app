import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOnlineJobsSearch, parsePay, searchOnlineJobs } from "./onlinejobs";

const html = readFileSync(new URL("../fixtures/onlinejobs-search.html", import.meta.url), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("parseOnlineJobsSearch (real results page, recorded 2026-09-30)", () => {
  it("reads each job once, with its link, title, company, UTC posting time and pay", () => {
    const jobs = parseOnlineJobsSearch(html);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      site: "onlinejobs",
      url: "https://www.onlinejobs.ph/jobseekers/job/ai-expert-data-engineer-remote-philippines-1612997",
      role: "AI Expert – Data Engineer (Remote | Philippines)",
      company: "Employer on OnlineJobs.ph",
      location: "Philippines (Remote)",
      remote: true,
      posted_at: "2026-09-30T01:31:57Z",
      salary_raw: null,
    });
    expect(jobs[0].description).toContain("Remote (Philippines-based applicants only)");
    expect(jobs[1]).toMatchObject({
      company: "Tidewell Media",
      role: "AI Agent Engineer (Agent Harnesses / LLM Orchestration) - Full-Time or Part-Time",
      posted_at: "2026-09-29T21:58:41Z",
      salary_raw: "Up to PHP 30,000/month",
      salary_max: 360_000,
      salary_currency: "PHP",
    });
  });
});

describe("parsePay", () => {
  it("turns monthly pay into yearly and leaves hourly pay out", () => {
    expect(parsePay("PHP 40,000 - PHP 60,000/month")).toEqual({ salary_min: 480_000, salary_max: 720_000, salary_currency: "PHP" });
    expect(parsePay("$5/hr")).toEqual({ salary_min: null, salary_max: null, salary_currency: null });
    expect(parsePay("TBD")).toEqual({ salary_min: null, salary_max: null, salary_currency: null });
  });
});

describe("searchOnlineJobs", () => {
  it("searches each role (at most 5), and a failed search becomes a problem, not a crash", async () => {
    const fetch = vi.fn(async (url: string) => (url.includes("broken") ? new Response("", { status: 503 }) : new Response(html)));
    vi.stubGlobal("fetch", fetch);
    const errors: string[] = [];
    const jobs = await searchOnlineJobs(["ai engineer", "broken", "a", "b", "c", "d"], errors, 0);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[0][0]).toBe("https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=ai+engineer");
    expect(errors).toEqual(['OnlineJobs.ph "broken": answered with error 503']);
    expect(jobs).toHaveLength(12);
  });
});
