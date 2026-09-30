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
            className="pr-16"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted hover:text-foreground"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="remember" type="checkbox" defaultChecked />
        Remember me
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
