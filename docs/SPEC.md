# Job Automation App: MVP Spec

## Purpose

Keep applying for jobs while I'm busy looking for clients. Every job I apply to is recorded, so I never forget where, when, what role or what salary.

## Stack

- **Next.js** (`src/`): dashboard, analytics, job records, settings. Deployed on Vercel.
- **Worker** (`worker/`): plain Node + Playwright. Runs once a day on my Mac: search, score, tailor, apply.
- **Supabase** (`supabase/`): Postgres database, Storage (CVs, cover letters, intro videos), Auth.
- **Claude API**: fit scoring, CV and cover letter tailoring, self-intro adaptation.

## Features

### 1. Daily job finder (3 jobs)
- Searches LinkedIn, Indeed, JobStreet and company career pages, and reads each full job description.
- Scores every job against **my criteria and master CV**, both set in the app.
- Picks the top 3 per day.
- Each job shows its fit score and the reasons behind it.
- Duplicates across sites are removed.

### 2. Auto-apply with link fallback
- The AI applies by itself where it can (company career pages such as Greenhouse, Lever, Ashby).
- When blocked (CAPTCHA, login wall, account required, video intro required), it sends me the link and records the job as `needs_manual`.
- Never bypasses a CAPTCHA. Never auto-applies on LinkedIn, Indeed or JobStreet (protects my accounts).

### 3. Job record
- Website, date found, date applied, role, company, salary, job description.
- Status: `found → applied | needs_manual → screening → interview → offer | rejected | ghosted`
- Every status change is dated (timeline).
- Saved copy of the job description, since postings get deleted.
- Exact CV, cover letter and intro sent for that job.
- Add a job manually by pasting a link.

### 4. Analytics
- Applications over time.
- Funnel: applied → screening → interview → offer.
- Response rate by website, and auto-applied vs manual.
- Salary spread; average days until a reply.
- Follow-up reminder after X days with no reply, then auto-mark `ghosted`.

### 5. Tailored CV and cover letter (auto-used, no review)
- Rewrites my CV around each job's keywords, ATS-friendly; writes a cover letter.
- **Rule:** only rewords and reorders what is in my master CV. Never adds skills or experience I don't have.
- ATS keyword match score before and after tailoring.

### 6. Self-introduction
- Written version for form questions ("Tell us about yourself").
- Teleprompter: the script scrolls as captions while I record a video.
- Format check: if a job asks for a different format (length, word count, specific questions), the AI adapts the intro **and shows it to me before use**. That application waits for my OK.
- Jobs requiring a video go to manual apply, with the teleprompter script ready.

## Build order

1. Job record + dashboard (Supabase schema, status tracking)
2. Analytics
3. Settings: criteria, master CV, self-intro
4. CV and cover letter tailoring
5. Daily finder (top 3)
6. Auto-apply with link fallback
