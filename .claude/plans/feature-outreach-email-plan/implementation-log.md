# Implementation log: Stage 7, outreach emails sent by the owner

## Phase 1: Tooling and database — 2026-10-03

**Steps completed:** 1.1, 1.2, 1.3
**Files changed:** `harness.config.json`, `supabase/migrations/20261002000100_outreach.sql`, `supabase/tests/outreach.test.sql`, `src/lib/supabase/types.ts` (regenerated)
**Deviations from plan:** none. Docker wasn't running at first; `dockerd` was started in the sandbox and `npx supabase start` pulled its images, so the migration, type generation and pgTAP ran for real. Types came from `npm run db:types` (not hand-written); the only removed lines in the diff are generator lines replaced by longer ones with the new columns and enums. `npm run db:reset` wasn't run (it also creates the owner from `.env.local`, which didn't exist); `supabase start` applied every migration from scratch instead.
**Gate:** `npm run db:test` PASS, 5 files, 46 tests, including the 17 in `outreach.test.sql`.

## Phase 2: Pure outreach logic — 2026-10-03

**Steps completed:** 2.1, 2.2
**Files changed:** `src/lib/outreach.ts`, `src/lib/outreach.test.ts`
**Deviations from plan:** the mailto fallback test used `"x".repeat(1900)`, which makes a Gmail link of about 1,990 characters, under `MAX_URL_LENGTH` (2,000), so the test failed on the plan's own data. Lengthened to 2,100; the code is unchanged. The faithful draft passed `findEmailInventions` with no extra `allowed` words.
**Gate:** `npx vitest run src/lib/outreach.test.ts` PASS.

## Phase 3: Contacts — 2026-10-03

**Steps completed:** 3.1, 3.2, 3.3, 3.4
**Files changed:** `worker/src/hunter.ts`, `worker/src/hunter.test.ts`, `worker/src/contacts.ts`, `worker/src/contacts.test.ts`, `worker/fixtures/hunter-domain-search.json`, `worker/fixtures/hunter-email-finder.json`
**Deviations from plan:** none. The fixtures are documentation-based (their `_source` says so); hunter.io is blocked from the sandbox.
**Gate:** `npx vitest run worker/src/hunter.test.ts worker/src/contacts.test.ts` PASS.

## Phase 4: Drafts — 2026-10-03

**Steps completed:** 4.1, 4.2
**Files changed:** `worker/src/outreach.ts`, `worker/src/outreach.test.ts`
**Deviations from plan:** `outreachForJob` destructured `const { contacts } = await findContacts(...)`, but the revised `findContacts` returns the list itself; fixed to `const contacts = ...`. The last draft test's `vi.fn(async () => …)` didn't typecheck for `mock.calls[0][0]` (as the plan's issues predicted); typed with the explicit generic.
**Gate:** `npx vitest run worker/src/outreach.test.ts` PASS; `npm run typecheck` PASS.

## Phase 5: Wiring — 2026-10-03

**Steps completed:** 5.1, 5.2, 5.3, 5.4
**Files changed:** `src/lib/finder.ts`, `worker/src/run.ts`, `worker/src/notify.ts`, `worker/src/notify.test.ts`, `worker/src/watch.ts`, `worker/.env.example`, `worker/README.md` (step 6e)
**Deviations from plan:** none.
**Gate:** `npm run typecheck` PASS; `npx vitest run worker/src/notify.test.ts src/lib/finder.test.ts` PASS (19).

## Phase 6: The button and the job page — 2026-10-03

**Steps completed:** 6.1, 6.2, 6.3
**Files changed:** `src/app/(app)/jobs/outreach-actions.ts`, `src/app/(app)/jobs/send-email-button.tsx`, `src/app/(app)/jobs/[id]/outreach-panel.tsx`, `src/app/(app)/jobs/outreach-state.ts` (new, not in the plan), `src/app/(app)/jobs/page.tsx`, `src/app/(app)/jobs/[id]/page.tsx`
**Deviations from plan:** the plan called `Date.now()` in the two server components; ESLint's `react-hooks/purity` rejects that ("Cannot call impure function during render"). Added `outreach-state.ts` (`requestStatesNow`), a `server-only` helper that reads the clock, the same way `finder-state.ts` does for the dashboard. `referencedTable` was checked in the installed `@supabase/postgrest-js` types (present).
**Gate:** `npm run typecheck` PASS; `npm run lint` PASS.

## Phase 7: Follow-ups — 2026-10-03

**Steps completed:** 7.1, 7.2
**Files changed:** `src/app/api/cron/ghosting/route.ts`, `src/app/(app)/page.tsx`
**Deviations from plan:** none. The `jobs!inner` embed typed as a single object, as the plan expected.
**Gate:** `npm run verify` PASS: lint, typecheck, 158/158 vitest, 14/14 Python.

## Phase 8: Checks and docs — 2026-10-03

**Steps completed:** 8.4. Step 8.1 handed to the tester agent (results below when in). 8.2 and 8.3 wait for the owner.
**Files changed:** `docs/ROADMAP.md` (the rest of the owner's decisions, "Last updated"), `CONVENTIONS.md` (State, Stack, two product rules, three traps)
**Deviations from plan:** none. Roadmap boxes 7.1–7.6 stay unticked until the owner's hosted run, as the plan says.
**Gate:** `grep -q "outreach_emails" CONVENTIONS.md` PASS.
**Waiting for the owner (not gaps):** 8.2, recording real Hunter answers with the owner's key and `npx supabase db push` before the first hosted run; 8.3, trying the Gmail link formats and a long draft in the owner's browser. Follow Ups Question 1 (a minimum Hunter score) uses the plan's default: every Hunter answer kept, with its score shown.
