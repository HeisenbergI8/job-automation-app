-- Review of supabase/migrations/20260928000100_job_record.sql. The job record, its status timeline, and
-- the rule that a status changes only through set_job_status(). Stage 7 must not touch any of this.

-- IMPORTANT: fixed status values (CONVENTIONS: changed only via set_job_status()). "Email sent" is not
-- one of them, so it can't be a job_status_events row without breaking the rule (open decision D1).
create type public.job_status as enum (
  'found', 'applied', 'needs_manual', 'screening', 'interview', 'offer', 'rejected', 'ghosted'
);

create table public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,   -- NOTE: not null, so a non-status event can't be stored here
  note text,
  changed_at timestamptz not null default clock_timestamp()
);

-- NOTE: the pattern stage 7 copies: the database enforces its own rules with a trigger, and
-- clock_timestamp() so moves in one transaction still order correctly.
create trigger jobs_guard_status
  before insert or update of status on public.jobs
  for each row execute function public.guard_job_status();

-- NOTE: the RLS style: the owner reads; writes come only through security definer functions or the
-- service role. Stage 7 follows it (owner reads contacts/emails; may update only outreach_emails.status).
create policy "owner reads events" on public.job_status_events
  for select to authenticated using (true);
revoke insert, update, delete on public.job_status_events from anon, authenticated;
