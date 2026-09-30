"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { SettingsState } from "./actions";

export function SettingsForm({
  action,
  children,
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      // Submitting through a transition keeps the typed values instead of resetting the form.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-4"
    >
      {children}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.saved && !pending && <p className="text-sm text-muted">Saved.</p>}
      </div>
    </form>
  );
}
