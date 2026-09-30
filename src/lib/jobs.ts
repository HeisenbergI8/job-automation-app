import { Constants, type Enums, type Tables } from "@/lib/supabase/types";

export type Job = Tables<"jobs">;
export type JobStatus = Enums<"job_status">;
export type StatusEvent = Tables<"job_status_events">;

export const JOB_STATUSES = Constants.public.Enums.job_status;

export const STATUS_LABELS: Record<JobStatus, string> = {
  found: "Found",
  applied: "Applied",
  needs_manual: "Needs manual",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

/** Statuses that mean the company answered. */
export const REPLY_STATUSES: JobStatus[] = ["screening", "interview", "offer", "rejected"];

export function formatSalary(job: Pick<Job, "salary_min" | "salary_max" | "salary_currency" | "salary_raw">) {
  const { salary_min: min, salary_max: max, salary_currency: currency } = job;
  if (min == null && max == null) return job.salary_raw ?? "—";
  const format = (value: number) =>
    new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const range = min != null && max != null && min !== max ? `${format(min)}–${format(max)}` : format((min ?? max)!);
  return currency ? `${currency} ${range}` : range;
}

// The owner is in the Philippines. Times are shown in their clock, not the server's: Vercel renders
// in UTC, which would put a 10:30 PM find at 2:30 PM.
export const OWNER_TIME_ZONE = "Asia/Manila";

/**
 * When a job was found, to the minute: "Today, 10:30 PM", "Yesterday, 9:05 AM", "Sep 28, 10:30 PM",
 * with the year only when it isn't this year. Takes a timestamp such as jobs.created_at.
 */
export function formatFoundAt(value: string, now = new Date()) {
  const zone = { timeZone: OWNER_TIME_ZONE };
  const day = (date: Date) => date.toLocaleDateString("en-CA", zone);
  const found = new Date(value);
  const time = found.toLocaleTimeString("en-US", { ...zone, hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day(found) === day(now)) return `Today, ${time}`;
  if (day(found) === day(yesterday)) return `Yesterday, ${time}`;
  const sameYear = day(found).slice(0, 4) === day(now).slice(0, 4);
  const date = found.toLocaleDateString("en-US", { ...zone, month: "short", day: "numeric", ...(!sameYear && { year: "numeric" }) });
  return `${date}, ${time}`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  // Date-only values are calendar dates; format them without shifting through a timezone.
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return date.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(value.length === 10 && { timeZone: "UTC" }),
  });
}
