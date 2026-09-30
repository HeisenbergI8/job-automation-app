// OnlineJobs.ph (owner request, 2026-09-30): it has no job-alert emails, so the finder reads its
// public job search, which its robots.txt allows (with a 5-second crawl delay) and its llms.txt lists
// as a main page. One search per target role, newest first, 30 jobs per search.
import { decodeEntities, htmlToText, type Posting } from "./sources";

const BASE = "https://www.onlinejobs.ph";
/** robots.txt: "Crawl-delay: 5". */
const CRAWL_DELAY_MS = 5_000;
export const MAX_SEARCHES = 5;

/** "Up to PHP 30,000/month" → yearly PHP amounts, since the owner's floor is yearly. */
export function parsePay(text: string) {
  const match = text.replace(/,/g, "").match(/(PHP|USD|₱|\$)\s?(\d+)(?:\s*-\s*(?:PHP|USD|₱|\$)?\s?(\d+))?\s*\/?\s*(month|mo|hour|hr|year|yr)?/i);
  if (!match) return { salary_min: null, salary_max: null, salary_currency: null };
  const currency = /USD|\$/.test(match[1]) ? "USD" : "PHP";
  const period = (match[4] ?? "month").toLowerCase();
  const perYear = period.startsWith("y") ? 1 : period.startsWith("m") ? 12 : null; // hourly pay isn't compared
  if (!perYear) return { salary_min: null, salary_max: null, salary_currency: null };
  const low = Number(match[2]) * perYear;
  const high = match[3] ? Number(match[3]) * perYear : null;
  const upTo = /up to/i.test(text);
  return { salary_min: upTo ? null : low, salary_max: high ?? (upTo ? low : null), salary_currency: currency };
}

/** Reads the job cards on a search results page. Each job's link appears twice; it's kept once. */
export function parseOnlineJobsSearch(html: string): Posting[] {
  // A job links to itself more than once (title and "See More"), so the pieces between links to the
  // same job are joined back into one card.
  const cards = new Map<string, string>();
  for (const piece of html.split('<a href="/jobseekers/job/').slice(1)) {
    const slug = piece.slice(0, piece.indexOf('"'));
    if (/-\d+$/.test(slug)) cards.set(slug, (cards.get(slug) ?? "") + piece);
  }
  const postings = new Map<string, Posting>();
  for (const [slug, card] of cards) {
    const title = card.match(/<h4[^>]*>([\s\S]*?)<span/)?.[1] ?? card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1];
    if (!title) continue;
    // data-temp-2 is the posting time in UTC (data-temp is Philippine time, 8 hours ahead).
    const posted = card.match(/data-temp-2="([\d-]+ [\d:]+)"/)?.[1];
    const pay = htmlToText(card.match(/<dd class="col">([\s\S]*?)<\/dd>/)?.[1] ?? "");
    const description = htmlToText(card.match(/<div class="desc[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const company = card.match(/class="jobpost-cat-box-logo" alt="([^"]*)"/)?.[1];
    postings.set(slug, {
      site: "onlinejobs",
      url: `${BASE}/jobseekers/job/${slug}`,
      company: decodeEntities(company ?? "").trim() || "Employer on OnlineJobs.ph",
      role: htmlToText(title).trim(),
      location: "Philippines (Remote)",
      description: [description, pay && `Pay: ${pay}`].filter(Boolean).join("\n\n"),
      ...parsePay(pay),
      salary_raw: pay && pay !== "TBD" ? pay : null,
      // OnlineJobs.ph is for remote work from the Philippines.
      remote: true,
      posted_at: posted ? `${posted.replace(" ", "T")}Z` : null,
    });
  }
  return [...postings.values()];
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One search per target role (at most MAX_SEARCHES), 5 seconds apart as robots.txt asks. */
export async function searchOnlineJobs(roles: string[], errors: string[], delayMs = CRAWL_DELAY_MS) {
  const postings: Posting[] = [];
  for (const [index, role] of roles.slice(0, MAX_SEARCHES).entries()) {
    if (index) await pause(delayMs);
    try {
      const response = await fetch(`${BASE}/jobseekers/jobsearch?${new URLSearchParams({ jobkeyword: role })}`, {
        headers: { "user-agent": "Mozilla/5.0 (Macintosh) personal-job-finder/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`answered with error ${response.status}`);
      postings.push(...parseOnlineJobsSearch(await response.text()));
    } catch (error) {
      errors.push(`OnlineJobs.ph "${role}": ${(error as Error).message}`);
    }
  }
  return postings;
}
