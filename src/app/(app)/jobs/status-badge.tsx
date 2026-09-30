import { STATUS_LABELS, type JobStatus } from "@/lib/jobs";

// Colour is spent on meaning only: green for an offer, amber for "needs you", red for rejected,
// brand for in-flight. Every badge also carries its label, so colour is never the only signal.
const TONES: Record<JobStatus, string> = {
  found: "bg-surface-muted text-foreground/75",
  needs_manual: "bg-warn-soft text-warn",
  applied: "bg-accent-soft text-accent",
  screening: "bg-accent-soft text-accent",
  interview: "bg-accent-soft text-accent",
  offer: "bg-good-soft text-good",
  rejected: "bg-danger-soft text-danger",
  ghosted: "bg-surface-muted text-muted",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONES[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
