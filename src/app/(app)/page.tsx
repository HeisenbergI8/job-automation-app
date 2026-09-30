import Link from "next/link";
import { applicationsPerWeek } from "@/lib/analytics";
import { formatDate, formatSalary, JOB_STATUSES, STATUS_LABELS } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { LineChart } from "./analytics/charts";
import { CompanyMark } from "./jobs/company-mark";
import { StatusBadge } from "./jobs/status-badge";

const CHART_WEEKS = 8;

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await requireOwner();
  const [{ data: jobs, error }, { data: events }, { data: settings }, { data: followUps }, { data: matches }] = await Promise.all([
    supabase.from("jobs").select("id, status, site, apply_method, date_applied, salary_min, salary_max, salary_currency"),
    supabase
      .from("job_status_events")
      .select("id, to_status, changed_at, note, jobs(id, company, role)")
      .order("changed_at", { ascending: false })
      .limit(8),
    supabase.from("settings").select("follow_up_after_days, ghost_after_days").single(),
    // ROADMAP 2.5: still `applied` with no reply after the follow-up threshold. The daily cron
    // marks them ghosted once they pass ghost_after_days.
    supabase.from("follow_up_jobs").select("*").order("date_applied"),
    // Not applied yet, best fit first: what to open next.
    supabase
      .from("jobs")
      .select("id, company, role, site, fit_score, fit_reasons, date_found, salary_min, salary_max, salary_currency, salary_raw")
      .in("status", ["found", "needs_manual"])
      .not("fit_score", "is", null)
      .order("fit_score", { ascending: false })
      .limit(3),
  ]);
  if (error) throw error;

  const counts = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0]));
  jobs.forEach((job) => counts[job.status]++);

  const followUpDays = settings?.follow_up_after_days ?? 7;
  const weekly = applicationsPerWeek(jobs).slice(-CHART_WEEKS);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Dashboard</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {JOB_STATUSES.map((status) => (
          <Link key={status} href={`/jobs?status=${status}`} className="card px-3.5 py-4 transition-colors hover:border-accent">
            <div className="section-title mb-2 truncate tracking-[0.08em]">{STATUS_LABELS[status]}</div>
            <div className="stat-value">{counts[status]}</div>
          </Link>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[5fr_7fr]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="section-title">Best matches · {matches?.length ?? 0}</h2>
            {matches?.length ? (
              <ul className="flex flex-col gap-3">
                {matches.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="card flex gap-3 p-4 transition-colors hover:border-accent">
                      <CompanyMark company={job.company} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{job.company}</div>
                            <div className="truncate text-sm text-muted">{job.role}</div>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                            <span className="tabular-nums">{job.fit_score}</span> fit
                            <Chevron />
                          </span>
                        </div>
                        <div className="mt-1 text-sm tabular-nums">{formatSalary(job)}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {job.site} · found {formatDate(job.date_found)}
                        </div>
                        {job.fit_reasons?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {job.fit_reasons.slice(0, 2).map((reason) => (
                              <span key={reason} className="chip max-w-full truncate">{reason}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card text-sm text-muted">No scored jobs waiting to be applied to.</p>
            )}
          </section>

          <section>
            <h2 className="section-title">Follow up</h2>
            <div className="card p-0">
              {followUps?.length ? (
                <ul className="divide-y divide-border text-sm">
                  {followUps.map((job) => (
                    <li key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                        <CompanyMark company={job.company ?? ""} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{job.company}</span>
                          <span className="block truncate text-xs text-muted">{job.role}</span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted">
                          applied {formatDate(job.date_applied)}
                        </span>
                        <Chevron />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted">Nothing has gone {followUpDays} days without a reply.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              Applications with no reply after {followUpDays} days show here. After {settings?.ghost_after_days ?? 21} days
              they are marked ghosted automatically.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section>
            <h2 className="section-title">Latest status changes</h2>
            <div className="card p-0">
              <ul className="divide-y divide-border text-sm">
                {events?.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/jobs/${event.jobs?.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-surface-muted sm:grid-cols-[auto_1fr_8rem_auto]"
                    >
                      <CompanyMark company={event.jobs?.company ?? ""} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{event.jobs?.company}</span>
                        <span className="block truncate text-xs text-muted">{event.jobs?.role}</span>
                      </span>
                      <span><StatusBadge status={event.to_status} /></span>
                      <span className="hidden text-right text-xs tabular-nums text-muted sm:block">
                        {formatDate(event.changed_at)}
                      </span>
                    </Link>
                  </li>
                ))}
                {!events?.length && <li className="px-4 py-3 text-muted">No status changes yet.</li>}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="section-title">Applications per week</h2>
            <div className="card">
              {weekly.length ? (
                <LineChart
                  data={weekly.map(({ week, count }) => ({
                    label: formatDate(week),
                    value: count,
                    tooltip: `Week of ${formatDate(week)}: ${count} application${count === 1 ? "" : "s"}`,
                  }))}
                />
              ) : (
                <p className="text-sm text-muted">Appears once a job is marked applied.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
