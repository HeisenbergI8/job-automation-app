// ROADMAP 7.2: Hunter.io's free API (owner, 2026-10-02), the first place to look for people to email.
// UNVERIFIED: written from Hunter's v2 API documentation. The build sandbox couldn't reach hunter.io
// (2026-10-02), so the fixtures are built from that documentation until plan Step 8.2 records real
// answers. The JSearch parser written the same way was wrong three ways on first contact.
import { z } from "zod";

const API = "https://api.hunter.io/v2";
/** Free searches a month. Secondary sources (2025–26) say 25; unverified. HUNTER_MONTHLY_SEARCHES overrides it. */
export const DEFAULT_MONTHLY_SEARCHES = 25;

/** Hunter said no more searches: the run carries on without Hunter and says nothing about it. */
export class HunterLimitReached extends Error {}

const emailSchema = z.object({
  value: z.string(),
  type: z.string().nullish(), // "personal" or "generic"
  confidence: z.number().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  position: z.string().nullish(),
  seniority: z.string().nullish(),
  department: z.string().nullish(),
});
const domainSearchSchema = z.object({
  data: z.object({
    organization: z.string().nullish(),
    emails: z.array(emailSchema).nullish(),
  }),
});
const emailFinderSchema = z.object({
  data: z.object({
    email: z.string().nullish(),
    score: z.number().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    position: z.string().nullish(),
  }),
});

export type HunterPerson = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  department: string | null;
  seniority: string | null;
  confidence: number | null;
  generic: boolean;
};
export type DomainSearch = { organization: string | null; people: HunterPerson[] };

export function parseDomainSearch(body: unknown): DomainSearch {
  const { data } = domainSearchSchema.parse(body);
  return {
    organization: data.organization ?? null,
    people: (data.emails ?? []).map((email) => ({
      email: email.value.toLowerCase(),
      firstName: email.first_name ?? null,
      lastName: email.last_name ?? null,
      position: email.position ?? null,
      department: email.department ?? null,
      seniority: email.seniority ?? null,
      confidence: email.confidence ?? null,
      generic: email.type === "generic",
    })),
  };
}

/** Null when Hunter found no address for the person. */
export function parseEmailFinder(body: unknown): HunterPerson | null {
  const { data } = emailFinderSchema.parse(body);
  if (!data.email) return null;
  return {
    email: data.email.toLowerCase(),
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    position: data.position ?? null,
    department: null,
    seniority: null,
    confidence: data.score ?? null,
    generic: false,
  };
}

async function call(path: string, params: Record<string, string>, key: string): Promise<unknown> {
  // The key goes in a header, so it never appears in a URL that ends up in an error message or a log.
  const response = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, {
    headers: { "X-API-KEY": key },
    signal: AbortSignal.timeout(30_000),
  });
  // Unverified which status means "the free searches are used up": 429 is documented as too many
  // requests; 402 and 403 are treated the same until a real answer is recorded (Step 8.2).
  if ([402, 403, 429].includes(response.status)) throw new HunterLimitReached(`Hunter refused the search (${response.status}).`);
  if (response.status === 401) throw new Error("Hunter refused the key. Check HUNTER_API_KEY in worker/.env.");
  if (!response.ok) throw new Error(`Hunter answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

export async function domainSearch(domain: string, key: string) {
  return parseDomainSearch(await call("domain-search", { domain, limit: "10" }, key));
}

export async function emailFinder(domain: string, firstName: string, lastName: string, key: string) {
  return parseEmailFinder(await call("email-finder", { domain, first_name: firstName, last_name: lastName }, key));
}

/**
 * Searches allowed today (owner decision D2): what's left of the month, spread evenly over
 * the days left, counting from the 1st (UTC; when Hunter really resets is unknown).
 */
export function searchesAllowedToday(monthlyLimit: number, usedThisMonth: number, usedToday: number, now: Date) {
  const leftAtStartOfDay = Math.max(0, monthlyLimit - (usedThisMonth - usedToday));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  return Math.max(0, Math.ceil(leftAtStartOfDay / daysLeft) - usedToday);
}
