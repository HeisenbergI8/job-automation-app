# Conventions

## What this project is

A personal job-application tracker and auto-applier for one user. A daily worker finds the top 3
jobs, tailors a CV and cover letter for each, and applies where it safely can. A Next.js dashboard
records every application, with its status timeline, and shows analytics. The full product spec is
[`docs/SPEC.md`](docs/SPEC.md). Read it before planning any feature.

**Stack:**
- **Web app** (`src/`): Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4.
  Deployed on Vercel.
- **Worker** (`worker/`): plain Node + Playwright. Runs once a day on the owner's Mac, not on Vercel.
- **Supabase** (`supabase/`): Postgres, Storage (CVs, cover letters, intro videos) and Auth.
- **Claude**: CV and cover-letter tailoring and self-intro adaptation through the API (web app).
  Fit scoring and outreach drafts through Claude Code headless (`claude -p`) with the owner's
  subscription (worker).
- **Hunter.io** free API (worker, optional): people to email about a saved job (stage 7).

**State as of 2026-09-29:** roadmap stages 0–4 are built (foundation, job record and dashboard,
analytics, settings, tailoring). Stage 5, the daily finder in `worker/`, is built and verified against
the local stack; its roadmap boxes are ticked after the owner's first run against the hosted project.
Stage 7, outreach emails the owner sends from Gmail, was built on 2026-10-03 at the owner's direction
(before stage 6) and verified against the local stack (plan: `.claude/plans/feature-outreach-email-plan/`).
Build in the order in `docs/ROADMAP.md`.

---

## Commands

| Purpose | Command |
| --- | --- |
| Full check (the closing gate) | `npm run verify` (lint + typecheck + unit tests) |
| Fast check (runs every turn) | `npm run typecheck` |
| Tests, one file | `npx vitest run src/lib/analytics.test.ts` |
| Database tests | `npm run db:test` (pgTAP in `supabase/tests/`; needs the local stack running) |
| New migration | add `supabase/migrations/<timestamp>_<name>.sql`, then `npm run db:reset` (also regenerates types) |
| Push migrations to the hosted project | `npx supabase db push` (the worker writes to hosted) |
| Run the worker | `cd worker && npm run dev` (local stack, `worker/.env.local`); `npm start` (hosted, `worker/.env`); add `--dry-run` to save and send nothing |
| Run the app locally | `npm run db:start`, then `npm run dev` (setup in `README.md`) |

The first two must stay in sync with `harness.config.json`. `db:test` is not in `verify` because it
needs Docker; run it after any migration.

---

## Where things live

| Layer | Path | Owns |
| --- | --- | --- |
| Web app | `src/app/` | Dashboard, job records, analytics, settings (App Router) |
| Worker | `worker/` | Search, score, tailor, apply. Writes results to Supabase. |
| Database | `supabase/` | Migrations and schema: the job record, the status timeline, settings |
| Product spec | `docs/SPEC.md` | What to build |
| Roadmap | `docs/ROADMAP.md` | The ordered chunk checklist. Tick boxes as chunks land. |

Path alias: `@/*` → `src/*`.

**Read this first:** `docs/SPEC.md`, then the job record as the template for the rest:
- `supabase/migrations/20260928000100_job_record.sql`: tables, row-level security, and rules the database
  enforces itself (the status transitions, via `set_job_status()`).
- `src/app/(app)/jobs/`: server components that read through `requireOwner()`, server actions in
  `actions.ts` returning `{ error }`, and small client forms using `useActionState`.
- `src/lib/`: pure, unit-tested logic (`analytics.ts`, `tailoring/check.ts`) that the worker can reuse.
  Files that import `server-only` (`claude.ts`, `tailoring/generate.ts`, `supabase/server.ts`) can't be
  imported by the worker or by tests.

---

## Traps

- **Next.js 16 differs from older versions.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing Next code (see `AGENTS.md`). For example, `middleware.ts` is deprecated and is now
  `proxy.ts`, with the exported function named `proxy`.
- **Change a job's status only through `set_job_status()`** (the `changeStatus` server action, or
  `rpc("set_job_status")` from the worker). A trigger refuses direct updates of `jobs.status`, and new
  jobs must start as `found`.
- **`supabase db reset` deletes the owner account.** Use `npm run db:reset`, which recreates it from
  `OWNER_EMAIL` and `OWNER_PASSWORD` in `.env.local`.
- **React 19 resets a form after its action runs.** Forms that must keep their values after an error
  submit through `startTransition` in `onSubmit` (see `login-form.tsx`).
- **`outreach_emails` status moves only draft → opened → sent** (a trigger enforces it and stamps the
  times). The owner may update only `status`; a sent email is frozen.
- **"Email sent" is not a job status.** The job page merges sent emails into its timeline
  (`timelineEntries` in `src/lib/outreach.ts`); `job_status_events` stays status changes only.
- **`npm run verify -- <file>` no longer runs one test:** the file argument reaches the Python tests.
  Use `npx vitest run <file>`.
- **The worker has its own env files.** `worker/.env` points at the hosted project (the daily run),
  `worker/.env.local` at the local stack (`npm run dev`). It never reads the root `.env.local`.
- **Never put `ANTHROPIC_API_KEY` in the worker's env.** Claude Code would bill the API instead of the
  subscription. `scoring.ts` also strips it from the child process.
- **The worker runs TypeScript with `tsx`** and imports pure `src/lib` modules through `@/*`
  (`worker/tsconfig.json` paths). Plain `node` can't resolve those imports. It still can't import
  anything that imports `server-only`.
- **Tailwind v4 is configured in CSS** (`@import "tailwindcss"` in `src/app/globals.css`). There is no
  `tailwind.config.js`, so don't create one.
- **The worker never runs inside Next.js.** A browser run takes minutes and would time out in a web
  request or a Vercel function. Anything that uses Playwright or runs the daily pipeline goes in
  `worker/`.
- **`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server- and worker-only.** Never import them
  into a client component, and never add a `NEXT_PUBLIC_` prefix to them. Only the `NEXT_PUBLIC_SUPABASE_*`
  values may reach the browser. The template for env vars is `.env.example`; `.env` itself is not
  committed.
- **The root `tsconfig.json` includes `**/*.ts`,** so worker TypeScript files will be typechecked with
  the web app's settings (DOM lib, bundler resolution). If the worker needs different settings, give it
  its own `tsconfig.json` and exclude `worker/` from the root one.

### Product rules that must never be broken

These come from the spec and are easy to erode during implementation:

- **The app never sends an email.** Outreach drafts open in Gmail's compose page (or `mailto:`); the
  owner presses Send. Drafts pass the no-invention check (`findEmailInventions` in `src/lib/outreach.ts`).
- **Real email addresses only.** A contact's address is printed in the job post or returned by Hunter;
  it's never built from a name or a pattern. With none, the app says "No email found".
- **Never bypass a CAPTCHA.** If one appears, stop and mark the job `needs_manual` with the link.
- **Never auto-apply on LinkedIn, Indeed or JobStreet.** They may be searched but not applied to,
  to protect the owner's accounts. Auto-apply is only for company career pages (Greenhouse, Lever,
  Ashby and similar).
- **CV tailoring only rewords and reorders the master CV.** It never adds skills, experience or claims
  that aren't in it.
- **An adapted self-intro waits for the owner's approval** before it is used. That application stays
  pending until then.
- **Status values are fixed:** `found → applied | needs_manual → screening → interview → offer |
  rejected | ghosted`. Every status change is stored with its date. Don't overwrite the previous status.
- **Store what was actually sent.** Every application keeps a copy of the job description and the exact
  CV, cover letter and intro used, because postings get deleted.

---

## Reporting rules

- **A deferral is not a gap.** Work that was deliberately postponed must not be reported as a defect,
  a finding or a hand-off item. Chunks later in `docs/ROADMAP.md` are deferred, not missing.
  Also deferred: automated tests and multi-user support. This is a single-user app.
- **A claim that ages carries the date it was measured.** Any count, or any "every / all / none"
  statement written into something durable (a doc, a status field, a user-visible string) says when it
  was measured, for example: `measured NULL on 25 of 25 rows on 2026-08-06`.
- **Red is not automatically yours.** A failing typecheck, lint or test in code this turn did not touch
  is evidence about the tree, not a defect to fix. Check where it came from first, without stashing:
  `git show HEAD:<path> | diff - <path>`.
- **A priority label is not permission to start.** Follow the order in `docs/ROADMAP.md`, not what
  looks most important.
