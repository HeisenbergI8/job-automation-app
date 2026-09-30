import { STATUS_LABELS, type JobStatus } from "@/lib/jobs";

// Pale tinted fills with darker text; the palette stays muted so the green accent leads.
const COLORS: Record<JobStatus, string> = {
  found: "bg-stone-500/10 text-stone-700 ring-stone-500/20 dark:text-stone-300",
  applied: "bg-blue-500/10 text-blue-800 ring-blue-500/20 dark:text-blue-300",
  needs_manual: "bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-300",
  screening: "bg-violet-500/10 text-violet-800 ring-violet-500/20 dark:text-violet-300",
  interview: "bg-indigo-500/10 text-indigo-800 ring-indigo-500/20 dark:text-indigo-300",
  offer: "bg-emerald-600/10 text-emerald-800 ring-emerald-600/25 dark:text-emerald-300",
  rejected: "bg-red-500/10 text-red-800 ring-red-500/20 dark:text-red-300",
  ghosted: "bg-stone-500/15 text-stone-600 ring-stone-500/25 dark:text-stone-400",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
