import { describe, expect, it, vi } from "vitest";
import claudeOutput from "../fixtures/claude-output.json";
import { keywordFit, MAX_ALERT_REVIEWS, MIN_FIT, parseClaudeOutput, pickTop, rank, rejectedByClaude, type Criteria, type Ranked } from "./scoring";
import type { Posting } from "./sources";

const criteria: Criteria = {
  target_roles: ["Frontend Engineer"],
  locations: ["Manila"],
  remote_preference: "remote",
  salary_floor: 100000,
  salary_currency: "USD",
  must_have_keywords: ["React", "TypeScript"],
  excluded_keywords: ["PHP"],
};

const posting = (overrides: Partial<Posting> = {}): Posting => ({
  site: "lever",
  url: "https://jobs.lever.co/acme/1",
  company: "Acme",
  role: "Senior Frontend Engineer",
  location: "Remote",
  description: "We use React and TypeScript.",
  salary_min: 120000,
  salary_max: 150000,
  salary_currency: "USD",
  salary_raw: null,
  remote: true,
  ...overrides,
});

describe("keywordFit", () => {
  it("gives full marks to a job that meets every criterion", () => {
    expect(keywordFit(posting(), criteria).score).toBe(100);
  });

  it("scores an excluded keyword as a dealbreaker", () => {
    const fit = keywordFit(posting({ description: "React, TypeScript and some PHP." }), criteria);
    expect(fit).toEqual({ score: 0, reasons: ['Mentions "PHP", which you excluded.'] });
  });

  it("scores pay below the floor as a dealbreaker, but only in the same currency", () => {
    expect(keywordFit(posting({ salary_min: 60000, salary_max: 80000 }), criteria).score).toBe(0);
    expect(keywordFit(posting({ salary_min: 60000, salary_max: 80000, salary_currency: "EUR" }), criteria).score).toBe(95);
  });

  it("names the missing must-haves", () => {
    const fit = keywordFit(posting({ description: "We use React." }), criteria);
    expect(fit.score).toBe(85);
    expect(fit.reasons).toContain("Has 1 of 2 must-have keywords (missing: TypeScript).");
  });

  it("treats an office job as a dealbreaker when the owner wants remote only", () => {
    expect(keywordFit(posting({ remote: false, location: "San Francisco" }), criteria)).toEqual({
      score: 0,
      reasons: ["Not remote, and you want remote only."],
    });
  });

  it("gives full location points only to remote jobs open to the owner's locations", () => {
    expect(keywordFit(posting({ location: "Remote, Global" }), criteria).score).toBe(100);
    expect(keywordFit(posting({ location: "Remote - Manila" }), criteria).score).toBe(100);
    const usOnly = keywordFit(posting({ location: "Remote, US" }), criteria);
    expect(usOnly.score).toBe(85);
    expect(usOnly.reasons).toContain("Remote, but it may be limited to Remote, US.");
  });

  it("is neutral when the owner has set no criteria", () => {
    const none: Criteria = { ...criteria, target_roles: [], locations: [], remote_preference: "any", salary_floor: null, must_have_keywords: [], excluded_keywords: [] };
    expect(keywordFit(posting({ remote: false, location: "Cebu" }), none).score).toBe(50);
  });
});

describe("parseClaudeOutput", () => {
  it("reads the structured answer from a real Claude Code envelope", () => {
    expect(parseClaudeOutput(JSON.stringify(claudeOutput))).toMatchObject({ score: 88 });
  });

  it("throws when Claude Code reports an error", () => {
    const failed = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "rate limited" });
    expect(() => parseClaudeOutput(failed)).toThrow("rate limited");
  });

  it("throws when the answer doesn't match the schema", () => {
    const bad = JSON.stringify({ ...claudeOutput, structured_output: { score: 140, reasons: [] } });
    expect(() => parseClaudeOutput(bad)).toThrow();
  });
});

describe("rank", () => {
  const jobs = [
    posting({ url: "a", role: "Frontend Engineer" }),
    posting({ url: "b", role: "Frontend Engineer", description: "React only." }),
    posting({ url: "c", role: "Frontend Engineer", description: "PHP shop." }),
  ];

  it("drops dealbreakers and puts the scorer's best first", async () => {
    const scorer = vi.fn(async (job: Posting) => ({ score: job.url === "b" ? 90 : 60, reasons: ["ok"] }));
    const { ranked, errors } = await rank(jobs, criteria, scorer);
    expect(ranked.map((job) => [job.url, job.score, job.scoredBy])).toEqual([["b", 90, "claude-code"], ["a", 60, "claude-code"]]);
    expect(errors).toEqual([]);
  });

  it("falls back to keyword scores after two failures in a row", async () => {
    const scorer = vi.fn(async () => {
      throw new Error("usage limit reached");
    });
    const { ranked, errors } = await rank([...jobs, posting({ url: "d" })], criteria, scorer);
    expect(scorer).toHaveBeenCalledTimes(2);
    expect(ranked.every((job) => job.scoredBy === "keywords" && job.reasons.includes("Keyword score only."))).toBe(true);
    expect(errors).toHaveLength(2);
  });

  it("uses keyword scores only when there is no scorer", async () => {
    const { ranked } = await rank(jobs, criteria, null, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ url: "a", score: 100, scoredBy: "keywords" });
  });
});

describe("rejectedByClaude", () => {
  const job = (url: string, score: number, scoredBy: Ranked["scoredBy"]) => ({ ...posting({ url }), score, reasons: [], scoredBy }) as Ranked;

  it("remembers only jobs Claude scored below the minimum", () => {
    const ranked = [job("good-but-4th", 90, "claude-code"), job("rejected", MIN_FIT - 1, "claude-code"), job("keyword-only", 10, "keywords")];
    expect(rejectedByClaude(ranked).map((j) => j.url)).toEqual(["rejected"]);
  });
});

describe("pickTop", () => {
  const scored = (url: string, score: number) => ({ ...posting({ url }), score, reasons: [], scoredBy: "claude-code" }) as Ranked;

  it("keeps at most three jobs, all at or above the minimum", () => {
    const ranked = [scored("a", 95), scored("b", 90), scored("c", 85), scored("d", 80)];
    expect(pickTop(ranked).map((job) => job.url)).toEqual(["a", "b", "c"]);
  });

  it("saves fewer than three when too few jobs reach the minimum", () => {
    expect(pickTop([scored("a", 92), scored("b", MIN_FIT), scored("c", MIN_FIT - 1)]).map((job) => job.url)).toEqual(["a", "b"]);
  });

  it("picks nothing when no job reaches the minimum", () => {
    expect(pickTop([scored("a", MIN_FIT - 1), scored("b", 10)])).toEqual([]);
    expect(pickTop([])).toEqual([]);
  });

  const at = (url: string, score: number, site: string) => ({ ...scored(url, score), site }) as Ranked;

  it("ranks OnlineJobs.ph after the other three priority sites", () => {
    // Best first, as rank returns them: the company-page job outscores the OnlineJobs.ph one.
    const ranked = [at("careers", 95, "greenhouse"), at("online", 90, "onlinejobs"), at("indeed", 82, "indeed")];
    expect(pickTop(ranked).map((job) => job.url)).toEqual(["indeed", "online", "careers"]);
  });

  it("puts LinkedIn, JobStreet and Indeed first, in that order, even above a higher score elsewhere", () => {
    const ranked = [at("careers", 95, "greenhouse"), at("indeed", 90, "indeed"), at("linkedin", 85, "linkedin"), at("jobstreet", 81, "jobstreet")];
    expect(pickTop(ranked).map((job) => job.url)).toEqual(["linkedin", "jobstreet", "indeed"]);
  });

  it("fills with other sites, one per site first, when the priority sites have too few", () => {
    const ranked = [at("gh1", 95, "greenhouse"), at("gh2", 90, "greenhouse"), at("glass", 85, "glassdoor"), at("linkedin", 80, "linkedin")];
    expect(pickTop(ranked).map((job) => job.url)).toEqual(["linkedin", "gh1", "glass"]);
  });
});

describe("eligibility", () => {
  const job = (url: string, score: number, eligible?: boolean) => ({ ...posting({ url }), score, reasons: [], scoredBy: "claude-code", eligible }) as Ranked;

  it("never picks a job the owner can't apply for", () => {
    expect(pickTop([job("us-only", 95, false), job("ok", 85)]).map((j) => j.url)).toEqual(["ok"]);
    expect(pickTop([job("us-only", 95, false)])).toEqual([]);
  });

  it("remembers ineligible jobs so they aren't reviewed again", () => {
    expect(rejectedByClaude([job("us-only", 90, false), job("good", 90, true)]).map((j) => j.url)).toEqual(["us-only"]);
  });

  it("reads eligibility from Claude's answer", () => {
    const answer = JSON.stringify({ ...claudeOutput, structured_output: { score: 12, reasons: ["US residents only."], eligible: false } });
    expect(parseClaudeOutput(answer)).toEqual({ score: 12, reasons: ["US residents only."], eligible: false });
  });
});

describe("jobs from the owner's alert emails", () => {
  const careers = Array.from({ length: 30 }, (_, i) => posting({ url: `careers-${i}`, site: "greenhouse" }));
  const alert = (i: number) => posting({ url: `alert-${i}`, site: "linkedin", fromAlert: true, description: "Short alert." });

  it("are all reviewed, on top of the usual shortlist", async () => {
    const alerts = Array.from({ length: 10 }, (_, i) => alert(i));
    const scorer = vi.fn(async () => ({ score: 60, reasons: ["ok"] }));
    const { ranked, unreviewedAlerts } = await rank([...careers, ...alerts], criteria, scorer, 12);
    expect(ranked.filter((job) => job.fromAlert)).toHaveLength(10);
    expect(ranked).toHaveLength(22);
    expect(unreviewedAlerts).toEqual([]);
  });

  it("past the cap wait for the next run", async () => {
    const alerts = Array.from({ length: MAX_ALERT_REVIEWS + 3 }, (_, i) => alert(i));
    const { unreviewedAlerts } = await rank(alerts, criteria, null, 12);
    expect(unreviewedAlerts).toHaveLength(3);
  });
});

describe("rank's shortlist", () => {
  it("always reviews the best few from each priority site, even when other sites score higher", async () => {
    const many = Array.from({ length: 20 }, (_, i) => posting({ url: `careers-${i}`, site: "greenhouse" }));
    const linkedin = posting({ url: "linkedin-1", site: "linkedin", description: "React only." });
    const { ranked } = await rank([...many, linkedin], criteria, null, 12);
    expect(ranked).toHaveLength(12);
    expect(ranked.some((job) => job.url === "linkedin-1")).toBe(true);
  });
});
