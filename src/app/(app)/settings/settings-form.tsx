"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { SettingsState } from "./actions";

/**
 * A settings section's form, with its save bar along the bottom of the card. The bar says when
 * there are unsaved edits, so it is clear which sections still need saving.
 */
export function SettingsForm({
  action,
  children,
  submitLabel = "Save",
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  // Edits are counted rather than compared, so no field needs to report its value.
  const [edits, setEdits] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const dirty = edits !== (state?.saved ? submitted : 0);

  return (
    <form
      // Submitting through a transition keeps the typed values instead of resetting the form.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setSubmitted(edits);
        startTransition(() => formAction(formData));
      }}
      onInput={() => setEdits((count) => count + 1)}
      className="flex flex-col gap-5"
    >
      {children}
      <div className="-mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-border bg-surface-muted/40 px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
        <p className="mr-auto text-sm" aria-live="polite">
          {state?.error ? (
            <span className="text-danger">{state.error}</span>
          ) : pending ? null : dirty ? (
            <span className="inline-flex items-center gap-2 text-muted">
              <span className="size-2 rounded-full bg-warn" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : state?.saved ? (
            <span className="inline-flex items-center gap-1.5 text-good">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          ) : null}
        </p>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
