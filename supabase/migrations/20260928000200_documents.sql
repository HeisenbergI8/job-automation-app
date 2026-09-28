-- Stage 1.6: the exact CV, cover letter and intro sent for each job.

create type public.document_kind as enum ('cv', 'cover_letter', 'intro');

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind public.document_kind not null,
  file_name text not null,
  -- Path inside the private `documents` bucket.
  storage_path text not null unique,
  content_type text,
  created_at timestamptz not null default now()
);

create index application_documents_job_idx on public.application_documents (job_id);

alter table public.application_documents enable row level security;
create policy "owner manages documents" on public.application_documents
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

create policy "owner manages document files" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');
