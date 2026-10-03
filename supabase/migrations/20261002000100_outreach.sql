-- Stage 7: outreach emails, sent by the owner (ROADMAP 7.1). For each saved job the finder finds up to
-- 2 people to email and drafts one email; the app opens it in Gmail's compose page and the owner
-- presses Send. Nothing in this app sends email.

-- 7.2: where a contact's address came from. Real emails only (owner, 2026-10-02): printed in the saved
-- posting, or returned by Hunter. Never built from a name or a pattern, so there is no 'guessed'.
create type public.contact_source as enum ('hunter', 'job_post');

create table public.job_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  name text not null,
  title text,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source public.contact_source not null,
  -- 0-100: Hunter's own score; 95 for an address printed in the posting (worker/src/contacts.ts).
  confidence smallint check (confidence between 0 and 100),
  -- 1 is the best contact, 2 the backup (owner, 2026-10-02: up to 2 per job).
  rank smallint not null check (rank in (1, 2)),
  created_at timestamptz not null default now()
);

create unique index job_contacts_job_email_idx on public.job_contacts (job_id, lower(email));
create unique index job_contacts_job_rank_idx on public.job_contacts (job_id, rank);

create type public.outreach_status as enum ('draft', 'opened', 'sent');
create type public.outreach_kind as enum ('first', 'follow_up');

-- 7.3: the email the button opens. One current email of each kind per job; a redraft for another
-- contact rewrites the row. Once sent it is frozen: it is the record of what was sent.
create table public.outreach_emails (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  contact_id uuid references public.job_contacts (id) on delete set null,
  kind public.outreach_kind not null default 'first',
  -- Copied, not joined, so the record survives the contact row being replaced.
  to_email text not null,
  to_name text,
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 2000),
  status public.outreach_status not null default 'draft',
  created_at timestamptz not null default now(),
  -- Set by the trigger below, never by the app.
  opened_at timestamptz,
  sent_at timestamptz,
  unique (job_id, kind)
);

-- Status order: draft -> opened -> sent, or draft -> sent (sent from the mailto fallback or by hand).
-- Going back to draft is a redraft: only with a new recipient or text, and never once sent.
create function public.guard_outreach_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new email starts as a draft' using errcode = 'check_violation';
    end if;
    new.opened_at := null;
    new.sent_at := null;
    return new;
  end if;

  if old.status = 'sent' then
    if (new.status, new.to_email, new.subject, new.body) is distinct from (old.status, old.to_email, old.subject, old.body) then
      raise exception 'This email was sent, so it can''t be changed' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status = 'draft' then
    if old.status <> 'draft'
      and (new.to_email, new.subject, new.body) is not distinct from (old.to_email, old.subject, old.body) then
      raise exception 'An email can''t go back to draft' using errcode = 'check_violation';
    end if;
    new.opened_at := null;
  elsif new.status = 'opened' then
    -- Opening it again keeps the first time.
    new.opened_at := coalesce(old.opened_at, clock_timestamp());
  elsif new.status = 'sent' then
    new.opened_at := old.opened_at;
    new.sent_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger outreach_emails_guard_status
  before insert or update on public.outreach_emails
  for each row execute function public.guard_outreach_status();

-- 7.4 / 7.5: "Find people" and "Use this person" leave a request here; the owner's Mac picks it up
-- (worker/src/watch.ts, every 30 seconds), like "Find jobs now" does with finder_requests.
create type public.outreach_request_kind as enum ('find_people', 'redraft');

create table public.outreach_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind public.outreach_request_kind not null,
  -- The contact to redraft for; only for 'redraft'.
  contact_id uuid references public.job_contacts (id) on delete cascade,
  requested_at timestamptz not null default now(),
  picked_up_at timestamptz,
  finished_at timestamptz,
  -- Plain-language reason when it couldn't be done; null when it worked.
  error text,
  -- Hunter searches this request used, counted against the monthly free limit with worker_runs'.
  hunter_lookups integer not null default 0,
  check ((kind = 'redraft') = (contact_id is not null))
);

create index outreach_requests_job_idx on public.outreach_requests (job_id, requested_at desc);

-- 7.1: Hunter searches each run used, so later runs know how many of the month's free ones are left.
alter table public.worker_runs add column hunter_lookups integer not null default 0;

-- 7.6 (owner decision D4): first emails sent 5 or more days ago, on a job with no reply
-- (REPLY_STATUSES in src/lib/jobs.ts) and no follow-up yet. The daily ghosting cron drafts one for each.
-- 5 days is the owner's number (2026-10-02); FOLLOW_UP_AFTER_DAYS in src/lib/outreach.ts says the same.
create view public.outreach_follow_ups_due with (security_invoker = true) as
  select first.id, first.job_id, first.contact_id, first.to_email, first.to_name, first.subject, first.sent_at,
    jobs.company, jobs.role
  from public.outreach_emails first
  join public.jobs on jobs.id = first.job_id
  where first.kind = 'first'
    and first.status = 'sent'
    and first.sent_at <= now() - interval '5 days'
    and jobs.status not in ('screening', 'interview', 'offer', 'rejected')
    and not exists (
      select 1 from public.outreach_emails later where later.job_id = first.job_id and later.kind = 'follow_up'
    );

alter table public.job_contacts enable row level security;
alter table public.outreach_emails enable row level security;
alter table public.outreach_requests enable row level security;

-- Contacts and drafts are written only by the worker (service role). The owner reads them and may
-- change an email's status, and nothing else: the trigger stamps the times.
create policy "owner reads job contacts" on public.job_contacts
  for select to authenticated using (true);
revoke insert, update, delete on public.job_contacts from anon, authenticated;

create policy "owner reads outreach emails" on public.outreach_emails
  for select to authenticated using (true);
create policy "owner marks outreach emails" on public.outreach_emails
  for update to authenticated using (true) with check (true);
revoke insert, update, delete on public.outreach_emails from anon, authenticated;
grant update (status) on public.outreach_emails to authenticated;

create policy "owner reads outreach requests" on public.outreach_requests
  for select to authenticated using (true);
create policy "owner makes outreach requests" on public.outreach_requests
  for insert to authenticated with check (true);
-- Only the Mac marks a request picked up, finished or failed.
revoke update, delete on public.outreach_requests from anon, authenticated;
revoke insert on public.outreach_requests from anon;
