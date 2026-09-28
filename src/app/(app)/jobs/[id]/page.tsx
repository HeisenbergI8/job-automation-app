import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatSalary, STATUS_LABELS } from "@/lib/jobs";
import { cvText, parseMasterCv } from "@/lib/master-cv";
import { requireOwner } from "@/lib/supabase/server";
import { keywordScore } from "@/lib/tailoring/ats";
import { StatusBadge } from "../status-badge";
import { StatusControl } from "./status-control";
import { IntroAdaptation, NewIntroForm, TailorButton } from "./tailoring-panels";
import { UploadForm } from "./upload-form";

// Tailoring makes Claude calls from this page's server actions; give them room to finish.
export const maxDuration = 300;

const DOCUMENT_LABELS = { cv: "CV", cover_letter: "Cover letter", intro: "Intro" } as const;

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await requireOwner();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: events }, { data: transitions }, { data: documents }, { data: intros }, { data: settings }] = await Promise.all([
    supabase.from("job_status_events").select("*").eq("job_id", id).order("changed_at", { ascending: false }),
    supabase.from("job_status_transitions").select("to_status").eq("from_status", job.status),
    supabase.from("application_documents").select("*").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("intro_adaptations").select("*").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("settings").select("master_cv").single(),
  ]);

  const master = parseMasterCv(settings?.master_cv);
  const masterMatch = master && job.ats_keywords ? keywordScore(job.ats_keywords, cvText(master)) : null;
  const sentIntroIds = new Set(documents?.map((doc) => doc.intro_adaptation_id));
  const waitingForIntro = intros?.some((intro) => intro.status === "pending");

  const { data: signed } = documents?.length
    ? await supabase.storage.from("documents").createSignedUrls(documents.map((doc) => doc.storage_path), 60 * 60, { download: true })
    : { data: [] };
  const downloadUrls = new Map(signed?.map((entry) => [entry.path, entry.signedUrl ?? undefined]));

  const fields = [
    ["Site", job.site],
    ["Location", job.location ?? "—"],
    ["Salary", formatSalary(job)],
    ["Found", formatDate(job.date_found)],
    ["Applied", formatDate(job.date_applied)],
    ["Apply method", job.apply_method ?? "—"],
    ["Fit score", job.fit_score != null ? `${job.fit_score}/100` : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/jobs" className="text-sm text-muted hover:text-foreground">← Jobs</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{job.role}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-1 text-muted">
          {job.company} ·{" "}
          <a href={job.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Original posting
          </a>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="card">
            <h2 className="section-title">Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {job.fit_reasons?.length ? (
              <ul className="mt-4 list-disc pl-5 text-sm">
                {job.fit_reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : null}
          </section>

          <section className="card">
            <h2 className="section-title">Documents sent</h2>
            {documents?.length ? (
              <ul className="mb-4 divide-y divide-border text-sm">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{DOCUMENT_LABELS[doc.kind]}</span> · {doc.file_name}
                      {doc.ats_score_after != null && (
                        <span className="text-muted">
                          {" "}· keyword match {doc.ats_score_before}% → {doc.ats_score_after}%
                        </span>
                      )}
                      <span className="text-muted"> · {formatDate(doc.created_at)}</span>
                    </span>
                    {downloadUrls.get(doc.storage_path) && (
                      <a href={downloadUrls.get(doc.storage_path)} className="text-accent hover:underline">Download</a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted">Nothing recorded yet.</p>
            )}
            <UploadForm jobId={job.id} />
          </section>

          <section className="card">
            <h2 className="section-title">Tailored CV and cover letter</h2>
            <p className="mb-3 text-sm text-muted">
              Rewords and reorders your master CV around this job&apos;s keywords, and writes a cover letter. Anything
              not in your master CV is rejected. The PDFs are added to the documents above.
            </p>
            {masterMatch && (
              <div className="mb-4 text-sm">
                <div>
                  Master CV keyword match: <span className="font-semibold">{masterMatch.score}%</span>
                  <span className="text-muted"> ({masterMatch.matched.length} of {job.ats_keywords!.length})</span>
                </div>
                {masterMatch.missing.length > 0 && (
                  <div className="text-muted">Not in your CV, so never added: {masterMatch.missing.join(", ")}</div>
                )}
              </div>
            )}
            <TailorButton jobId={job.id} />
          </section>

          <section className="card">
            <h2 className="section-title">Intro for this application</h2>
            <div className="flex flex-col gap-3">
              {intros?.map((intro) => (
                <IntroAdaptation key={intro.id} adaptation={intro} sent={sentIntroIds.has(intro.id)} />
              ))}
              <NewIntroForm jobId={job.id} />
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Job description (saved copy)</h2>
            {job.description ? (
              <div className="whitespace-pre-wrap text-sm leading-6">{job.description}</div>
            ) : (
              <p className="text-sm text-muted">No description saved.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card">
            <h2 className="section-title">Status</h2>
            {waitingForIntro && (
              <p className="mb-3 rounded-md bg-amber-500/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Waiting for you to approve the adapted intro. The application can&apos;t be marked applied until then.
              </p>
            )}
            <StatusControl jobId={job.id} nextStatuses={transitions?.map((row) => row.to_status) ?? []} />
          </section>

          <section className="card">
            <h2 className="section-title">Timeline</h2>
            <ol className="flex flex-col gap-3 text-sm">
              {events?.map((event) => (
                <li key={event.id} className="border-l-2 border-border pl-3">
                  <div className="font-medium">{STATUS_LABELS[event.to_status]}</div>
                  <div className="text-muted">
                    {new Date(event.changed_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  {event.note && <div>{event.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
