-- Stage 1: the job record and its status timeline (ROADMAP 1.1, 1.2).

create type public.job_status as enum (
  'found', 'applied', 'needs_manual', 'screening', 'interview', 'offer', 'rejected', 'ghosted'
);
create type public.apply_method as enum ('auto', 'manual');

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
  date_applied date,
  status public.job_status not null default 'found',
  -- Saved copy, because postings get deleted.
  description text,
  apply_method public.apply_method,
  -- Filled in by the daily finder (stage 5).
  fit_score smallint check (fit_score between 0 and 100),
  fit_reasons text[],
  created_at timestamptz not null default now()
);

create index jobs_status_idx on public.jobs (status);
create index jobs_site_idx on public.jobs (site);

create table public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  note text,
  -- clock_timestamp(), not now(), so moves made in one transaction still order correctly.
  changed_at timestamptz not null default clock_timestamp()
);

create index job_status_events_job_idx on public.job_status_events (job_id, changed_at);

-- The allowed moves, from the spec:
--   found -> applied | needs_manual -> screening -> interview -> offer | rejected | ghosted
-- needs_manual -> applied is the owner applying by hand. ghosted -> screening | rejected exists
-- because ghosting is marked automatically and a late reply must still be recordable.
create table public.job_status_transitions (
  from_status public.job_status not null,
  to_status public.job_status not null,
  primary key (from_status, to_status)
);

insert into public.job_status_transitions (from_status, to_status) values
  ('found', 'applied'),
  ('found', 'needs_manual'),
  ('needs_manual', 'applied'),
  ('applied', 'screening'),
  ('applied', 'rejected'),
  ('applied', 'ghosted'),
  ('screening', 'interview'),
  ('screening', 'rejected'),
  ('screening', 'ghosted'),
  ('interview', 'offer'),
  ('interview', 'rejected'),
  ('interview', 'ghosted'),
  ('ghosted', 'screening'),
  ('ghosted', 'rejected');

-- The one way to change a status. Validates the move, updates the job and writes exactly one
-- event row, all in one transaction. Used by the web app's server action and, later, the worker.
create function public.set_job_status(
  p_job_id uuid,
  p_to public.job_status,
  p_note text default null,
  p_apply_method public.apply_method default null
) returns public.job_status_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.job_status;
  v_event public.job_status_events;
begin
  select status into v_from from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job % not found', p_job_id using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.job_status_transitions where from_status = v_from and to_status = p_to
  ) then
    raise exception 'A job can''t move from % to %', v_from, p_to using errcode = 'check_violation';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.jobs set
    status = p_to,
    date_applied = case when p_to = 'applied' then coalesce(date_applied, current_date) else date_applied end,
    apply_method = case when p_to = 'applied' then coalesce(p_apply_method, 'manual') else apply_method end
  where id = p_job_id;
  perform set_config('app.status_change', 'off', true);

  insert into public.job_status_events (job_id, from_status, to_status, note)
  values (p_job_id, v_from, p_to, p_note)
  returning * into v_event;

  return v_event;
end;
$$;

-- Guards the rule above at the table: new jobs start as `found`, and a status only changes
-- through set_job_status().
create function public.guard_job_status() returns trigger
language plpgsql
set search_path = ''
as $$
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

create trigger jobs_guard_status
  before insert or update of status on public.jobs
  for each row execute function public.guard_job_status();

-- The timeline starts with the job being found.
create function public.record_job_found() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_status_events (job_id, from_status, to_status)
  values (new.id, null, 'found');
  return null;
end;
$$;

create trigger jobs_record_found
  after insert on public.jobs
  for each row execute function public.record_job_found();

-- Owner-only access. Public sign-up is disabled, so the only authenticated user is the owner.
alter table public.jobs enable row level security;
alter table public.job_status_events enable row level security;
alter table public.job_status_transitions enable row level security;

create policy "owner manages jobs" on public.jobs
  for all to authenticated using (true) with check (true);
-- Events are written only by set_job_status() and the found trigger (both security definer).
create policy "owner reads events" on public.job_status_events
  for select to authenticated using (true);
create policy "owner reads transitions" on public.job_status_transitions
  for select to authenticated using (true);

revoke insert, update, delete on public.job_status_events from anon, authenticated;
revoke insert, update, delete on public.job_status_transitions from anon, authenticated;

revoke execute on function public.set_job_status from public, anon;
grant execute on function public.set_job_status to authenticated, service_role;
