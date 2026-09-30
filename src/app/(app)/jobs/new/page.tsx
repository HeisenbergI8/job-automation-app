import { AddJobForm } from "./add-job-form";

export default function NewJobPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="page-title">Add a job</h1>
        <p className="page-subtitle">Found one yourself? Save it here and it joins the rest, starting as Found.</p>
      </div>
      <AddJobForm />
    </div>
  );
}
