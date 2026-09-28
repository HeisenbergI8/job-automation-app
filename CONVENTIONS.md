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
- **Claude API**: fit scoring, CV and cover-letter tailoring, and self-intro adaptation.

**State as of 2026-09-28:** greenfield. `src/app/` is still the Create Next App starter, `worker/`
contains only a README, and `supabase/` is empty. The Supabase and Anthropic SDKs are not installed
yet. Build in the order in `docs/ROADMAP.md`: foundation first, then the job record and dashboard.

---

## Commands

| Purpose | Command |
| --- | --- |
| Full check (the closing gate) | `npm run verify` (lint + typecheck) |
| Fast check (runs every turn) | `npm run typecheck` |
| Tests, one file | None yet. There is no test runner. |
| Run the app locally | `npm run dev` |

The first two must stay in sync with `harness.config.json`. When a test runner is added, add it to
`verify` in `package.json` and fill in the "one file" row.

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

**Read this first:** `docs/SPEC.md`. There is no representative module yet. Once the first real
feature (the job record) lands, name it here as the template for the rest.

---

## Traps

- **Next.js 16 differs from older versions.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing Next code (see `AGENTS.md`). For example, `middleware.ts` is deprecated and is now
  `proxy.ts`, with the exported function named `proxy`.
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
