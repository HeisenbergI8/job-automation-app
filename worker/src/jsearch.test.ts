import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_QUERIES, parseJSearch, searchJSearch, todaysSearches } from "./jsearch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Built from JSearch's documented fields (search endpoint, `data[]`); replace with a recorded response.
const body = {
  status: "OK",
  data: [
    {
      job_title: "AI Engineer",
      employer_name: "Acme PH",
      job_publisher: "LinkedIn",
      job_apply_link: "https://www.linkedin.com/jobs/view/123",
      job_description: "Build LLM features in TypeScript.",
      job_is_remote: true,
      job_location: "Manila, Philippines",
      job_min_salary: 100000,
      job_max_salary: 150000,
      job_salary_currency: "PHP",
      job_salary_period: "MONTH",
    },
    { job_title: "Full-Stack Engineer", employer_name: "Beta", job_publisher: "JobStreet Philippines", job_apply_link: "https://ph.jobstreet.com/job/9", job_is_remote: false, job_city: "Cebu", job_country: "PH", job_salary_period: "HOUR", job_min_salary: 10 },
    { job_title: "No link", employer_name: "Gamma", job_publisher: "Indeed" },
  ],
};

describe("parseJSearch", () => {
  it("maps jobs, names the site and makes monthly pay yearly", () => {
    const [linkedin, jobstreet, ...rest] = parseJSearch(body);
    expect(rest).toEqual([]); // no apply link, dropped
    expect(linkedin).toMatchObject({
      site: "linkedin",
      url: "https://www.linkedin.com/jobs/view/123",
      company: "Acme PH",
      role: "AI Engineer",
      location: "Manila, Philippines",
      remote: true,
      salary_min: 1_200_000,
      salary_max: 1_800_000,
      salary_currency: "PHP",
    });
    expect(jobstreet).toMatchObject({ site: "jobstreet", location: "Cebu, PH", remote: false, salary_min: null, salary_currency: null });
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
  it("asks for remote jobs from the last 3 days with the RapidAPI key", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "test-key-EXAMPLE");
    const fetch = vi.fn(async () => Response.json(body));
    vi.stubGlobal("fetch", fetch);
    await searchJSearch({ role: "AI Engineer", country: "ph" }, true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://jsearch.p.rapidapi.com/search?query=AI+Engineer");
    expect(url).toContain("country=ph");
    expect(url).toContain("date_posted=3days");
    expect(url).toContain("work_from_home=true");
    expect((init.headers as Record<string, string>)["x-rapidapi-host"]).toBe("jsearch.p.rapidapi.com");
  });

  it("explains a used-up free plan", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "test-key-EXAMPLE");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(searchJSearch({ role: "x", country: "ph" }, true)).rejects.toThrow("free monthly limit is used up");
  });
});
