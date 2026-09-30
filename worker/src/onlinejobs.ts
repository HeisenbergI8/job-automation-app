// OnlineJobs.ph (owner request, 2026-09-30). Besides its alert emails (alerts.ts), the finder reads
// its public job search, which its robots.txt allows (with a 5-second crawl delay) and its llms.txt
// lists as a main page; its Terms of Service were not checked (the owner was asked to). One search per
// target role, newest first, 30 jobs per search.
import { decodeEntities, htmlToText, NOT_REMOTE, type Posting } from "./sources";

const BASE = "https://www.onlinejobs.ph";
/** robots.txt: "Crawl-delay: 5". */
const CRAWL_DELAY_MS = 5_000;
export const MAX_SEARCHES = 5;

const MONEY = /(PHP|USD|₱|\$)\s?(\d+(?:\.\d+)?)(k)?(?:\s*(?:-|–|to)\s*(?:PHP|USD|₱|\$)?\s?(\d+(?:\.\d+)?)(k)?)?/i;
const NO_PAY = { salary_min: null, salary_max: null, salary_currency: null };

/**
 * Pay as written on OnlineJobs.ph ("Up to PHP 30,000/month", "$5 to $8 per hour", "₱25k monthly") as
 * yearly amounts, since the owner's floor is yearly. Hourly pay can't be compared, so it's left out.
 */
export function parsePay(text: string) {
  const match = text.replace(/,/g, "").match(MONEY);
  if (!match) return NO_PAY;
  if (/\b(hour|hr|hourly)\b|\/h\b|\dhr/i.test(text)) return NO_PAY;
  const perYear = /\b(year|yr|annual|annually)\b/i.test(text) ? 1 : /\b(week|weekly|wk)\b/i.test(text) ? 52 : 12;
  const amount = (value: string | undefined, thousands: string | undefined) =>
    value ? Number(value) * (thousands ? 1000 : 1) * perYear : null;
  const low = amount(match[2], match[3]);
  const high = amount(match[4], match[5]);
  const currency = /USD|\$/.test(match[1]) ? "USD" : "PHP";
  if (/up to/i.test(text)) return { salary_min: null, salary_max: high ?? low, salary_currency: currency };
  return { salary_min: low, salary_max: high, salary_currency: currency };
}

/** Reads the job cards on a search results page. Each job's link appears twice; it's kept once. */
export function parseOnlineJobsSearch(html: string): Posting[] {
  // A job links to itself more than once (title and "See More"), so the pieces between links to the
  // same job are joined back into one card.
  const cards = new Map<string, string>();
  for (const piece of html.split('<a href="/jobseekers/job/').slice(1)) {
    const slug = piece.slice(0, piece.indexOf('"'));
    // The split removed '<a href="/jobseekers/job/'; it's put back so the markup stays whole.
    if (/-\d+$/.test(slug)) cards.set(slug, `${cards.get(slug) ?? ""}<a href="/jobseekers/job/${piece}`);
  }
  const postings = new Map<string, Posting>();
  for (const [slug, card] of cards) {
    const title = card.match(/<h4[^>]*>([\s\S]*?)<span/)?.[1] ?? card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1];
    if (!title) continue;
    // data-temp-2 is the posting time in UTC (data-temp is Philippine time, 8 hours ahead).
    const posted = card.match(/data-temp-2="([\d-]+ [\d:]+)"/)?.[1];
    const pay = htmlToText(card.match(/<dd class="col">([\s\S]*?)<\/dd>/)?.[1] ?? "");
    const description = htmlToText(card.match(/<div class="desc[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? "")
      .replace(/\s*See More$/i, "")
      .trim();
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
      // OnlineJobs.ph is for remote work from the Philippines, unless the title says otherwise.
      remote: !NOT_REMOTE.test(htmlToText(title)),
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
