-- Owner's choice (2026-09-29): the finder reads the owner's LinkedIn, JobStreet and Indeed job-alert
-- emails. Each email is read once: its Message-ID is recorded here, so three daily runs don't re-read
-- (and re-spend Claude calls on) the same email.
create table public.processed_emails (
  message_id text primary key,
  site text not null,
  jobs_found integer not null default 0,
  processed_at timestamptz not null default now()
);

alter table public.processed_emails enable row level security;
create policy "owner reads processed emails" on public.processed_emails
  for select to authenticated using (true);
revoke insert, update, delete on public.processed_emails from anon, authenticated;
