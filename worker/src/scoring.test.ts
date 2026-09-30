import { describe, expect, it, vi } from "vitest";
import claudeOutput from "../fixtures/claude-output.json";
import { CLAUDE_AT_ONCE } from "./parallel";
import { keywordFit, MAX_ALERT_REVIEWS, parseClaudeOutput, rank, type Criteria } from "./scoring";
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

  it("stops asking the scorer after two failures in a row, once the calls already started finish", async () => {
    const scorer = vi.fn(async () => {
      throw new Error("usage limit reached");
    });
    const many = Array.from({ length: CLAUDE_AT_ONCE + 3 }, (_, i) => posting({ url: `job-${i}` }));
    const { ranked, errors } = await rank(many, criteria, scorer);
    expect(scorer).toHaveBeenCalledTimes(CLAUDE_AT_ONCE);
    expect(ranked.every((job) => job.scoredBy === "keywords" && job.reasons.includes("Keyword score only."))).toBe(true);
    expect(errors).toHaveLength(CLAUDE_AT_ONCE);
  });

  it("uses keyword scores only when there is no scorer", async () => {
    const { ranked } = await rank(jobs, criteria, null, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ url: "a", score: 100, scoredBy: "keywords" });
  });
});

describe("eligibility", () => {
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
