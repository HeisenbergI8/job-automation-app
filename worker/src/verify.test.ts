import { describe, expect, it, vi } from "vitest";
import type { Fit, Ranked } from "./scoring";
import { LOOK_UP_FROM, PASS_MARK, toRemember, verifyPicks, type Checked } from "./verify";

function job(url: string, score: number, patch: Partial<Ranked> = {}): Ranked {
  return {
    site: "lever",
    url,
    company: "Acme",
    role: "AI Engineer",
    location: "Remote",
    description: "",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_raw: null,
    remote: true,
    score,
    reasons: ["From the email."],
    scoredBy: "claude-code",
    ...patch,
  };
}
const alert = (url: string, score: number, patch: Partial<Ranked> = {}) => job(url, score, { site: "linkedin", fromAlert: true, ...patch });
const scorerGiving = (fits: Record<string, Fit>) => vi.fn(async (posting: { url: string }) => fits[posting.url]);

describe("verifyPicks", () => {
  it("picks full-text jobs Claude scored at the pass mark, and nothing below it", async () => {
    const { picks, lookups } = await verifyPicks([job("a", PASS_MARK + 10), job("b", PASS_MARK), job("c", PASS_MARK - 1)], {
      scorer: null,
      lookUp: null,
      lookupsLeft: 3,
    });
    expect(picks.map((pick) => pick.url)).toEqual(["a", "b"]);
    expect(lookups).toBe(0);
  });

  it("never picks a keyword-only score or an ineligible job", async () => {
    const { picks } = await verifyPicks([job("keywords", 95, { scoredBy: "keywords" }), job("us-only", 95, { eligible: false })], {
      scorer: null,
      lookUp: null,
      lookupsLeft: 3,
    });
    expect(picks).toEqual([]);
  });

  it("scores a Gmail job again from its full posting, and sends it only if that passes", async () => {
    const lookUp = vi.fn(async (posting: Ranked) => ({ description: `Full posting for ${posting.url}` }));
    const scorer = scorerGiving({
      pass: { score: 85, reasons: ["Good fit."], eligible: true },
      fail: { score: 40, reasons: ["Asks for 5+ years; you have about 3."], eligible: true },
    });
    const { picks, jobs, lookups } = await verifyPicks([alert("pass", 60), alert("fail", 90)], { scorer, lookUp, lookupsLeft: 3 });
    expect(lookups).toBe(2);
    expect(scorer).toHaveBeenCalledWith(expect.objectContaining({ url: "fail", description: "Full posting for fail" }));
    expect(picks.map((pick) => [pick.url, pick.score, pick.fullPostingChecked])).toEqual([["pass", 85, true]]);
    // The full posting is kept, so it is saved with the job for tailoring.
    expect(picks[0].description).toBe("Full posting for pass");
    expect(jobs.find((j) => j.url === "fail")).toMatchObject({ score: 40, fullPostingChecked: true });
  });

  it("never sends a Gmail job JSearch can't find", async () => {
    const { picks, jobs } = await verifyPicks([alert("missing", 95)], {
      scorer: scorerGiving({}),
      lookUp: async () => null,
      lookupsLeft: 3,
    });
    expect(picks).toEqual([]);
    expect(jobs[0]).toMatchObject({ notFound: true });
  });

  it("spends lookups only on Gmail jobs worth one, within the day's budget, and says what was skipped", async () => {
    const lookUp = vi.fn(async () => ({ description: "Full posting." }));
    const scorer = vi.fn(async () => ({ score: 50, reasons: ["Possible."] }));
    const ranked = [alert("a", 90), alert("b", 80), alert("c", 70), alert("weak", LOOK_UP_FROM - 1)];
    const { lookups, problems, waiting } = await verifyPicks(ranked, { scorer, lookUp, lookupsLeft: 2 });
    expect(lookUp).toHaveBeenCalledTimes(2);
    expect(lookups).toBe(2);
    expect(problems).toEqual(["1 Gmail job wasn't checked: today's 2 JSearch lookups are used up."]);
    // Its email stays unread, so a later run with lookups left sees it again; the weak one isn't waiting.
    expect(waiting).toEqual(["c"]);
  });

  it("stops at three picks, without looking up more", async () => {
    const lookUp = vi.fn(async () => ({ description: "Full posting." }));
    const ranked = [job("a", 90), job("b", 85), job("c", 80), alert("d", 75)];
    const { picks } = await verifyPicks(ranked, { scorer: scorerGiving({}), lookUp, lookupsLeft: 3 });
    expect(picks.map((pick) => pick.url)).toEqual(["a", "b", "c"]);
    expect(lookUp).not.toHaveBeenCalled();
  });

  it("stops looking up once JSearch's limit is used up", async () => {
    const lookUp = vi.fn(async () => {
      throw new Error("JSearch's free monthly limit is used up. It resets next month.");
    });
    const { lookups, problems, waiting } = await verifyPicks([alert("a", 90), alert("b", 80)], { scorer: scorerGiving({}), lookUp, lookupsLeft: 3 });
    expect(lookUp).toHaveBeenCalledTimes(1);
    expect(lookups).toBe(1);
    expect(problems[0]).toContain("limit is used up");
    expect(waiting).toEqual(["a", "b"]);
  });

  it("checks no Gmail jobs without JSearch, and says so", async () => {
    const { picks, problems } = await verifyPicks([alert("a", 90)], { scorer: scorerGiving({}), lookUp: null, lookupsLeft: 0 });
    expect(picks).toEqual([]);
    expect(problems).toEqual(["1 Gmail job wasn't checked: JSearch isn't available on this run."]);
  });
});

describe("toRemember", () => {
  it("remembers what can never be sent, and keeps what may pass later", () => {
    const jobs: Checked[] = [
      job("full-text-below-pass", PASS_MARK - 1),
      job("full-text-passing", PASS_MARK),
      job("ineligible", 95, { eligible: false }),
      job("keyword-only", 10, { scoredBy: "keywords" }),
      alert("email-weak", LOOK_UP_FROM - 1),
      alert("email-worth-a-lookup", LOOK_UP_FROM),
      { ...alert("checked-below-pass", PASS_MARK - 1), fullPostingChecked: true },
      { ...alert("not-found", 90), notFound: true },
    ];
    expect(toRemember(jobs).map((j) => j.url)).toEqual(["full-text-below-pass", "ineligible", "email-weak", "checked-below-pass", "not-found"]);
  });
});
