-- Review of supabase/migrations/20260928000300_settings.sql (66 lines). Only the columns the worker reads.
-- A single-row settings table holding the job criteria (3.1) and the structured master CV (3.2).

-- NOTE: exactly one row (id boolean primary key check (id)), so the worker reads it with .single().
-- NOTE: these seven columns are the scoring `Criteria` type in worker/src/scoring.ts.
create table public.settings (
  id boolean primary key default true check (id),
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  remote_preference public.remote_preference not null default 'any',  -- 'remote' | 'hybrid' | 'onsite' | 'any'
  salary_floor numeric check (salary_floor >= 0),
  salary_currency text,
  must_have_keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  -- IMPORTANT: master_cv's shape is validated by the app only (src/lib/master-cv.ts), so the worker must
  -- go through parseMasterCv() and handle null (no CV yet, or an outdated shape).
  master_cv jsonb,
  -- ...
);

-- NOTE: this is also the pattern for a DB function run by a scheduled job with the service role
-- (mark_ghosted_jobs, run daily by the Vercel cron). Stage 5 needs no DB function: its logic lives in the worker.
revoke execute on function public.mark_ghosted_jobs from public, anon, authenticated;
grant execute on function public.mark_ghosted_jobs to service_role;
