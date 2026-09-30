-- Owner request (2026-09-30): a "Find jobs now" button. The web app runs on Vercel and can't start the
-- finder, which runs on the owner's Mac, so the button leaves a request here. worker/src/watch.ts,
-- which launchd runs every 30 seconds, picks it up and starts a run, and links the run to the request.
create table public.finder_requests (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  -- Set by the Mac when it sees the request; still null means the Mac hasn't picked it up yet.
  picked_up_at timestamptz,
  run_id uuid references public.worker_runs (id) on delete set null
);

create index finder_requests_requested_idx on public.finder_requests (requested_at desc);

alter table public.finder_requests enable row level security;

create policy "owner reads finder requests" on public.finder_requests
  for select to authenticated using (true);
create policy "owner requests finder runs" on public.finder_requests
  for insert to authenticated with check (true);
-- Only the Mac (service role) marks a request picked up or links its run.
revoke update, delete on public.finder_requests from anon, authenticated;
revoke insert on public.finder_requests from anon;

-- What a run is doing right now, for the live progress in the app: career_pages, job_sites,
-- onlinejobs, emails, scoring, saving. Null once it finishes.
alter table public.worker_runs add column stage text;
