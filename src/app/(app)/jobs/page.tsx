import Link from "next/link";
import { formatDate, formatSalary, JOB_STATUSES, STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { CompanyMark } from "./company-mark";
import { StatusBadge } from "./status-badge";

const SORTS = {
  applied_desc: { column: "date_applied", ascending: false, label: "Applied, newest" },
  applied_asc: { column: "date_applied", ascending: true, label: "Applied, oldest" },
  found_desc: { column: "date_found", ascending: false, label: "Found, newest" },
  found_asc: { column: "date_found", ascending: true, label: "Found, oldest" },
} as const;

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const params = await searchParams;
  const status = typeof params.status === "string" && JOB_STATUSES.includes(params.status as JobStatus)
    ? (params.status as JobStatus)
    : undefined;
  const site = typeof params.site === "string" && params.site ? params.site : undefined;
  const sortKey = typeof params.sort === "string" && params.sort in SORTS ? (params.sort as keyof typeof SORTS) : "applied_desc";
  const sort = SORTS[sortKey];

  const supabase = await requireOwner();
  let query = supabase
    .from("jobs")
    .select("id, status, company, role, site, date_found, date_applied, salary_min, salary_max, salary_currency, salary_raw")
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("date_found", { ascending: false });
  if (status) query = query.eq("status", status);
  if (site) query = query.eq("site", site);

  const [{ data: jobs, error }, { data: siteRows }] = await Promise.all([
    query,
    supabase.from("jobs").select("site"),
  ]);
  if (error) throw error;
  const sites = [...new Set(siteRows?.map((row) => row.site))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Jobs</h1>
        <p className="page-subtitle">Every job found or applied to, with where it stands.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <label className="field">
          Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            {JOB_STATUSES.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Site
          <select name="site" defaultValue={site ?? ""}>
            <option value="">All</option>
            {sites.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Sort
          <select name="sort" defaultValue={sortKey}>
            {Object.entries(SORTS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button className="btn">Apply</button>
        {(status || site || sortKey !== "applied_desc") && (
          <Link href="/jobs" className="py-2 text-sm text-muted hover:text-foreground">Clear</Link>
        )}
      </form>

      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Company</th>
              <th>Role</th>
              <th>Site</th>
              <th>Applied</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="transition-colors hover:bg-surface-muted/60">
                <td><StatusBadge status={job.status} /></td>
                <td className="font-medium">
                  <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 hover:underline">
                    <CompanyMark company={job.company} />
                    <span className="min-w-40">{job.company}</span>
                  </Link>
                </td>
                <td>{job.role}</td>
                <td className="text-muted">{job.site}</td>
                <td className="whitespace-nowrap">{formatDate(job.date_applied)}</td>
                <td className="whitespace-nowrap">{formatSalary(job)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">No jobs match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
