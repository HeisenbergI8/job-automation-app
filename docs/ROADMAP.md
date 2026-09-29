# Roadmap

The build checklist for [`SPEC.md`](SPEC.md), in the spec's build order and split into chunks small
enough to plan, build and verify one at a time. Tick a box only when its **Done when** is true and
`npm run verify` is green.

**How to work a chunk:** work top to bottom, and don't start a stage until the one before it is done.
Small chunks can be built directly. For bigger ones (marked **[plan]**), have the `architect` agent
write a plan in `.claude/plans/`, then run it with `/build <label> --plan <path>`.

Last updated 2026-09-29. Stages 0–4 are built and verified; stage 5 is being built
(plan: `.claude/plans/feature-daily-finder-plan/`).

---

## Stage 0: Foundation

Everything later depends on these. They aren't in the spec's build order, but stage 1 can't start
without them.

- [x] **0.1 Supabase connection.** Install `@supabase/supabase-js` and `@supabase/ssr`, and fill in
  `.env.local` from `.env.example`. Add one browser client and one server client under `src/lib/supabase/`.
  The service-role key is used on the server only.
  *Done when:* a server component can read from Supabase locally.
- [x] **0.2 Migrations workflow.** Supabase CLI, `supabase/migrations/`, and a script that generates the
  database types into `src/lib/supabase/types.ts`.
  *Done when:* one empty migration applies cleanly and the generated types compile.
- [x] **0.3 Owner-only auth.** Log in with Supabase Auth, and protect every route with `proxy.ts`
  (Next 16's replacement for `middleware.ts`). Row-level security is on for every table from here on.
  *Done when:* logged out, every page redirects to the login page. Logged in, the owner sees the app.
- [x] **0.4 App shell.** Replace the starter page with a layout and navigation: Dashboard, Jobs, Analytics,
  Settings. Empty pages are fine for now.
  *Done when:* all four pages load behind login.

## Stage 1: Job record and dashboard **[plan]**

- [x] **1.1 Schema.**
  - A `jobs` table with: site, url, company, role, salary (min, max, currency, and the raw text), date
    found, date applied, status, a saved copy of the job description, apply method (auto or manual),
    and fit score plus reasons (empty until stage 5).
  - A `job_status_events` table that stores one dated row per status change.
  - The status values are fixed, exactly as in the spec.

  *Done when:* the migration applies and the generated types include both tables.
- [x] **1.2 One way to change status.** A single server action that writes the event row and updates
  `jobs.status` together, and refuses transitions the spec doesn't allow.
  *Done when:* an invalid transition is rejected and every valid one leaves exactly one event row.
- [x] **1.3 Jobs list.** A table with status, company, role, site, date applied and salary. It can be
  filtered by status and site and sorted by date.
  *Done when:* seeded jobs show up and the filters work.
- [x] **1.4 Job detail page.** All the fields, the saved job description, the status timeline, and a
  control for changing status.
  *Done when:* changing a status on the page adds a dated timeline entry.
- [x] **1.5 Add a job by pasting a link.** A form that takes the link plus the key fields, with status
  `found`. Filling the fields in automatically from the link is left to the worker (stage 5).
  *Done when:* a pasted job appears in the list and on its own detail page.
- [x] **1.6 Documents sent.**
  - An `application_documents` table (CV, cover letter or intro, linked to a job).
  - A Storage bucket for the files.
  - Download links on the detail page.

  *Done when:* a file uploaded by hand appears on the job and downloads.
- [x] **1.7 Dashboard home.** Counts by status, and the latest status changes.
  *Done when:* the numbers match the jobs list.

## Stage 2: Analytics **[plan]**

- [x] **2.1 Applications over time** (per week).
- [x] **2.2 Funnel:** applied → screening → interview → offer.
- [x] **2.3 Response rate**, broken down by site and by auto-applied vs manual.
- [x] **2.4 Salary spread and average days to first reply.** Both are worked out from the status events.
- [x] **2.5 Follow-up reminders and auto-ghosting.** After X days with no reply, remind the owner. After
  that, mark the job `ghosted` through the 1.2 status action.
  *Decided:* a daily Vercel cron job (`/api/cron/ghosting`, `vercel.json`). Reminders show on the
  dashboard; notifications come with 5.6.

*Stage done when:* every chart's numbers can be checked by hand against a small seeded dataset.

## Stage 3: Settings

- [x] **3.1 Job criteria:** target roles, locations, remote preference, salary floor, must-have and
  excluded keywords.
- [x] **3.2 Master CV.** Store it in a structured form that the tailoring step can check against.
  *Decided:* entered as structured sections.
- [x] **3.3 Written self-intro** for "Tell us about yourself" questions.
- [x] **3.4 Teleprompter page.** The intro scrolls as captions, with adjustable speed.

## Stage 4: CV and cover-letter tailoring **[plan]**

- [x] **4.1 Claude API client.** Install `@anthropic-ai/sdk`. It runs on the server and in the worker
  only. *Decided:* Claude Opus 5.5 (`claude-opus-5-5`) for tailoring.
- [x] **4.2 ATS keyword match score** for the master CV against a job description.
- [x] **4.3 CV tailoring.** It only rewords and reorders. Add a check that rejects any output containing
  a skill, employer, title or date that isn't in the master CV.
  *Done when:* a test with a deliberately invented skill is rejected.
- [x] **4.4 Cover letter**, generated under the same no-invention rule.
- [x] **4.5 Rendering and storage.** Produce ATS-friendly PDFs, save them to Storage, link them through
  `application_documents`, and show the keyword score before and after.
- [x] **4.6 Intro adaptation with approval.** Adapt the intro to the job's format and put it on hold until
  the owner approves it. The application waits in the meantime.
  *Done when:* an unapproved intro can't be used.

## Stage 5: Daily finder (worker) **[plan]**

- [ ] **5.1 Worker scaffold.**
  - Its own `package.json` and `tsconfig.json` (and exclude `worker/` from the root tsconfig).
  - A Supabase service client.
  - A run log (`worker_runs` table, plus `worker/logs/finder.log`).
  - A once-a-day schedule on the Mac (launchd, 8:00 local time; runs on wake if the Mac was asleep).
- [ ] **5.2 Career-page sources:** Greenhouse, Lever and Ashby public job boards, for the companies
  listed in Settings (`career_boards`). A board that can't be read is shown in red in Settings.
- [ ] **5.3 Job-board sources, read-only:** LinkedIn, Indeed, JobStreet.
  *Built 2026-09-29 (owner request):* read through JSearch (RapidAPI, free plan of 200 requests a month),
  which collects them from Google for Jobs. The finder never visits those sites itself. At most 6
  searches a run (target roles × listed countries, remote, last 3 days). These sites are searched,
  never applied to. Ticked after the owner's first run with a JSearch key.
- [ ] **5.4 Duplicate removal** across sites (same company, role and location).
- [ ] **5.5 Scoring.** Score each job against the criteria and master CV, keep the reasons, and save the
  top 3 each day as `found`, but only jobs scoring 50 or more (`MIN_FIT`), so some days save 0–2.
  *Decided:* Claude Code headless (`claude -p`, Sonnet) with the owner's subscription, no paid API.
  Keyword-only scoring when Claude Code is unavailable.
- [ ] **5.6 Notify the owner** about each new batch and each job marked `needs_manual`.
  *Decided:* a Telegram bot.

## Stage 6: Auto-apply with link fallback **[plan]**

*Decided 2026-09-29:* no paid API budget. As part of this stage, move CV/cover-letter tailoring and
intro adaptation (4.1–4.6, `src/lib/claude.ts`) from the paid Claude API to Claude Code headless on
the owner's subscription, the same way 5.5 scores. Stage 5 leaves `src/lib/claude.ts` unchanged.

- [ ] **6.1 Hard block.** Refuse to apply on LinkedIn, Indeed and JobStreet, checked in code with a test.
  This comes before any apply code exists.
- [ ] **6.2 Dry-run mode.** Fill in the whole form but never submit it. Save screenshots for review.
- [ ] **6.3 Apply adapters** for Greenhouse, Lever and Ashby (Playwright).
- [ ] **6.4 Blocker detection.** A CAPTCHA, login wall, required account or required video intro means
  stop, set `needs_manual`, notify with the link, and have the teleprompter script ready. The worker
  never tries to solve a CAPTCHA.
- [ ] **6.5 Record what was sent.** Store the exact CV, cover letter and intro used on the job, and
  change the status to `applied` through the 1.2 status action.

*Stage done when:* several dry runs look right before the first real submission.

---

## Open decisions

To be settled before the chunk they block:

| Decision | Blocks |
| --- | --- |
| Whether each job board's terms allow automated searching | 5.3 |

Settled on 2026-09-28: ghosting runs as a Vercel cron job (2.5), the master CV is structured sections
(3.2), and tailoring uses Claude Opus 5.5 (4.1).

Settled on 2026-09-29: scoring runs on Claude Code headless with the owner's subscription (Sonnet),
with a keyword fallback, and only jobs scoring 50 or more are saved, so 0–3 a day (5.5). The first
sources are Greenhouse, Lever and Ashby only, with LinkedIn, Indeed and JobStreet deferred (5.2, 5.3).
Notifications go to Telegram (5.6). The worker runs daily at 8:00 via launchd (5.1). Tailoring moves
off the paid API to Claude Code as part of stage 6.
