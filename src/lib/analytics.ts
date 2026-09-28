// Stage 2 analytics, worked out from the jobs and their status events. Pure functions, so the
// numbers can be checked against a small dataset (see supabase/seed.sql and analytics.test.ts).
import { REPLY_STATUSES, type Job, type JobStatus, type StatusEvent } from "@/lib/jobs";

export type AnalyticsJob = Pick<
  Job,
  "id" | "site" | "apply_method" | "date_applied" | "salary_min" | "salary_max" | "salary_currency"
>;
export type AnalyticsEvent = Pick<StatusEvent, "job_id" | "to_status" | "changed_at">;

const DAY_MS = 86_400_000;

function applied(jobs: AnalyticsJob[]) {
  return jobs.filter((job) => job.date_applied);
}

function eventsByJob(events: AnalyticsEvent[]) {
  const byJob = new Map<string, AnalyticsEvent[]>();
  for (const event of [...events].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    byJob.set(event.job_id, [...(byJob.get(event.job_id) ?? []), event]);
  }
  return byJob;
}

/** Monday of the week containing a YYYY-MM-DD date, as YYYY-MM-DD. */
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** 2.1: applications per week, with empty weeks between the first and last filled in. */
export function applicationsPerWeek(jobs: AnalyticsJob[]) {
  const counts = new Map<string, number>();
  for (const job of applied(jobs)) {
    const week = weekStart(job.date_applied!);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const weeks = [...counts.keys()].sort();
  if (weeks.length === 0) return [];

  const result: { week: string; count: number }[] = [];
  for (let week = weeks[0]; week <= weeks.at(-1)!; ) {
    result.push({ week, count: counts.get(week) ?? 0 });
    week = new Date(Date.parse(week) + 7 * DAY_MS).toISOString().slice(0, 10);
  }
  return result;
}

const FUNNEL: { stage: JobStatus; reachedBy: JobStatus[] }[] = [
  { stage: "applied", reachedBy: [] },
  { stage: "screening", reachedBy: ["screening", "interview", "offer"] },
  { stage: "interview", reachedBy: ["interview", "offer"] },
  { stage: "offer", reachedBy: ["offer"] },
];

/** 2.2: how many applications ever reached each stage. */
export function funnel(jobs: AnalyticsJob[], events: AnalyticsEvent[]) {
  const appliedJobs = applied(jobs);
  const byJob = eventsByJob(events);
  return FUNNEL.map(({ stage, reachedBy }) => ({
    stage,
    count:
      stage === "applied"
        ? appliedJobs.length
        : appliedJobs.filter((job) => byJob.get(job.id)?.some((event) => reachedBy.includes(event.to_status))).length,
  }));
}

/** When the job was applied to, and when the company first answered (null if it never did). */
function replyTimes(job: AnalyticsJob, jobEvents: AnalyticsEvent[] = []) {
  const appliedAt = jobEvents.find((event) => event.to_status === "applied")?.changed_at ?? job.date_applied!;
  const reply = jobEvents.find((event) => REPLY_STATUSES.includes(event.to_status) && event.changed_at >= appliedAt);
  return { appliedAt, repliedAt: reply?.changed_at ?? null };
}

/** 2.3: share of applications that got any reply (a rejection counts), grouped by a field. */
export function responseRates(
  jobs: AnalyticsJob[],
  events: AnalyticsEvent[],
  groupBy: "site" | "apply_method",
) {
  const byJob = eventsByJob(events);
  const groups = new Map<string, { replied: number; total: number }>();
  for (const job of applied(jobs)) {
    const key = job[groupBy] ?? "unknown";
    const group = groups.get(key) ?? { replied: 0, total: 0 };
    group.total++;
    if (replyTimes(job, byJob.get(job.id)).repliedAt) group.replied++;
    groups.set(key, group);
  }
  return [...groups]
    .map(([group, { replied, total }]) => ({ group, replied, total, rate: replied / total }))
    .sort((a, b) => b.total - a.total || a.group.localeCompare(b.group));
}

/** 2.3: overall share of applications that got any reply. */
export function overallResponseRate(jobs: AnalyticsJob[], events: AnalyticsEvent[]) {
  const byJob = eventsByJob(events);
  const appliedJobs = applied(jobs);
  const replied = appliedJobs.filter((job) => replyTimes(job, byJob.get(job.id)).repliedAt).length;
  return { replied, total: appliedJobs.length, rate: appliedJobs.length ? replied / appliedJobs.length : 0 };
}

/** 2.4: days from applying to the first reply, for every application that got one. */
export function daysToFirstReply(jobs: AnalyticsJob[], events: AnalyticsEvent[]) {
  const byJob = eventsByJob(events);
  return applied(jobs).flatMap((job) => {
    const { appliedAt, repliedAt } = replyTimes(job, byJob.get(job.id));
    return repliedAt ? [Math.round((Date.parse(repliedAt) - Date.parse(appliedAt)) / DAY_MS)] : [];
  });
}

function median(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** 2.4: salary midpoints of applications, one spread per currency (currencies aren't mixed). */
export function salarySpread(jobs: AnalyticsJob[]) {
  const byCurrency = new Map<string, number[]>();
  for (const job of applied(jobs)) {
    if (job.salary_min == null && job.salary_max == null) continue;
    const midpoint = ((job.salary_min ?? job.salary_max!) + (job.salary_max ?? job.salary_min!)) / 2;
    const currency = job.salary_currency ?? "—";
    byCurrency.set(currency, [...(byCurrency.get(currency) ?? []), midpoint]);
  }
  return [...byCurrency]
    .map(([currency, values]) => {
      const midpoints = values.sort((a, b) => a - b);
      return { currency, midpoints, min: midpoints[0], median: median(midpoints), max: midpoints.at(-1)! };
    })
    .sort((a, b) => b.midpoints.length - a.midpoints.length);
}
