import { afterEach, describe, expect, it, vi } from "vitest";
import jsearch from "../fixtures/jsearch.json";
import { MAX_QUERIES, parseJSearch, searchJSearch, todaysSearches } from "./jsearch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseJSearch (real /search-v2 answer, recorded 2026-09-29)", () => {
  it("reads jobs from data.jobs, names the site and decodes the title", () => {
    const [linkedin, glassdoor, other] = parseJSearch(jsearch);
    expect(linkedin).toMatchObject({
      site: "linkedin",
      company: "YO AI Labs",
      role: "Software Engineer - Open Source Contributions - Remote",
      location: "Cebu City, Cebu",
      salary_min: null,
      salary_currency: null,
      posted_at: "2026-09-27T00:00:00.000Z",
    });
    expect(linkedin.url).toMatch(/^https:\/\/ph\.linkedin\.com\/jobs\/view\//);
    expect(glassdoor.site).toBe("glassdoor");
    expect(other).toMatchObject({ site: "up2staff", role: "AI ML Engineering Internship – Thessaloniki, Greece" });
  });

  it("trusts a work-from-home search, since JSearch marks every result not remote", () => {
    expect(parseJSearch(jsearch).every((job) => !job.remote)).toBe(true);
    expect(parseJSearch(jsearch, true).every((job) => job.remote)).toBe(true);
  });

  it("makes monthly pay yearly, drops other periods, and skips jobs without a link", () => {
    const body = {
      data: {
        jobs: [
          { job_title: "A", employer_name: "X", job_publisher: "JobStreet Philippines", job_apply_link: "https://ph.jobstreet.com/job/1", job_min_salary: 100000, job_max_salary: 150000, job_salary_currency: "PHP", job_salary_period: "MONTH" },
          { job_title: "B", employer_name: "Y", job_publisher: "Indeed", job_apply_link: "https://ph.indeed.com/viewjob?jk=2", job_min_salary: 10, job_salary_period: "HOUR" },
          { job_title: "No link", employer_name: "Z", job_publisher: "Indeed" },
        ],
      },
    };
    const [monthly, hourly, ...rest] = parseJSearch(body);
    expect(rest).toEqual([]);
    expect(monthly).toMatchObject({ site: "jobstreet", salary_min: 1_200_000, salary_max: 1_800_000, salary_currency: "PHP" });
    expect(hourly).toMatchObject({ site: "indeed", salary_min: null, salary_currency: null });
  });
});

describe("todaysSearches", () => {
  const criteria = { target_roles: ["AI Engineer", "Software Engineer", "Product Engineer"], locations: ["Philippines", "Singapore", "Remote", "United Kingdom"] };

  it("searches each role in each listed country, at most MAX_QUERIES a day", () => {
    const today = todaysSearches(criteria, new Date("2026-09-29"));
    expect(today).toHaveLength(MAX_QUERIES);
    expect(new Set(today.map((search) => search.country))).toEqual(new Set(["ph", "sg", "gb"]));
  });

  it("rotates so every combination is covered over a few days", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 3; day++) {
      for (const search of todaysSearches(criteria, new Date(Date.UTC(2026, 8, 29 + day)))) seen.add(`${search.role}|${search.country}`);
    }
    expect(seen.size).toBe(9);
  });

  it("uses the Philippines when no listed location is a known country", () => {
    expect(todaysSearches({ target_roles: ["AI Engineer"], locations: ["Remote"] })).toEqual([{ role: "AI Engineer", country: "ph" }]);
  });
});

describe("searchJSearch", () => {
  it("calls /search-v2 for remote jobs from the last 3 days with the RapidAPI key", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "test-key-EXAMPLE");
    const fetch = vi.fn(async () => Response.json(jsearch));
    vi.stubGlobal("fetch", fetch);
    const jobs = await searchJSearch({ role: "AI Engineer", country: "ph" }, true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://jsearch.p.rapidapi.com/search-v2?query=AI+Engineer");
    expect(url).toContain("country=ph");
    expect(url).toContain("date_posted=3days");
    expect(url).toContain("work_from_home=true");
    expect((init.headers as Record<string, string>)["x-rapidapi-host"]).toBe("jsearch.p.rapidapi.com");
    expect(jobs.every((job) => job.remote)).toBe(true);
  });

  it("explains a used-up free plan", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "test-key-EXAMPLE");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(searchJSearch({ role: "x", country: "ph" }, true)).rejects.toThrow("free monthly limit is used up");
  });
});
