import { afterEach, describe, expect, it, vi } from "vitest";
import jsearch from "../fixtures/jsearch.json";
import { findSamePosting, lookUpPosting, MAX_QUERIES, parseJSearch, sameCompany, searchJSearch, titleOverlap, todaysSearches } from "./jsearch";

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

  it("doesn't trust the remote filter for a job its title or location calls hybrid or on-site", () => {
    const body = { data: { jobs: [
      { job_title: "AI Engineer (Hybrid)", employer_name: "A", job_publisher: "LinkedIn", job_apply_link: "https://x/1" },
      { job_title: "AI Engineer", employer_name: "B", job_publisher: "LinkedIn", job_apply_link: "https://x/2", job_location: "Onsite - Makati" },
      { job_title: "AI Engineer", employer_name: "C", job_publisher: "LinkedIn", job_apply_link: "https://x/3" },
    ] } };
    expect(parseJSearch(body, true).map((job) => job.remote)).toEqual([false, false, true]);
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

describe("finding a Gmail job on JSearch", () => {
  it("treats company names that differ only by suffix or punctuation as the same", () => {
    expect(sameCompany("White Cloak Technologies, Inc.", "White Cloak Technologies")).toBe(true);
    expect(sameCompany("MedVirtual", "Medvirtual LLC")).toBe(true);
    expect(sameCompany("Acme", "Globex")).toBe(false);
  });

  it("measures how much of the shorter title the other shares", () => {
    expect(titleOverlap("AI Agent Developer", "AI Agent Developer (Remote)")).toBe(1);
    expect(titleOverlap("Frontend Engineer", "Backend Engineer")).toBe(0.5);
  });

  it("picks the same company's closest title, and nothing when unsure", () => {
    const results = parseJSearch(jsearch);
    const target = results[0];
    expect(findSamePosting({ company: `${target.company} Inc.`, role: target.role }, results)).toBe(target);
    expect(findSamePosting({ company: target.company, role: "Head of Sales" }, results)).toBeNull();
    expect(findSamePosting({ company: "Someone Else", role: target.role }, results)).toBeNull();
  });

  it("doesn't mix up seniority levels or match a vague title", () => {
    const at = (role: string) => ({ ...parseJSearch(jsearch)[0], company: "Acme", role });
    expect(findSamePosting({ company: "Acme", role: "Junior Frontend Developer" }, [at("Senior Frontend Developer")])).toBeNull();
    expect(findSamePosting({ company: "Acme", role: "Frontend Developer" }, [at("Lead Frontend Developer")])).toBeNull();
    expect(findSamePosting({ company: "Acme", role: "Sr. Frontend Developer" }, [at("Senior Frontend Developer")])?.role).toBe("Senior Frontend Developer");
    expect(findSamePosting({ company: "Acme", role: "Engineer" }, [at("Software Engineer")])).toBeNull();
    // Most of the short title, but under half of a much longer one: a different job.
    expect(findSamePosting({ company: "Acme", role: "Data Engineer" }, [at("Data Platform Reliability Operations Engineer")])).toBeNull();
  });

  it("looks up by title and company, in the job's country, from the past week", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "test-key-EXAMPLE");
    const fetch = vi.fn(async () => Response.json(jsearch));
    vi.stubGlobal("fetch", fetch);
    const [first] = parseJSearch(jsearch);
    const found = await lookUpPosting({ company: first.company, role: first.role, location: "Makati, Philippines" }, []);
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toContain(`query=${encodeURIComponent(`${first.role} ${first.company}`).replace(/%20/g, "+")}`);
    expect(url).toContain("country=ph");
    expect(url).toContain("date_posted=week");
    expect(found?.description).toBe(first.description);
  });
});
