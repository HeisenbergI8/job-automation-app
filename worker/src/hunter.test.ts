import { afterEach, describe, expect, it, vi } from "vitest";
import domainFixture from "../fixtures/hunter-domain-search.json";
import finderFixture from "../fixtures/hunter-email-finder.json";
import { domainSearch, HunterLimitReached, parseDomainSearch, parseEmailFinder, searchesAllowedToday } from "./hunter";

afterEach(() => vi.unstubAllGlobals());

describe("Hunter parsers (DOCUMENTATION-BASED fixture, not yet a recorded answer)", () => {
  it("reads people, the organization and which addresses are generic from a domain search", () => {
    const result = parseDomainSearch(domainFixture);
    expect(result.organization).toBe("Mail Co");
    expect(result.people).toHaveLength(4);
    expect(result.people[1]).toMatchObject({ email: "ben.ong@mail.test", position: "Engineering Manager, Platform", confidence: 88, generic: false });
    expect(result.people[3]).toMatchObject({ email: "careers@mail.test", generic: true });
  });

  it("reads one person from the email finder, and null when it found none", () => {
    expect(parseEmailFinder(finderFixture)).toMatchObject({ email: "ana.cruz@mail.test", confidence: 92 });
    expect(parseEmailFinder({ data: { email: null, score: null } })).toBeNull();
  });

  it("treats missing optional fields as empty but a missing data object as an error", () => {
    expect(parseDomainSearch({ data: {} }).people).toEqual([]);
    expect(() => parseDomainSearch({ errors: [{ id: "x" }] })).toThrow();
  });
});

describe("calling Hunter", () => {
  it("sends the key in a header, never in the URL", async () => {
    const fetchMock = vi.fn(async () => Response.json(domainFixture));
    vi.stubGlobal("fetch", fetchMock);
    await domainSearch("mail.test", "secret-key");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.hunter.io/v2/domain-search?domain=mail.test&limit=10");
    expect(url).not.toContain("secret-key");
    expect(new Headers(init.headers).get("X-API-KEY")).toBe("secret-key");
  });

  it("reports the free limit as HunterLimitReached, so the run can carry on quietly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(domainSearch("mail.test", "k")).rejects.toBeInstanceOf(HunterLimitReached);
  });
});

describe("searchesAllowedToday (owner decision D2)", () => {
  it("spreads what's left of the month over the days left", () => {
    expect(searchesAllowedToday(25, 0, 0, new Date("2026-10-01T03:00:00Z"))).toBe(1); // 25 over 31 days
    expect(searchesAllowedToday(25, 10, 0, new Date("2026-10-27T03:00:00Z"))).toBe(3); // 15 over 5 days
    expect(searchesAllowedToday(25, 11, 1, new Date("2026-10-27T03:00:00Z"))).toBe(2); // 1 already used today
    expect(searchesAllowedToday(25, 25, 0, new Date("2026-10-27T03:00:00Z"))).toBe(0);
  });
});
