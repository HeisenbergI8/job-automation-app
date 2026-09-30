"use client";

import { startTransition, useActionState, useState } from "react";
import { logIn } from "./actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(logIn, null);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form
      // Submitting through a transition, rather than the action prop, stops React resetting the
      // form, so a failed submit keeps what was typed.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-3"
    >
      <label className="field">
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        Password
        <div className="relative flex flex-col">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-pressed={showPassword}
            aria-label="Show password"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground"
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </div>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="remember" type="checkbox" defaultChecked className="accent-accent" />
        Remember me
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

/** An open eye while the password is hidden; crossed out once it is shown. */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m3 3 18 18" />}
    </svg>
  );
}
