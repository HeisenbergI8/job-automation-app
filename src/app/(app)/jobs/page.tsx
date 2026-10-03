import Link from "next/link";
import { formatDate, formatFoundAt, formatSalary, JOB_STATUSES, STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { requireOwner } from "@/lib/supabase/server";
import { CompanyMark } from "./company-mark";
import { requestStatesNow } from "./outreach-state";
import { SendEmailButton } from "./send-email-button";
import { StatusBadge } from "./status-badge";

const SORTS = {
  applied_desc: { column: "date_applied", ascending: false, label: "Applied, newest" },
  applied_asc: { column: "date_applied", ascending: true, label: "Applied, oldest" },
  // created_at is the moment a job was found or added; date_found holds only the day.
  found_desc: { column: "created_at", ascending: false, label: "Found, newest" },
  found_asc: { column: "created_at", ascending: true, label: "Found, oldest" },
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
    // One string literal: supabase-js infers the row type from it, and a concatenated string loses that.
    .select("id, status, company, role, site, created_at, date_applied, salary_min, salary_max, salary_currency, salary_raw, outreach_emails(id, kind, to_email, subject, body, status), outreach_requests(id, kind, requested_at, picked_up_at, finished_at, error)")
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("requested_at", { referencedTable: "outreach_requests", ascending: false })
    .limit(1, { referencedTable: "outreach_requests" });
  if (status) query = query.eq("status", status);
  if (site) query = query.eq("site", site);

  const [{ data: jobs, error }, { data: siteRows }] = await Promise.all([
    query,
    supabase.from("jobs").select("site"),
  ]);
  if (error) throw error;
  const requests = requestStatesNow(jobs, (job) => job.outreach_requests[0] ?? null);
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
              <th>Email</th>
              <th>Site</th>
              <th>Found</th>
              <th>Applied</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => (
              <tr key={job.id} className="transition-colors hover:bg-surface-muted/60">
                <td><StatusBadge status={job.status} /></td>
                <td className="font-medium">
                  <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 hover:underline">
                    <CompanyMark company={job.company} />
                    <span className="min-w-40">{job.company}</span>
                  </Link>
                </td>
                <td className="min-w-44">{job.role}</td>
                <td>
                  <SendEmailButton
                    jobId={job.id}
                    email={job.outreach_emails.find((email) => email.kind === "first") ?? null}
                    request={requests[index]}
                  />
                </td>
                <td className="text-muted">{job.site}</td>
                <td className="whitespace-nowrap">{formatFoundAt(job.created_at)}</td>
                <td className="whitespace-nowrap">{formatDate(job.date_applied)}</td>
                <td>
                  {/* Truncation needs a block inside the cell; "as written" salaries can run long. */}
                  <span className="block max-w-36 truncate" title={formatSalary(job)}>{formatSalary(job)}</span>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">No jobs match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
