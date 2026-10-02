// ROADMAP 5.3 (owner request 2026-09-29): LinkedIn, Indeed, JobStreet and other boards, read through
// JSearch (RapidAPI), which collects them from Google for Jobs. The finder never visits those sites
// itself: it only reads JSearch's results and passes on the links. JSearch's free plan is 200
// requests a month. Owner's split (2026-09-30): MAX_QUERIES searches a day, rotating through the
// combinations, and up to LOOKUPS_PER_DAY lookups of Gmail jobs' full postings (verify.ts), 180 a month.
import type { Criteria } from "./scoring";
import { decodeEntities, NOT_REMOTE, type Posting } from "./sources";

export const MAX_QUERIES = 3;
export const LOOKUPS_PER_DAY = 3;

// JSearch country codes for the location names the owner is likely to type in Settings.
const COUNTRY_CODES: Record<string, string> = {
  philippines: "ph", singapore: "sg", australia: "au", "united kingdom": "gb", uk: "gb", malaysia: "my",
  "new zealand": "nz", "united states": "us", usa: "us", canada: "ca", india: "in", japan: "jp",
  "hong kong": "hk", indonesia: "id", vietnam: "vn", thailand: "th", germany: "de", ireland: "ie",
};

export type Search = { role: string; country: string };

/** Today's searches: every target role in every country the owner listed, rotated by day, at most `max`. */
export function todaysSearches(criteria: Pick<Criteria, "target_roles" | "locations">, day = new Date(), max = MAX_QUERIES) {
  const countries = [...new Set(criteria.locations.map((place) => COUNTRY_CODES[place.trim().toLowerCase()]).filter(Boolean))];
  const all: Search[] = criteria.target_roles.flatMap((role) => (countries.length ? countries : ["ph"]).map((country) => ({ role, country })));
  if (all.length <= max) return all;
  const dayNumber = Math.floor(day.getTime() / 86_400_000);
  const start = (dayNumber * max) % all.length;
  return Array.from({ length: max }, (_, index) => all[(start + index) % all.length]);
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
  const known = ["linkedin", "indeed", "jobstreet", "onlinejobs", "glassdoor"].find((site) => publisher.toLowerCase().includes(site));
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

/** One JSearch request. Needs JSEARCH_API_KEY (a free RapidAPI key; see worker/README.md). */
async function request(params: URLSearchParams): Promise<JSearchAnswer> {
  // `/search` no longer exists on the current version (v5); `/search-v2` returns the first 10 jobs.
  const response = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: { "x-rapidapi-key": process.env.JSEARCH_API_KEY!.trim(), "x-rapidapi-host": "jsearch.p.rapidapi.com" },
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 429) throw new Error("JSearch's free monthly limit is used up. It resets next month.");
  if (response.status === 401 || response.status === 403) throw new Error("JSearch refused the key. Check JSEARCH_API_KEY in worker/.env.");
  if (!response.ok) throw new Error(`JSearch answered with error ${response.status}.`);
  return (await response.json()) as JSearchAnswer;
}

/** Runs one search. */
export async function searchJSearch(search: Search, remoteOnly: boolean): Promise<Posting[]> {
  const params = new URLSearchParams({
    query: search.role,
    country: search.country,
    date_posted: "3days",
    ...(remoteOnly && { work_from_home: "true" }),
  });
  return parseJSearch(await request(params), remoteOnly);
}

const COMPANY_SUFFIX = /\b(inc|llc|ltd|limited|corp|corporation|co|company|pte|pty|plc|gmbh|the)\b/g;
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 1) ?? []);

/** "White Cloak Technologies, Inc." and "White Cloak Technologies" are the same company. */
export function sameCompany(a: string, b: string) {
  const clean = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(COMPANY_SUFFIX, " ").replace(/\s+/g, " ").trim();
  const [x, y] = [clean(a), clean(b)];
  return x.length >= 2 && y.length >= 2 && (x === y || x.includes(y) || y.includes(x));
}

// Words that make two otherwise alike titles different jobs: "Junior" and "Senior Frontend Developer".
const SENIORITY: Record<string, string> = {
  junior: "junior", jr: "junior", entry: "junior", intern: "intern", internship: "intern", mid: "mid", associate: "associate",
  senior: "senior", sr: "senior", lead: "lead", staff: "staff", principal: "principal", head: "head",
  manager: "manager", director: "director", chief: "chief", vp: "vp",
};
const seniority = (title: string) => [...new Set([...words(title)].map((word) => SENIORITY[word]).filter(Boolean))].sort().join(",");

/** Share of the shorter title's words that the other title has too. */
export function titleOverlap(a: string, b: string) {
  const [x, y] = [words(a), words(b)];
  if (!x.size || !y.size) return 0;
  return shared(x, y) / Math.min(x.size, y.size);
}
const shared = (x: Set<string>, y: Set<string>) => [...x].filter((word) => y.has(word)).length;

/**
 * The JSearch result that is the same job: same company, the same seniority, most of the shorter
 * title in the other and at least half of the longer one. A one-word title ("Engineer") is too vague
 * to match anything: better not found than scored against another job's requirements.
 */
export function findSamePosting(job: Pick<Posting, "company" | "role">, results: Posting[]) {
  if (words(job.role).size < 2) return null;
  const matches = results
    .filter((result) => sameCompany(job.company, result.company) && seniority(job.role) === seniority(result.role))
    .map((result) => {
      const [x, y] = [words(job.role), words(result.role)];
      const common = shared(x, y);
      return { result, overlap: common / Math.min(x.size, y.size), cover: common / Math.max(x.size, y.size) };
    })
    .filter(({ overlap, cover }) => overlap >= 0.6 && cover >= 0.5)
    .sort((a, b) => b.overlap - a.overlap);
  return matches[0]?.result ?? null;
}

/**
 * Finds a Gmail alert job on JSearch to read its full posting (verify.ts). One request. Returns null
 * when JSearch has no posting that is clearly the same job.
 */
export async function lookUpPosting(job: Pick<Posting, "company" | "role" | "location">, ownerLocations: string[]) {
  const places = [job.location ?? "", ...ownerLocations].map((place) => place.toLowerCase());
  const country = Object.entries(COUNTRY_CODES).find(([name]) => places.some((place) => place.includes(name)))?.[1] ?? "ph";
  const params = new URLSearchParams({ query: `${job.role} ${job.company}`, country, date_posted: "week" });
  return findSamePosting(job, parseJSearch(await request(params)));
}
