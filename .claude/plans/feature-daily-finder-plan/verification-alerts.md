# Verification: job-alert email reader (worker/src/alerts.ts)

**Date:** 2026-09-29
**Scope:** commit 8e7e2e5 "Read the owner's LinkedIn, JobStreet and Indeed job-alert emails" —
`worker/src/alerts.ts`, its wiring in `worker/src/run.ts`, migration
`supabase/migrations/20260929000400_processed_emails.sql`. Background: last section of
`.claude/plans/feature-daily-finder-plan/implementation-log.md`.
**Dependencies reachable:** yes — local Supabase stack was already running (`npx supabase status`);
Docker OK. No real Gmail mailbox (forbidden, and not attempted). 1 of 2 permitted live Claude Code calls
used.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run verify` | PASS | lint clean; typecheck (root + `-p worker`) clean; `Test Files 10 passed (10)`, `Tests 90 passed (90)` |
| `npm run db:test` | PASS | `Files=4, Tests=29, ... Result: PASS` (includes `worker.test.sql`'s `processed_emails` INSERT-privilege check) |
| unit: `alerts.test.ts` | PASS (part of verify) | `canonicalJobUrl`, `emailLinks`, `toPostings` cases all pass — `worker/src/alerts.test.ts` |
| behavioural: readJobAlerts vs local fake IMAP server | PASS (see notes) | `scratchpad/imap-e2e/{driver.mts,fake-server.mjs,fake-server-cap.mjs,fake-claude.mjs}`, logs `run2.log`, `run-cap.log`, `server-debug.log` — detail below |
| behavioural: extraction quality, live Claude Code | PASS | `scratchpad/imap-e2e/extract-live.mts`, log `extract-live.log` — detail below |
| RLS `processed_emails` | PASS (see notes) | catalog query + live REST probe — detail below |
| migration applies cleanly from scratch | PASS | `npm run db:reset` output: `Applying migration 20260929000400_processed_emails.sql...` with no error, as part of a full reset |

### RLS on `processed_emails`

- **Catalog read** (`docker exec supabase_db_job-automation-app psql`, read-only queries against
  `pg_policy`/`information_schema.role_table_grants`/`pg_class`): `relrowsecurity = t`; exactly one
  policy, `"owner reads processed emails"`, `polcmd = 'r'` (SELECT), `polroles = {authenticated}`,
  `polqual = true` — matches the migration text. No policy exists for `anon`, so with RLS enabled and
  no applicable policy, Postgres denies all rows to `anon` regardless of table-level grants (Supabase's
  default schema grants give `anon`/`authenticated` table-level `SELECT`, which is normal for this
  project — the same pattern likely holds for other RLS'd tables, not something introduced here).
- **pgTAP** (`npm run db:test`, part of `worker.test.sql`): `has_table_privilege('authenticated',
  'public.processed_emails', 'INSERT')` is false — "only the worker records processed emails". PASS
  (already counted in the 29/29 above).
- **Live REST probe** (local stack, `http://127.0.0.1:54321/rest/v1/processed_emails`, anon key and
  service-role key read from `npx supabase status -o env`, never printed): anon `GET` → `[]` both before
  and after a row existed (service-role insert in between), confirming it is genuinely RLS-filtered and
  not just "no rows yet"; anon `POST` → `401`; service-role `POST` → `201`; service-role `GET` → the
  row; cleanup `DELETE` → `204`. Row removed, table left as `db:reset` seeded it.
- **Not verified live:** a real `authenticated` (owner) session actually seeing rows via REST. Minting
  or reading a session for the seeded owner needs `OWNER_EMAIL`/`OWNER_PASSWORD` from `.env.local`, and
  a direct read of those was blocked by the environment's own credential-materialization safety
  classifier; per the tester's own rules that block was not worked around. The `polroles =
  {authenticated}, polqual = true` catalog fact plus the anon-denied proof above make it very likely
  reading as `authenticated` works, but this specific path is catalog-verified rather than
  live-verified.

### Live extraction-quality test (the primary use of the 2 permitted Claude Code calls)

`scratchpad/imap-e2e/extract-live.mts` builds a realistic synthetic LinkedIn "job alert" digest (raw
RFC822 source, parsed with the real `mailparser`): 4 real job cards, each with a job-title tracking link
**and** a separate, distinct "company page" link right next to it (to see whether the right one is
picked), one "Jobs you may like" promo banner with no specific job, and a footer with alert-settings,
notification-settings, unsubscribe, help, user-agreement and privacy-policy links — 15 links total, only
4 of which are real jobs. It runs the actual `EXTRACT_SYSTEM` prompt/JSON schema (private to
`alerts.ts`, copied verbatim, diffed against `worker/src/alerts.ts:56-81`) through the REAL exported
`askClaudeCode`/`structuredOutput`, with a genuine live `claude -p` call (`CLAUDE_BIN` unset), then the
REAL exported `toPostings` (which internally calls the real `canonicalJobUrl`).

| Check | Result | Evidence |
| --- | --- | --- |
| Each job mapped to its own job-title link, not the adjacent company-page link | PASS | links 1,3,6,8 (job titles) chosen; links 2,4,7,9 (company pages) never chosen — `extract-live.log` |
| Non-job links skipped (promo banner, settings, unsubscribe, footer/legal) | PASS | none of links 2,4,5,7,9-15 (11 of 15) appear in Claude's output — `extract-live.log` |
| `toPostings` end-to-end: canonicalisation, remote detection, posted_at, description | PASS | all 4 LinkedIn tracking URLs → canonical `/jobs/view/<id>/`; remote correctly true/false/true/false for Remote/Hybrid/Remote/On-site; `posted_at` = the email's own `Date:` header (`2026-09-29T06:00:00.000Z`), not now; description = summary + the LinkedIn-alert suffix — `extract-live.log` |
| No hallucinated/invented links | PASS | all 4 returned `link` numbers (1, 3, 6, 8) are real, in-range indices into the numbered link list that was actually sent — `extract-live.log` |

**Claude Code calls used: 1 of the 2 permitted.** (The IMAP-mechanics e2e run above used a fake
`claude` binary via `CLAUDE_BIN`, spending zero live calls; the second permitted call was not needed.)

### readJobAlerts end-to-end against a local fake IMAP server

**Fidelity note:** `readJobAlerts` hardcodes `host: "imap.gmail.com", port: 993`
(`worker/src/alerts.ts:130-131`) with no env override, so the real exported function cannot itself be
pointed at a local server without editing source (forbidden) or an OS-level DNS override (not
attempted — out of scope/risk for a test). Per the task's own instruction ("point GMAIL_* env at the
fake server only via a scratch copy"), `scratchpad/imap-e2e/driver.mts` mirrors the connect/search/cap/
skip loop line-for-line from `worker/src/alerts.ts:128-163` with host/port parameterised, while
importing and calling the REAL exported pieces unmodified: `ALERT_SENDERS`, `MAX_ALERT_EMAILS`,
`emailLinks`, `toPostings`, `askClaudeCode`, `structuredOutput` (all from `worker/src/alerts.ts` /
`worker/src/scoring.ts`, straight imports, no copy). `EXTRACT_SYSTEM`/the JSON schema are private to
`alerts.ts`, so their literal string/object content was copied verbatim (diffed by eye against
`worker/src/alerts.ts:56-81`) — not reimplemented logic. Extraction itself is answered by a fake
`claude` binary (`scratchpad/imap-e2e/fake-claude.mjs`) via `CLAUDE_BIN` (the worker's own documented
override point, `worker/.env.example`), so no live Claude Code call was spent on this mechanics test.
Server: `hoodiecrow-imap` (`scratchpad/imap-e2e/fake-server.mjs`, TLS via its bundled self-signed
cert), 7 synthetic messages covering all three alert senders plus edge cases; a second config
(`fake-server-cap.mjs`) with 10 in-window LinkedIn messages for the cap check.

| Sub-check | Result | Evidence |
| --- | --- | --- |
| Mailbox opened read-only, no flags/moves/deletes | PASS | `server-debug.log`: client command trace is exactly `CAPABILITY, ID, AUTHENTICATE PLAIN, CAPABILITY, ID, NAMESPACE, LIST, LSUB, EXAMINE INBOX, UID SEARCH ..., UID FETCH ... (BODY.PEEK[] UID), ..., LOGOUT` — `EXAMINE` (not `SELECT`) is the read-only mailbox open, `BODY.PEEK[]` fetches without setting `\Seen`; no `STORE`/`COPY`/`MOVE`/`EXPUNGE` anywhere in the trace |
| Only linkedin.com/jobstreet/indeed.com senders, last 2 days | PASS | `server-debug.log` line 34: `UID SEARCH SINCE 27-Sep-2026 FROM linkedin.com` → matched UIDs 1,4,6 only (the in-window LinkedIn messages); the message from `hello@example.com` (non-matching sender) never appears in any search result; the message dated 5 days back (`li-old-1`) is correctly excluded by the `SINCE 27-Sep-2026` cutoff (now=2026-09-29T09:00, LOOKBACK_DAYS=2) |
| Already-processed Message-IDs skipped | PASS | `run2.log`: `<li-processed-1@linkedin.com>` (passed in the `processed` set) was matched by the LinkedIn search (UID 4, fetched) but produced neither a posting nor an error — the `if (processed.has(messageId)) continue;` skip, confirmed before any extraction call |
| `MAX_ALERT_EMAILS` cap (8) respected | PASS | `run-cap.log`: 10 new, unprocessed, in-window LinkedIn messages available; `COUNT: 8`, message IDs `li-cap-1`..`li-cap-8` only — `li-cap-9`/`li-cap-10` never attempted |
| A single email's extraction failure is reported, not fatal | PASS | `run2.log`: `<li-broken-1@linkedin.com>` (fake claude exits 1) produced exactly one error string `"Couldn't read a LinkedIn alert (\"TRIGGER_EXTRACT_ERROR\"): Claude Code stopped (exit 1): simulated Claude Code failure"`, and the run continued to process the JobStreet and Indeed emails afterward (both appear in `EMAILS`) |
| Only links present in the email are used; hallucinated link numbers dropped | PASS | fake-claude included a job at `link: 99` (out of range) for the LinkedIn email; `run2.log`'s `EMAILS` array shows only 2 postings for that message (links 1 and 2), the link-99 "Ghost Co" job is absent — `toPostings`' real, unmodified filtering dropped it |
| Non-job links (settings/unsubscribe/help) never turn into postings | PASS | the LinkedIn email's "Manage alert settings"/"Unsubscribe" links and JobStreet's "Help" link are present in the email HTML but never referenced by any returned job — consistent with `EXTRACT_SYSTEM`'s instruction and confirmed by the postings list containing only the two/one real job(s) per email |
| Link canonicalisation end-to-end (real `canonicalJobUrl` via `toPostings`) | PASS | `run2.log`: LinkedIn tracking URL → `https://www.linkedin.com/jobs/view/4012340001/`; JobStreet `?type=alert&ref=email` → `https://ph.jobstreet.com/job/81234567`; Indeed `/rc/clk?jk=...` → `https://ph.indeed.com/viewjob?jk=a1b2c3d4e5` |
| `site` = linkedin/jobstreet/indeed; `posted_at` = email date | PASS | `run2.log`: each posting's `site` matches its sender; `posted_at` is `2026-09-28T13:00:00.000Z` / `03:00:00.000Z` / `23:00:00.000Z` respectively, matching each synthetic message's own `Date:` header (20h/30h/10h before the fixed `now`), not the current time |
| Hybrid marked not remote | PASS | `run2.log`: "Frontend Engineer" at "Makati (Hybrid)" → `"remote": false`; "Senior Backend Engineer" at "Manila, Philippines (Remote)" → `"remote": true` |

## Failures

None found in `worker/src/alerts.ts`, its `run.ts` wiring, or the migration. See "Incident" below for a
tooling mistake made *by this verification run itself* (not a defect in the code under test), fully
corrected before finishing.

### Incident: an accidental root `npm install` during setup (self-caused, corrected)

While installing test-only IMAP fixtures for the scratchpad, one combined Bash command had a stray
`npm install imapflow mailparser` line without its own `cd`, which ran at the project root (Bash cwd
resets between calls) before the corrected, properly-`cd`'d line ran in the scratchpad. This left
`imapflow`/`mailparser` added to the tracked root `package.json`/`package-lock.json` and root
`node_modules`. Caught by a routine `git status` before finishing: `git checkout -- package.json
package-lock.json` restored both tracked files to the committed version, `npm install` re-synced
`node_modules` (confirmed `imapflow`/`mailparser` no longer present at root), and `npm run verify` was
re-run afterward (still lint clean, typecheck clean, 90/90). Final `git status --short` shows only this
report as untracked. Not a source edit to make a check pass — the source tree was never touched, only an
accidental dependency-install side effect, which was reverted before any check was evaluated against it.

## Not Verified

- **A real Gmail mailbox.** Explicitly out of scope per the task's hard rules; not attempted. The
  `readJobAlerts` connection itself (`host: "imap.gmail.com", port: 993`, hardcoded, no env override —
  `worker/src/alerts.ts:130-131`) was therefore exercised via a faithful scratch reproduction against a
  local fake IMAP server rather than by invoking the real exported function directly; see the fidelity
  note above for exactly what was copied vs. imported unmodified.
- **RLS `processed_emails` SELECT as a real authenticated (owner) session.** Blocked by the
  environment's own credential-materialization safety classifier when reading `OWNER_EMAIL`/
  `OWNER_PASSWORD` from `.env.local`; not worked around. Covered instead by a `pg_policy` catalog read
  (policy scoped to `authenticated`, `using (true)`) plus a live proof that `anon` is denied both ways
  (empty `SELECT`, `401` on `INSERT`).
- **A live JobStreet or Indeed alert email's real HTML structure.** The synthetic emails used
  plausible, hand-built HTML for all three sites; the implementation log itself flags "the first real
  alert emails will show whether extraction and link handling fit each site's format" as unverified —
  still true after this pass, since no real alert email of any kind was available. LinkedIn's structure
  was modelled most closely (multiple job cards, tracking links, decoy company-page links); JobStreet
  and Indeed were only tested with one simple job each, via the fake-claude mechanics test, not the live
  extraction-quality test.
- **Coverage gap in the repo's own test suite (not something this run can fix — tester may not edit
  source):** `worker/src/alerts.test.ts` covers only the pure helpers (`canonicalJobUrl`, `emailLinks`,
  `toPostings`). `readJobAlerts` itself — the IMAP search criteria, the read-only lock, the
  already-processed skip, the `MAX_ALERT_EMAILS` cap, and per-email error isolation — has zero automated
  regression coverage in the repository; it was previously untested by any committed test and remains
  so. This verification run's `scratchpad/imap-e2e/` scripts close the gap for this one pass but are not
  committed, so the same mapping/contract boundary (Gmail → `Posting[]`) has no regression protection
  going forward. Worth a `readJobAlerts`-level test (even one behind a `SKIP_LIVE_IMAP` guard, mirroring
  this run's fake-IMAP-server approach) if the owner wants this protected long-term.
- **The owner's actual Gmail app-password setup and first live run.** Explicitly owner-gated (the
  implementation log's own "Not verified yet: everything live" note), unchanged by this pass.
