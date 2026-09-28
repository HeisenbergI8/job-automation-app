# Job Automation

A personal job-application tracker for one owner. Every application is recorded with its status
timeline, the documents sent and analytics; CVs and cover letters are tailored per job without ever
inventing experience. See [`docs/SPEC.md`](docs/SPEC.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Local setup

Needs Node 22 and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start      # starts local Supabase; prints the URL and keys
```

Create `.env.local` from `.env.example`. Locally, the Supabase values come from `npx supabase status`,
and `CRON_SECRET` can be any random string. Add the owner login too, so `db:reset` can recreate it:

```bash
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=a-long-password
```

Then:

```bash
npm run db:reset      # applies migrations, loads supabase/seed.sql, regenerates types, creates the owner
npm run dev
```

Public sign-up is disabled: the owner account is the only way in. `npm run owner:create -- <email> <password>`
creates it, or resets its password.

Tailoring needs `ANTHROPIC_API_KEY`. Everything else works without it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run verify` | Lint, typecheck and unit tests |
| `npm test` | Unit tests (Vitest) |
| `npm run db:test` | Database tests (pgTAP), against the running local stack |
| `npm run db:reset` | Rebuild the local database from migrations and the seed |
| `npm run db:types` | Regenerate `src/lib/supabase/types.ts` after a migration |

## Deploying

The web app deploys to Vercel. Set the same variables as `.env.local` (except `OWNER_*`), plus
`CRON_SECRET`, which Vercel Cron sends to `/api/cron/ghosting` once a day (`vercel.json`). On the hosted
Supabase project, turn off sign-ups (Authentication > Providers > Email) and create the owner with
`npm run owner:create` pointed at that project.
