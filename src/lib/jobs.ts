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
