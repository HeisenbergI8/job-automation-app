import {
  applicationsPerWeek,
  daysToFirstReply,
  funnel,
  overallResponseRate,
  responseRates,
  salarySpread,
} from "@/lib/analytics";
import { formatDate, STATUS_LABELS } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { BarList, ColumnChart, StripPlot, TableView } from "./charts";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const money = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const METHOD_LABELS: Record<string, string> = { auto: "Auto-applied", manual: "Manual" };

export default async function AnalyticsPage() {
  const supabase = await requireOwner();
  const [{ data: jobs, error }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("jobs").select("id, site, apply_method, date_applied, salary_min, salary_max, salary_currency"),
    supabase.from("job_status_events").select("job_id, to_status, changed_at"),
  ]);
  if (error || eventsError) throw error ?? eventsError;

  const weekly = applicationsPerWeek(jobs);
  const stages = funnel(jobs, events);
  const overall = overallResponseRate(jobs, events);
  const bySite = responseRates(jobs, events, "site");
  const byMethod = responseRates(jobs, events, "apply_method");
  const replyDays = daysToFirstReply(jobs, events);
  const averageDays = replyDays.length ? replyDays.reduce((sum, days) => sum + days, 0) / replyDays.length : null;
  const salaries = salarySpread(jobs);

  if (overall.total === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="page-title">Analytics</h1>
        <p className="text-muted">Nothing to chart yet. Numbers appear once a job is marked applied.</p>
      </div>
    );
  }

  const rateRows = (rows: typeof bySite, labels: Record<string, string> = {}) =>
    rows.map((row) => ({
      label: labels[row.group] ?? row.group,
      value: row.rate,
      display: `${percent(row.rate)} · ${row.replied}/${row.total}`,
      tooltip: `${row.replied} of ${row.total} application${row.total === 1 ? "" : "s"} got a reply`,
    }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Analytics</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-sm text-muted">Applications</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{overall.total}</div>
        </div>
        <div className="card">
          <div className="text-sm text-muted">Response rate</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{percent(overall.rate)}</div>
          <div className="text-xs text-muted">{overall.replied} of {overall.total} got any reply, rejections included</div>
        </div>
        <div className="card">
          <div className="text-sm text-muted">Average days to first reply</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{averageDays != null ? averageDays.toFixed(1) : "—"}</div>
          <div className="text-xs text-muted">across {replyDays.length} replies</div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Applications per week</h2>
        <ColumnChart
          data={weekly.map(({ week, count }) => ({
            label: formatDate(week),
            value: count,
            tooltip: `Week of ${formatDate(week)}: ${count} application${count === 1 ? "" : "s"}`,
          }))}
        />
        <TableView headers={["Week of", "Applications"]} rows={weekly.map(({ week, count }) => [formatDate(week), count])} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Funnel</h2>
          <BarList
            max={stages[0].count}
            data={stages.map(({ stage, count }) => ({
              label: STATUS_LABELS[stage],
              value: count,
              display: `${count} · ${percent(count / stages[0].count)}`,
              tooltip: `${count} of ${stages[0].count} applications reached ${STATUS_LABELS[stage].toLowerCase()}`,
            }))}
          />
          <TableView
            headers={["Stage", "Reached", "Of applied"]}
            rows={stages.map(({ stage, count }) => [STATUS_LABELS[stage], count, percent(count / stages[0].count)])}
          />
        </section>

        <section className="card">
          <h2 className="section-title">Response rate: auto vs manual</h2>
          <BarList max={1} data={rateRows(byMethod, METHOD_LABELS)} />
          <h2 className="section-title mt-6">Response rate by site</h2>
          <BarList max={1} data={rateRows(bySite)} />
          <TableView
            headers={["Group", "Replied", "Applied", "Rate"]}
            rows={[...byMethod.map((row) => ({ ...row, group: METHOD_LABELS[row.group] ?? row.group })), ...bySite].map(
              (row) => [row.group, row.replied, row.total, percent(row.rate)],
            )}
          />
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Salary spread (midpoint of each posted range)</h2>
        {salaries.length ? (
          <div className="flex flex-col gap-6">
            {salaries.map((spread) => (
              <div key={spread.currency}>
                <div className="mb-2 text-sm font-medium">
                  {spread.currency} · {spread.midpoints.length} application{spread.midpoints.length === 1 ? "" : "s"}
                </div>
                <StripPlot {...spread} values={spread.midpoints} format={money} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No applications have a salary yet.</p>
        )}
        <TableView
          headers={["Currency", "Applications", "Min", "Median", "Max"]}
          rows={salaries.map((s) => [s.currency, s.midpoints.length, money(s.min), money(s.median), money(s.max)])}
        />
      </section>
    </div>
  );
}
