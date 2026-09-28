-- Stage 4: ATS keywords, generated documents and intro adaptations that wait for approval.

-- 4.2: keywords extracted once from the saved job description, so before/after scores compare
-- against the same list.
alter table public.jobs add column ats_keywords text[];

create type public.intro_status as enum ('pending', 'approved', 'rejected');

-- 4.6: the self-intro adapted to one job's format. It can't be used until the owner approves it.
create table public.intro_adaptations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  requirements text not null,
  adapted_text text not null,
  status public.intro_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index intro_adaptations_job_idx on public.intro_adaptations (job_id);

alter table public.intro_adaptations enable row level security;
create policy "owner manages intro adaptations" on public.intro_adaptations
  for all to authenticated using (true) with check (true);

-- 4.5: generated documents carry their keyword score before and after tailoring.
alter table public.application_documents
  add column ats_score_before smallint check (ats_score_before between 0 and 100),
  add column ats_score_after smallint check (ats_score_after between 0 and 100),
  add column intro_adaptation_id uuid references public.intro_adaptations (id);

-- Editing the text of a decided adaptation sends it back for approval, unless the same update
-- also records the decision (the owner editing and approving in one step).
create function public.reset_intro_approval() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.adapted_text is distinct from old.adapted_text and new.status = old.status then
    new.status := 'pending';
    new.decided_at := null;
  end if;
  return new;
end;
$$;

create trigger intro_adaptations_reset_approval
  before update on public.intro_adaptations
  for each row execute function public.reset_intro_approval();

-- An adapted intro can only be recorded as sent once it is approved.
create function public.guard_intro_document() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.intro_adaptation_id is not null and not exists (
    select 1 from public.intro_adaptations
    where id = new.intro_adaptation_id and job_id = new.job_id and status = 'approved'
  ) then
    raise exception 'This intro hasn''t been approved yet' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger application_documents_guard_intro
  before insert or update on public.application_documents
  for each row execute function public.guard_intro_document();

-- The application waits while an adapted intro is pending.
create function public.guard_pending_intro() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'applied' and exists (
    select 1 from public.intro_adaptations where job_id = new.id and status = 'pending'
  ) then
    raise exception 'This application is waiting for an adapted intro to be approved'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger jobs_guard_pending_intro
  before update of status on public.jobs
  for each row execute function public.guard_pending_intro();
