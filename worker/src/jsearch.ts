// ROADMAP 5.3 (owner request 2026-09-29): LinkedIn, Indeed, JobStreet and other boards, read through
// JSearch (RapidAPI), which collects them from Google for Jobs. The finder never visits those sites
// itself: it only reads JSearch's results and passes on the links. JSearch's free plan is 200
// requests a month, so a run makes at most MAX_QUERIES and rotates through the combinations daily.
import type { Criteria } from "./scoring";
import { decodeEntities, NOT_REMOTE, type Posting } from "./sources";

export const MAX_QUERIES = 6;

// JSearch country codes for the location names the owner is likely to type in Settings.
const COUNTRY_CODES: Record<string, string> = {
  philippines: "ph", singapore: "sg", australia: "au", "united kingdom": "gb", uk: "gb", malaysia: "my",
  "new zealand": "nz", "united states": "us", usa: "us", canada: "ca", india: "in", japan: "jp",
  "hong kong": "hk", indonesia: "id", vietnam: "vn", thailand: "th", germany: "de", ireland: "ie",
};

export type Search = { role: string; country: string };

/** Today's searches: every target role in every country the owner listed, rotated by day, at most MAX_QUERIES. */
export function todaysSearches(criteria: Pick<Criteria, "target_roles" | "locations">, day = new Date()) {
  const countries = [...new Set(criteria.locations.map((place) => COUNTRY_CODES[place.trim().toLowerCase()]).filter(Boolean))];
  const all: Search[] = criteria.target_roles.flatMap((role) => (countries.length ? countries : ["ph"]).map((country) => ({ role, country })));
  if (all.length <= MAX_QUERIES) return all;
  const dayNumber = Math.floor(day.getTime() / 86_400_000);
  const start = (dayNumber * MAX_QUERIES) % all.length;
  return Array.from({ length: MAX_QUERIES }, (_, index) => all[(start + index) % all.length]);
}

type JSearchJob = {
  job_title?: string | null;
  employer_name?: string | null;
  job_publisher?: string | null;
  job_apply_link?: string | null;
  job_description?: string | null;
  job_is_remote?: boolean | null;
  job_location?: string | null;
  job_city?: string | null;
  job_country?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
  job_posted_at_datetime_utc?: string | null;
};

/** "LinkedIn" → "linkedin", "JobStreet Philippines" → "jobstreet": the names stage 6 blocks auto-applying on. */
function siteName(publisher: string) {
  const known = ["linkedin", "indeed", "jobstreet", "glassdoor"].find((site) => publisher.toLowerCase().includes(site));
  return known ?? publisher.toLowerCase().trim();
}

/** Salaries are compared yearly (the owner's floor is yearly), so monthly pay is scaled; other periods are dropped. */
function yearly(amount: number | null | undefined, period: string | null | undefined) {
  if (amount == null) return null;
  if (!period || period.toUpperCase() === "YEAR") return amount;
  if (period.toUpperCase() === "MONTH") return amount * 12;
  return null;
}

// The live /search-v2 answer (recorded 2026-09-29, worker/fixtures/jsearch.json) nests jobs in
// `data.jobs`, not `data` as the docs said.
type JSearchAnswer = { data?: { jobs?: JSearchJob[] } };

/**
 * `remoteSearch`: the search asked JSearch for work-from-home jobs only. JSearch marked every result
 * `job_is_remote: false` in the recorded answer anyway, so its filter is trusted instead; Claude still
 * reads the description and catches any that aren't really remote.
 */
export function parseJSearch(body: JSearchAnswer, remoteSearch = false): Posting[] {
  return (body.data?.jobs ?? [])
    .filter((job) => job.job_apply_link && job.job_title && job.employer_name)
    .map((job) => {
      const min = yearly(job.job_min_salary, job.job_salary_period);
      const max = yearly(job.job_max_salary, job.job_salary_period);
      return {
        site: siteName(job.job_publisher || "jsearch"),
        url: job.job_apply_link!,
        company: decodeEntities(job.employer_name!).trim(),
        role: decodeEntities(job.job_title!).trim(),
        location: job.job_location?.trim() || [job.job_city, job.job_country].filter(Boolean).join(", ") || null,
        description: job.job_description?.trim() ?? "",
        salary_min: min,
        salary_max: max,
        salary_currency: min != null || max != null ? (job.job_salary_currency ?? null) : null,
        salary_raw: null,
        remote: (remoteSearch || job.job_is_remote === true) && !NOT_REMOTE.test(`${job.job_title} ${job.job_location ?? ""}`),
        posted_at: job.job_posted_at_datetime_utc ?? null,
      };
    });
}

/** Runs one search. Needs JSEARCH_API_KEY (a free RapidAPI key; see worker/README.md). */
export async function searchJSearch(search: Search, remoteOnly: boolean): Promise<Posting[]> {
  const params = new URLSearchParams({
    query: search.role,
    country: search.country,
    date_posted: "3days",
    ...(remoteOnly && { work_from_home: "true" }),
  });
  // `/search` no longer exists on the current version (v5); `/search-v2` returns the first 10 jobs.
  const response = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: { "x-rapidapi-key": process.env.JSEARCH_API_KEY!.trim(), "x-rapidapi-host": "jsearch.p.rapidapi.com" },
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 429) throw new Error("JSearch's free monthly limit is used up. It resets next month.");
  if (response.status === 401 || response.status === 403) throw new Error("JSearch refused the key. Check JSEARCH_API_KEY in worker/.env.");
  if (!response.ok) throw new Error(`JSearch answered with error ${response.status}.`);
  return parseJSearch((await response.json()) as JSearchAnswer, remoteOnly);
}
