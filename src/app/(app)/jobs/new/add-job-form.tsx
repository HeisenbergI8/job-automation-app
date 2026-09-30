"use client";

import { startTransition, useActionState } from "react";
import { addJob } from "../actions";

export function AddJobForm() {
  const [state, formAction, pending] = useActionState(addJob, null);
  return (
    <form
      // Submitting through a transition, rather than the action prop, stops React resetting the
      // form, so a failed submit keeps what was typed.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="card flex flex-col gap-4"
    >
      <label className="field">
        Link
        <input name="url" type="url" required placeholder="https://boards.greenhouse.io/…" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Company
          <input name="company" required />
        </label>
        <label className="field">
          Role
          <input name="role" required />
        </label>
        <label className="field">
          Location
          <input name="location" placeholder="Remote" />
        </label>
        <label className="field">
          <span>Site <span className="font-normal text-muted">(worked out from the link if empty)</span></span>
          <input name="site" placeholder="greenhouse" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field">
          Salary min
          <input name="salary_min" inputMode="numeric" />
        </label>
        <label className="field">
          Salary max
          <input name="salary_max" inputMode="numeric" />
        </label>
        <label className="field">
          Currency
          <input name="salary_currency" placeholder="USD" maxLength={3} />
        </label>
        <label className="field">
          As written
          <input name="salary_raw" placeholder="$90k–$110k" />
        </label>
      </div>
      <label className="field">
        Job description
        <textarea name="description" rows={10} />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save job"}</button>
      </div>
    </form>
  );
}
