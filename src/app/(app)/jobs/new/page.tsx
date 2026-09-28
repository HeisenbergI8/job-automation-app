import { AddJobForm } from "./add-job-form";

export default function NewJobPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="page-title">Add a job</h1>
      <p className="text-sm text-muted">
        Paste the link and the key details. Paste the job description too: postings get deleted, and
        tailoring needs it.
      </p>
      <AddJobForm />
    </div>
  );
}
