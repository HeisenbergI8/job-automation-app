import Link from "next/link";
import { Archive, ChevronRight, MessagesSquare, Search, Send, Sparkles } from "lucide-react";
import { applicationsPerWeek } from "@/lib/analytics";
import { formatDate, formatSalary, JOB_STATUSES } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { LineChart } from "./analytics/charts";
import { CompanyMark } from "./jobs/company-mark";
import { StatusBadge } from "./jobs/status-badge";
import { loadFinderState } from "./finder-state";
import { FinderPanel } from "./finder-panel";
import { HeroTile, StatTile } from "./stat-tile";

const CHART_WEEKS = 8;

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="section-title mb-0">{title}</h2>
      {href && <Link href={href} className="text-sm font-medium text-accent hover:underline">{linkLabel}</Link>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await requireOwner();
  const [{ data: jobs, error }, { data: events }, { data: settings }, { data: followUps }, { data: matches }, finder] = await Promise.all([
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
    loadFinderState(supabase),
  ]);
  if (error) throw error;

  const counts = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0]));
  jobs.forEach((job) => counts[job.status]++);
  const toApply = counts.found + counts.needs_manual;
  const inFlight = counts.applied + counts.screening + counts.interview + counts.offer;

  const followUpDays = settings?.follow_up_after_days ?? 7;
  const weekly = applicationsPerWeek(jobs).slice(-CHART_WEEKS);

  return (
    <div className="flex flex-col gap-8">
      <FinderPanel initial={finder} />

      <section className="flex flex-col gap-3 lg:gap-4">
        <HeroTile
          icon={Sparkles}
          label="In the pipeline"
          value={toApply + inFlight}
          note={`${toApply} to apply to · ${inFlight} applied and still open`}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatTile icon={Search} tint="sky" label="Found" value={counts.found} note={`${counts.needs_manual} to apply to by hand`} href="/jobs?status=found" />
          <StatTile icon={Send} tint="indigo" label="Applied" value={counts.applied} note={`${counts.screening} in screening`} href="/jobs?status=applied" />
          <StatTile icon={MessagesSquare} tint="violet" label="Interviewing" value={counts.interview} note={`${counts.offer} offer${counts.offer === 1 ? "" : "s"}`} href="/jobs?status=interview" />
          <StatTile icon={Archive} tint="amber" label="Closed" value={counts.rejected + counts.ghosted} note={`${counts.rejected} rejected · ${counts.ghosted} ghosted`} />
        </div>
      </section>

      <section>
        <SectionHeader title="Best matches" href="/jobs" linkLabel="All jobs" />
        {matches?.length ? (
          <ul className="grid gap-3 *:min-w-0 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {matches.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="card card-link flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <CompanyMark company={job.company} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{job.company}</div>
                      <div className="truncate text-sm text-muted">{job.role}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                      {job.fit_score} fit
                    </span>
                  </div>
                  <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted">Salary</dt>
                      <dd className="min-w-0 truncate text-right font-medium" title={formatSalary(job)}>{formatSalary(job)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted">Found on</dt>
                      <dd className="min-w-0 truncate text-right font-medium">{job.site} · {formatDate(job.date_found)}</dd>
                    </div>
                  </dl>
                  {job.fit_reasons?.length ? (
                    <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-xs text-muted">
                      {job.fit_reasons.slice(0, 2).map((reason) => (
                        <li key={reason} className="line-clamp-2">{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-muted">No scored jobs waiting to be applied to.</p>
        )}
      </section>

      <div className="grid gap-8 *:min-w-0 lg:grid-cols-2">
        <section>
          <SectionHeader title="Recent activity" />
          <div className="card overflow-hidden p-0">
            <ul className="divide-y divide-border text-sm">
              {events?.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/jobs/${event.jobs?.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/60"
                  >
                    <CompanyMark company={event.jobs?.company ?? ""} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{event.jobs?.company}</span>
                      <span className="block truncate text-xs text-muted">
                        {event.jobs?.role} · {formatDate(event.changed_at)}
                      </span>
                    </span>
                    <StatusBadge status={event.to_status} />
                  </Link>
                </li>
              ))}
              {!events?.length && <li className="px-5 py-4 text-muted">No status changes yet.</li>}
            </ul>
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Follow up" />
            <div className="card overflow-hidden p-0">
              {followUps?.length ? (
                <ul className="divide-y divide-border text-sm">
                  {followUps.map((job) => (
                    <li key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/60">
                        <CompanyMark company={job.company ?? ""} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{job.company}</span>
                          <span className="block truncate text-xs text-muted">
                            {job.role} · applied {formatDate(job.date_applied)}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted">Nothing has gone {followUpDays} days without a reply.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              Applications with no reply after {followUpDays} days show here. After {settings?.ghost_after_days ?? 21} days
              they are marked ghosted automatically.
            </p>
          </section>

          <section>
            <SectionHeader title="Applications per week" href="/analytics" linkLabel="Analytics" />
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
