-- Review of supabase/migrations/20260928000100_job_record.sql (172 lines). Only the parts Stage 5 relies on.
-- The jobs table, the fixed status transitions, set_job_status(), and the triggers that guard status.

-- IMPORTANT: url is unique, which is the worker's hard dedupe guarantee (insert ... on conflict (url) do nothing).
-- NOTE: fit_score / fit_reasons already exist and are nullable, so Stage 5 needs no jobs migration.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  url text not null unique,
  company text not null,
  role text not null,
  location text,
  salary_min numeric check (salary_min >= 0),
  salary_max numeric check (salary_max >= salary_min),
  salary_currency text,
  salary_raw text,
  date_found date not null default current_date,
  status public.job_status not null default 'found',
  description text,
  fit_score smallint check (fit_score between 0 and 100),
  fit_reasons text[],
  -- ...
);

-- IMPORTANT: new jobs must start as 'found'; the worker omits status and lets the default apply.
create function public.guard_job_status() returns trigger ... as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'found' then
      raise exception 'New jobs start as found' using errcode = 'check_violation';
    end if;
  elsif new.status is distinct from old.status
    and coalesce(current_setting('app.status_change', true), 'off') <> 'on' then
    raise exception 'Change a job''s status through set_job_status()' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- NOTE: every inserted job gets a 'found' timeline event automatically; the worker writes no events itself.
create function public.record_job_found() returns trigger ... security definer ... as $$
begin
  insert into public.job_status_events (job_id, from_status, to_status)
  values (new.id, null, 'found');
  return null;
end;
$$;

-- NOTE: job_status_events.job_id references jobs(id), which is the FK the worker's
-- `select("note, jobs(company, role, url)")` embed depends on for the needs_manual notifications.
create table public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  note text,
  changed_at timestamptz not null default clock_timestamp()
);

-- NOTE: the service role may call set_job_status (Stage 6 will; Stage 5 never changes a status).
grant execute on function public.set_job_status to authenticated, service_role;
