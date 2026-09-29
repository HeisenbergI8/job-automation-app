-- Stage 5: the daily finder's company list (5.2) and its run log (5.1).

-- 5.2: company career pages the finder reads. The owner adds them in Settings by pasting a board link.
create type public.ats as enum ('greenhouse', 'lever', 'ashby');

create table public.career_boards (
  id uuid primary key default gen_random_uuid(),
  ats public.ats not null,
  -- The board's name in its URL (jobs.lever.co/<slug>). Letters, digits, dot, dash, underscore only,
  -- because it is put into an API URL.
  slug text not null check (slug ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
  -- Lever and Ashby responses carry no company name; this one is used when set.
  company text,
  -- Written by the worker after each read: last_error is null when the board read fine.
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create unique index career_boards_ats_slug_idx on public.career_boards (ats, lower(slug));

-- 5.1: one row per worker run. Also the "since the last run" mark for needs_manual notifications.
create table public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- null while running, false if the run crashed part-way.
  ok boolean,
  dry_run boolean not null default false,
  -- 'claude-code', 'keywords', or 'claude-code+keywords' when Claude Code failed part-way.
  scorer text,
  fetched integer not null default 0,
  new_postings integer not null default 0,
  scored integer not null default 0,
  saved integer not null default 0,
  errors text[] not null default '{}',
  notified boolean not null default false
);

create index worker_runs_started_idx on public.worker_runs (started_at desc);

alter table public.career_boards enable row level security;
alter table public.worker_runs enable row level security;

create policy "owner manages career boards" on public.career_boards
  for all to authenticated using (true) with check (true);
-- Written only by the worker (service role).
create policy "owner reads worker runs" on public.worker_runs
  for select to authenticated using (true);
revoke insert, update, delete on public.worker_runs from anon, authenticated;
