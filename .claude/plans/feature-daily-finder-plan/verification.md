# Verification: ROADMAP Stage 5 — daily finder (worker)

**Date:** 2026-09-29
**Scope:** uncommitted working tree — `worker/`, `supabase/migrations/20260929000100_worker.sql`,
`supabase/tests/worker.test.sql`, `src/lib/career-boards.ts` (+test), `src/app/(app)/settings/{actions.ts,page.tsx}`,
`src/lib/supabase/types.ts`, plus config changes (tsconfig, vitest.config.mts, harness.config.json, eslint.config.mjs,
.gitignore, package.json)
**Dependencies reachable:** local Supabase in Docker (to confirm); Claude Code CLI available for at most one live run.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run verify` | PASS | lint clean, typecheck (root + `-p worker`) clean, `Test Files 8 passed (8)`, `Tests 59 passed (59)` |
| `npx next build` | PASS | `Compiled successfully in 1008ms`, `Finished TypeScript in 1870ms`, all 11 routes generated, no errors |
| `npm run db:reset` | PASS | applied `20260929000100_worker.sql` cleanly, regenerated types, recreated owner |
| `npm run db:test` | PASS | `Files=4, Tests=26, ... Result: PASS` (includes `supabase/tests/worker.test.sql`) |

| board-link parsing edge cases (Settings) | PASS | `/private/tmp/.../scratchpad/e2e/boards.mjs` run — 6/6 PASS: Greenhouse job link → board `gitlab`, Lever link without `https://`, Ashby link, fake board added, duplicate refused ("already on the list"), LinkedIn refused. Screenshot: `scratchpad/boards.png` |
| board that 404s shows red in Settings | PASS | Screenshot `scratchpad/_settings.png` — "not-a-real-board-123 (lever: not-a-real-board-123)" shows red text "...oard not found. Check the link in Settings." after a worker run |
| `--dry-run` saves no jobs, records board errors | PASS | `SCORER=keywords npm run dev -- --dry-run` output: `Done: 508 read, 508 new, 0 saved, 1 problems.`; DB: `worker_runs` row `saved=0`, `errors={"not-a-real-board-123 (lever): Board not found..."}`; `career_boards.last_error` set for the fake board (psql query, see below) |
| MIN_FIT=50 / TOP=3 respected | PASS | Dry-run and real-run batch messages each list exactly 3 jobs, all with `Fit >= 60` (80, 80, 75 then 75, 60, 60); DB `fit_score` column confirms 80/80/75/75/60/60 across both saved batches |
| saved jobs start as `found` with fit_score/fit_reasons and full description | PASS | `docker exec supabase_db_job-automation-app psql ... select url, status, fit_score, length(fit_reasons::text), length(description) from jobs` — all 6 new rows `status=found`, non-null `fit_score` (60-80), reasons present, `description` 2158-19126 chars (full text, not truncated) |
| dedupe across boards and across runs; `jobs.url` unique | PASS | Run 1 (`SCORER=keywords npm run dev`): `508 read, 508 new, 3 saved`. Run 2 immediately after: `508 read, 505 new, 3 saved` (the 3 just-saved URLs correctly excluded from "new"), and the 3 newly saved jobs are a disjoint set of URLs from run 1's. `select count(*), count(distinct url) from jobs` → `16 | 16` (all distinct) |
| `worker_runs` rows (ok, scorer, counts) correct | PASS | Dry run row: `ok=t dry_run=t scorer=keywords fetched=508 new_postings=508 scored=10 saved=0 notified=f` (psql query above) |
| static gates | PASS | see table above |

| `needs_manual` notification window (announced once, not twice) | PASS | Marked seed job `10000000-...-10` (Kappa) `needs_manual` via `set_job_status` (psql), then `SCORER=keywords npm run dev`: printed `<b>Needs you:</b> ... at Kappa / Account required to apply` exactly once. Immediate re-run (`npm run dev` again, no new events): batch message printed, no "Needs you" message at all |
| RLS: anon cannot read/write `career_boards`/`worker_runs`; authenticated cannot write `worker_runs` | PASS | `scratchpad/e2e/rls.mjs`, 8/8 PASS — anon SELECT both tables → `200 []`; anon INSERT both → `401`/permission denied; authenticated INSERT `worker_runs` → `403` (`permission denied for table worker_runs`); authenticated SELECT both tables → `200` with rows |
| `ANTHROPIC_API_KEY` stripped from Claude child env | PASS | Code: `worker/src/scoring.ts:167-168`, `const env = { ...process.env }; delete env.ANTHROPIC_API_KEY;` passed to `spawn`. Behaviourally: the one live Claude Code run below succeeded via the subscription without `ANTHROPIC_API_KEY` set anywhere in the shell env, consistent with stripping working (does not by itself prove billing routed to the subscription — that's outside what a black-box test can observe) |
| Claude Code scorer, live run (the one permitted real call) | PASS | `npm run dev -- --dry-run` (default `SCORER`, no `SCORER=keywords`), background task `bazmmz8vl`, 2m21s real wall time. `worker_runs` row `8cf48a8b-...`: `ok=t dry_run=t scorer=claude-code fetched=508 new_postings=496 scored=10 saved=0`, `errors` contains only the pre-existing fake-board error (no scoring errors — Claude Code answered all 10 shortlisted candidates successfully). Batch message: `No jobs today: none of the 496 new jobs scored 50 or more.` (plausible: the strongest keyword-matching postings from these boards were already saved as `found` in earlier keyword runs, so what remained for Claude to judge were weaker candidates) |

| `worker_runs` row for a failing run | PARTIAL — see Failures | Reproduction: `worker/.env.broken.local` = copy of `worker/.env.local` with `SUPABASE_URL` pointed at an unreachable host (`sed`, never touched the real `.env.local`), then `SCORER=keywords npx tsx --env-file=.env.broken.local src/run.ts --dry-run`. Result: process throws `TypeError: fetch failed` / `Error: bad port` and exits 1 (verified `echo $?` → `1`) with **no `worker_runs` row written at all** — not an `ok=false` row. See Failures for why and what this means. `.env.broken.local` deleted afterwards |

## Failures

### A total DB outage produces no `worker_runs` row and no Telegram alert

- **New or pre-existing:** new, in `worker/src/run.ts:95-97` (this stage's own code).
- **Reproduction:** copy `worker/.env.local` to a scratch file with `SUPABASE_URL` pointed at an
  unreachable address, then run `SCORER=keywords npx tsx --env-file=<that file> src/run.ts --dry-run`.
- **Observed:** `main()`'s first statement is
  `const { data: run, error } = await db.from("worker_runs").insert({ dry_run: dryRun })...; if (error) throw error;`
  (`run.ts:96-97`), which sits **outside** the `try { ... } catch (failure) { ... }` block that writes
  the `ok: false` row and sends the failure Telegram message (`run.ts:100-136`). When the DB itself is
  unreachable, this first insert is exactly what fails, so the throw is caught only by the outermost
  `main().catch((error) => { console.error(error); process.exitCode = 1; })` (`run.ts:139-142`), which
  touches neither `worker_runs` nor Telegram. Confirmed: exit code 1, stderr has the raw Supabase fetch
  error, **zero** new `worker_runs` rows, **no** printed/sent Telegram message.
- **Expected:** the plan's own text (Phase 7 intro: "log the run as started → ... ") and the owner-facing
  README ("No message at all: open `worker/logs/finder.log`...") both imply every run attempt leaves a
  trace the owner can find. For a total DB outage, `finder.log` (launchd's redirected stdout/stderr)
  is genuinely the only trace — there is no `worker_runs` row and no Telegram message, so the owner
  would see nothing until they think to check that file after a day the Telegram message didn't arrive.
- **Confidence:** high on the observed behaviour (reproduced once with `--dry-run`, deterministic).
  Medium on whether this counts as a "defect" versus an accepted limitation — logging a row to a
  database you cannot reach is architecturally impossible, so this may be intentional; the plan's Phase
  8 "Potential Issues" makes exactly this point for the *missing-migration* case ("it can't write a
  `worker_runs` row because that table is what's missing") but doesn't generalize it to *any* full DB
  outage, and the README's "No message at all" troubleshooting entry reads as if it expects a
  `finder.log` line either way, which is true, just not a DB row. Not a blocking defect; worth a note
  in the README so the owner knows a silent day means "check `finder.log`," not "check `worker_runs`."
- This is distinct from a **partial** failure (e.g. a single board 404, a Claude Code call failing) —
  those are caught inside `findJobs`/`rank` and correctly recorded as `errors` in a normal `ok=true`
  run, verified above (fake-board 404 test).

## Not Verified

- **Real Telegram send/parse-mode.** `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` were deliberately left
  unset per instructions, so `sendTelegram` only exercised its print-fallback path in every live run
  above. The HTTP call itself (`notify.ts`'s `fetch` to `api.telegram.org`, HTML escaping against a
  real Telegram client) is covered by unit tests (`worker/src/notify.test.ts`, mocked `fetch`) but not
  by a live send. Would need real bot credentials to close this gap.
- **Billing destination of the live Claude Code call.** Confirmed the call succeeded and
  `ANTHROPIC_API_KEY` is stripped in code, but nothing in a black-box test can confirm the call was
  actually billed to the subscription rather than some other channel — that would require inspecting
  Anthropic account billing, out of scope here.
- **launchd schedule actually firing a real job.** Validated the generated plist's structure and
  `plutil -lint`, per the instruction not to install the real schedule. Never exercised
  `launchctl bootstrap`/`kickstart` against a real LaunchAgent, so wake-from-sleep coalescing and
  keychain-prompt behaviour (Phase 8 "Potential Issues") are unverified — inherently a real-Mac,
  real-sleep-cycle test, not one an automated session can perform safely.
- **A `worker_runs` row with `ok=false` from a mid-run failure** (as opposed to a pre-insert DB outage).
  Every failure path reachable without touching the DB schema/data (board 404, Claude Code errors) is
  caught internally and produces a normal `ok=true` row with populated `errors` — verified above. To
  force `ok=false` would need a failure *after* the initial `worker_runs` insert succeeds but *inside*
  the try block (e.g. the `jobs` upsert or `notifyNeedsManual` failing) — attempted via a data mutation
  (deleting the single `settings` row) but that command was blocked by the environment's own safety
  classifier ("Cloud Storage Mass Delete") before it ran, and per the tester's own rules that block was
  not worked around. Confirmed via a follow-up `select count(*) from settings` that the row is intact.
  This path remains unverified; the DB-outage variant above was verified instead and shows a different,
  reportable behaviour (see Failures).
- **Anthropic Terms of Service check (Step 8.3)** and **owner's real hosted-project run / ROADMAP tick
  (Step 8.5)** are explicitly owner-gated actions per the plan itself, not testable by an agent.
