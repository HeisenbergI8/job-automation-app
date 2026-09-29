-- Stage 5 follow-up (owner request 2026-09-29): don't score the same job twice. Every posting Claude
-- has scored is remembered here, so later runs move on to jobs not yet reviewed.

create table public.seen_postings (
  url text primary key,
  -- Kept so duplicates of the same job on another site are skipped too (worker/src/dedupe.ts).
  company text not null,
  role text not null,
  location text,
  score smallint check (score between 0 and 100),
  first_seen_at timestamptz not null default now()
);

alter table public.seen_postings enable row level security;
-- Written only by the worker (service role).
create policy "owner reads seen postings" on public.seen_postings
  for select to authenticated using (true);
revoke insert, update, delete on public.seen_postings from anon, authenticated;
