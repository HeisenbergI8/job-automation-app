import { describe, expect, it } from "vitest";
import {
  applicationsPerWeek,
  daysToFirstReply,
  funnel,
  overallResponseRate,
  responseRates,
  salarySpread,
  weekStart,
  type AnalyticsEvent,
  type AnalyticsJob,
} from "./analytics";
import type { JobStatus } from "./jobs";

// The same history as supabase/seed.sql, whose header lists these expected numbers.
type Row = [id: string, site: string, method: "auto" | "manual" | null, applied: string | null, salary: [number, number] | null, history: [JobStatus, string][]];
const ROWS: Row[] = [
  ["1", "greenhouse", "auto", "2026-08-03", [90000, 110000], [["found", "08-01"], ["applied", "08-03"], ["screening", "08-06"], ["interview", "08-12"], ["offer", "08-20"]]],
  ["2", "lever", "auto", "2026-08-04", [80000, 100000], [["found", "08-02"], ["applied", "08-04"], ["rejected", "08-09"]]],
  ["3", "linkedin", "manual", "2026-08-06", [70000, 90000], [["found", "08-05"], ["needs_manual", "08-05"], ["applied", "08-06"], ["screening", "08-10"], ["rejected", "08-15"]]],
  ["4", "ashby", "auto", "2026-08-11", [100000, 130000], [["found", "08-10"], ["applied", "08-11"], ["ghosted", "09-01"]]],
  ["5", "indeed", "manual", "2026-08-13", null, [["found", "08-12"], ["needs_manual", "08-12"], ["applied", "08-13"], ["screening", "08-20"], ["interview", "08-27"]]],
  ["6", "greenhouse", "auto", "2026-08-18", [120000, 150000], [["found", "08-17"], ["applied", "08-18"]]],
  ["7", "lever", "manual", "2026-08-19", [60000, 80000], [["found", "08-18"], ["applied", "08-19"], ["screening", "08-24"]]],
  ["8", "jobstreet", null, null, null, [["found", "08-25"], ["needs_manual", "08-25"]]],
  ["9", "ashby", "auto", "2026-08-26", [95000, 105000], [["found", "08-25"], ["applied", "08-26"], ["rejected", "08-28"]]],
  ["10", "greenhouse", null, null, null, [["found", "09-20"]]],
];

const jobs: AnalyticsJob[] = ROWS.map(([id, site, method, applied, salary]) => ({
  id,
  site,
  apply_method: method,
  date_applied: applied,
  salary_min: salary?.[0] ?? null,
  salary_max: salary?.[1] ?? null,
  salary_currency: salary ? "USD" : null,
}));
const events: AnalyticsEvent[] = ROWS.flatMap(([id, , , , , history]) =>
  history.map(([status, day], index) => ({
    job_id: id,
    to_status: status,
    changed_at: `2026-${day}T01:00:${String(index).padStart(2, "0")}+00:00`,
  })),
);

describe("analytics on the seed dataset", () => {
  it("counts applications per week, starting Monday", () => {
    expect(weekStart("2026-08-06")).toBe("2026-08-03");
    expect(weekStart("2026-08-03")).toBe("2026-08-03");
    expect(applicationsPerWeek(jobs)).toEqual([
      { week: "2026-08-03", count: 3 },
      { week: "2026-08-10", count: 2 },
      { week: "2026-08-17", count: 2 },
      { week: "2026-08-24", count: 1 },
    ]);
  });

  it("fills empty weeks with zero", () => {
    const sparse = jobs.filter((job) => ["1", "9"].includes(job.id));
    expect(applicationsPerWeek(sparse).map((week) => week.count)).toEqual([1, 0, 0, 1]);
  });

  it("builds the funnel from the status events", () => {
    expect(funnel(jobs, events)).toEqual([
      { stage: "applied", count: 8 },
      { stage: "screening", count: 4 },
      { stage: "interview", count: 2 },
      { stage: "offer", count: 1 },
    ]);
  });

  it("works out response rates overall, by site and by apply method", () => {
    expect(overallResponseRate(jobs, events)).toEqual({ replied: 6, total: 8, rate: 0.75 });
    const bySite = Object.fromEntries(responseRates(jobs, events, "site").map((r) => [r.group, `${r.replied}/${r.total}`]));
    expect(bySite).toEqual({ greenhouse: "1/2", lever: "2/2", linkedin: "1/1", ashby: "1/2", indeed: "1/1" });
    const byMethod = Object.fromEntries(responseRates(jobs, events, "apply_method").map((r) => [r.group, r.rate]));
    expect(byMethod).toEqual({ auto: 0.6, manual: 1 });
  });

  it("measures days to first reply", () => {
    const days = daysToFirstReply(jobs, events);
    expect(days).toEqual([3, 5, 4, 7, 5, 2]);
    expect(days.reduce((a, b) => a + b) / days.length).toBeCloseTo(4.33, 2);
  });

  it("spreads salary midpoints per currency", () => {
    expect(salarySpread(jobs)).toEqual([
      { currency: "USD", midpoints: [70000, 80000, 90000, 100000, 100000, 115000, 135000], min: 70000, median: 100000, max: 135000 },
    ]);
  });
});
