import { STATUS_LABELS, type JobStatus } from "@/lib/jobs";

const COLORS: Record<JobStatus, string> = {
  found: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  applied: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  needs_manual: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  screening: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  interview: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  offer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  ghosted: "bg-stone-500/15 text-stone-600 dark:text-stone-400",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
