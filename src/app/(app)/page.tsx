import Link from "next/link";
import { formatDate, JOB_STATUSES, STATUS_LABELS } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { StatusBadge } from "./jobs/status-badge";

export default async function DashboardPage() {
  const supabase = await requireOwner();
  const [{ data: jobs, error }, { data: events }, { data: settings }, { data: followUps }] = await Promise.all([
    supabase.from("jobs").select("status"),
    supabase
      .from("job_status_events")
      .select("id, to_status, changed_at, note, jobs(id, company, role)")
      .order("changed_at", { ascending: false })
      .limit(10),
    supabase.from("settings").select("follow_up_after_days, ghost_after_days").single(),
    // ROADMAP 2.5: still `applied` with no reply after the follow-up threshold. The daily cron
    // marks them ghosted once they pass ghost_after_days.
    supabase.from("follow_up_jobs").select("*").order("date_applied"),
  ]);
  if (error) throw error;

  const counts = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0]));
  jobs.forEach((job) => counts[job.status]++);

  const followUpDays = settings?.follow_up_after_days ?? 7;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Dashboard</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {JOB_STATUSES.map((status) => (
          <Link key={status} href={`/jobs?status=${status}`} className="card hover:border-accent">
            <div className="text-sm text-muted">{STATUS_LABELS[status]}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[status]}</div>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Follow up</h2>
          {followUps?.length ? (
            <ul className="divide-y divide-border text-sm">
              {followUps.map((job) => (
                <li key={job.id} className="flex justify-between gap-3 py-2">
                  <Link href={`/jobs/${job.id}`} className="hover:underline">
                    <span className="font-medium">{job.company}</span> · {job.role}
                  </Link>
                  <span className="whitespace-nowrap text-muted">applied {formatDate(job.date_applied)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing has gone {followUpDays} days without a reply.</p>
          )}
          <p className="mt-3 text-xs text-muted">
            Applications with no reply after {followUpDays} days show here. After {settings?.ghost_after_days ?? 21} days
            they are marked ghosted automatically.
          </p>
        </section>

        <section className="card">
          <h2 className="section-title">Latest status changes</h2>
          <ul className="divide-y divide-border text-sm">
            {events?.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/jobs/${event.jobs?.id}`} className="min-w-0 truncate hover:underline">
                  <span className="font-medium">{event.jobs?.company}</span> · {event.jobs?.role}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={event.to_status} />
                  <span className="text-muted">{formatDate(event.changed_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
