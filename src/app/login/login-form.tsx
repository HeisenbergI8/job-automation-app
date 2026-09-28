"use client";

import { startTransition, useActionState } from "react";
import { logIn } from "./actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(logIn, null);
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
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
