-- Review of supabase/migrations/20260928000300_settings.sql. Follow-up thresholds, criteria, master CV.
-- Relevant to stage 7: how the existing reminder and the ghosting cron work.

-- IMPORTANT: the dashboard's reminder is a VIEW computed live, not something the cron writes. The cron
-- (src/app/api/cron/ghosting/route.ts) only calls mark_ghosted_jobs(). The outreach follow-up view
-- (outreach_follow_ups_due) copies this security_invoker style.
create view public.follow_up_jobs with (security_invoker = true) as
  select jobs.id, jobs.company, jobs.role, jobs.date_applied
  from public.jobs, public.settings
  where jobs.status = 'applied' and jobs.date_applied <= current_date - settings.follow_up_after_days;

-- NOTE: the cron's only job today. It runs daily at 01:00 UTC (vercel.json), with the service role.
create function public.mark_ghosted_jobs() returns integer
language plpgsql security definer set search_path = '' as $$ /* set_job_status(..., 'ghosted', ...) per stale job */ $$;

-- NOTE: follow_up_after_days (default 7) is for applications. The owner's 5 days for outreach emails is
-- a separate, fixed number (FOLLOW_UP_AFTER_DAYS), not this setting.
