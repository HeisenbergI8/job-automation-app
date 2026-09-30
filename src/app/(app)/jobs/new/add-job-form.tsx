"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { Globe, Link2, MapPin } from "lucide-react";
import { addJob } from "../actions";

function hostOf(link: string) {
  try {
    return new URL(link.trim()).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** An input with an icon inside its left edge. */
function IconInput({ icon, ...props }: { icon: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex flex-col">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted" aria-hidden="true">{icon}</span>
      <input {...props} className="pl-10" />
    </div>
  );
}

const optional = <span className="font-normal text-muted">(optional)</span>;

export function AddJobForm() {
  const [state, formAction, pending] = useActionState(addJob, null);
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const host = hostOf(link);

  return (
    <form
      // Submitting through a transition, rather than the action prop, stops React resetting the
      // form, so a failed submit keeps what was typed.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="card flex flex-col gap-6"
    >
      <Group title="The posting">
        <label className="field">
          Link
          <IconInput
            icon={<Link2 className="size-4" />}
            name="url"
            type="url"
            required
            autoFocus
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://boards.greenhouse.io/…"
          />
          {host && (
            <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted">
              <Globe className="size-3.5" aria-hidden="true" />
              From {host}
            </span>
          )}
        </label>
      </Group>

      <Group title="Company and role">
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
            <span>Location {optional}</span>
            <IconInput icon={<MapPin className="size-4" />} name="location" placeholder="Remote" />
          </label>
          <label className="field">
            <span>Site {optional}</span>
            <input name="site" placeholder={host ? "Worked out from the link" : "greenhouse"} />
          </label>
        </div>
      </Group>

      <Group title="Pay" hint="Optional. Leave it empty if the posting doesn't say.">
        <div className="grid gap-4 *:min-w-0 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span id="range-label">Range</span>
            <div
              role="group"
              aria-labelledby="range-label"
              className="flex items-center rounded-xl border border-border bg-surface transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20"
            >
              <input
                name="salary_currency"
                aria-label="Currency"
                placeholder="USD"
                maxLength={3}
                className="w-16 rounded-l-xl border-r border-border bg-surface-muted/60 px-3 py-2.5 text-center text-sm font-semibold uppercase outline-none"
              />
              <input name="salary_min" aria-label="Minimum" inputMode="numeric" placeholder="Min" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none" />
              <span className="text-muted" aria-hidden="true">–</span>
              <input name="salary_max" aria-label="Maximum" inputMode="numeric" placeholder="Max" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none" />
            </div>
          </div>
          <label className="field">
            As written in the posting
            <input name="salary_raw" placeholder="$90k–$110k a year" />
          </label>
        </div>
      </Group>

      <Group title="Job description" hint="Paste the whole thing. Postings get taken down, and tailoring your CV needs it.">
        <div className="flex flex-col gap-1.5">
          <textarea
            name="description"
            aria-label="Job description"
            rows={12}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="input leading-6"
          />
          <p className="text-right text-xs text-muted tabular-nums">
            {description.trim() ? `${description.trim().split(/\s+/).length} words` : "Nothing pasted yet"}
          </p>
        </div>
      </Group>

      <div className="-mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-border bg-surface-muted/40 px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
        {state?.error && <p className="mr-auto text-sm text-danger">{state.error}</p>}
        <Link href="/jobs" className="btn">Cancel</Link>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save job"}</button>
      </div>
    </form>
  );
}
