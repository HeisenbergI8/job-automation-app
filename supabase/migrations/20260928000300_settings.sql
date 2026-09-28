-- Stage 2.5 and 3: follow-up thresholds, job criteria, master CV and self-intro.
-- A single row: this app has one owner.

create type public.remote_preference as enum ('remote', 'hybrid', 'onsite', 'any');

create table public.settings (
  id boolean primary key default true check (id),
  -- 2.5: remind after this many days with no reply, then mark ghosted.
  follow_up_after_days integer not null default 7 check (follow_up_after_days > 0),
  ghost_after_days integer not null default 21,
  -- 3.1: job criteria.
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  remote_preference public.remote_preference not null default 'any',
  salary_floor numeric check (salary_floor >= 0),
  salary_currency text,
  must_have_keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  -- 3.2: structured master CV; its shape is validated by the app (src/lib/master-cv.ts).
  master_cv jsonb,
  -- 3.3: written answer to "Tell us about yourself".
  self_intro text,
  updated_at timestamptz not null default now(),
  check (ghost_after_days > follow_up_after_days)
);

insert into public.settings default values;

alter table public.settings enable row level security;
create policy "owner reads settings" on public.settings
  for select to authenticated using (true);
create policy "owner updates settings" on public.settings
  for update to authenticated using (true) with check (true);
revoke insert, delete on public.settings from anon, authenticated;

-- 2.5: applications with no reply after follow_up_after_days, for the dashboard reminder.
create view public.follow_up_jobs with (security_invoker = true) as
  select jobs.id, jobs.company, jobs.role, jobs.date_applied
  from public.jobs, public.settings
  where jobs.status = 'applied' and jobs.date_applied <= current_date - settings.follow_up_after_days;

-- 2.5: jobs still `applied` after ghost_after_days are marked ghosted through set_job_status().
-- Run daily by the Vercel cron route with the service role.
create function public.mark_ghosted_jobs() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_job_id uuid;
  v_count integer := 0;
begin
  select ghost_after_days into v_days from public.settings;
  for v_job_id in
    select id from public.jobs where status = 'applied' and date_applied <= current_date - v_days
  loop
    perform public.set_job_status(v_job_id, 'ghosted', format('No reply after %s days', v_days));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.mark_ghosted_jobs from public, anon, authenticated;
grant execute on function public.mark_ghosted_jobs to service_role;
