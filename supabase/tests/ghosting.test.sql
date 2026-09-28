-- ROADMAP 2.5: jobs with no reply after ghost_after_days are marked ghosted through set_job_status().
begin;
select plan(4);

-- Start from no jobs (seed data included); the transaction is rolled back at the end.
delete from public.jobs;
update public.settings set follow_up_after_days = 7, ghost_after_days = 21;

insert into public.jobs (id, site, url, company, role) values
  ('00000000-0000-0000-0000-00000000000a', 'lever', 'https://example.test/old', 'Old Co', 'Dev'),
  ('00000000-0000-0000-0000-00000000000b', 'lever', 'https://example.test/new', 'New Co', 'Dev');
select public.set_job_status('00000000-0000-0000-0000-00000000000a', 'applied');
select public.set_job_status('00000000-0000-0000-0000-00000000000b', 'applied');

-- Backdate the first application past the threshold.
set local app.status_change = 'on';
update public.jobs set date_applied = current_date - 30 where id = '00000000-0000-0000-0000-00000000000a';
set local app.status_change = 'off';

select is(public.mark_ghosted_jobs(), 1, 'only the stale application is ghosted');
select is((select status::text from public.jobs where id = '00000000-0000-0000-0000-00000000000a'), 'ghosted', 'stale job is ghosted');
select is((select status::text from public.jobs where id = '00000000-0000-0000-0000-00000000000b'), 'applied', 'recent job is untouched');
select is(
  (select note from public.job_status_events where job_id = '00000000-0000-0000-0000-00000000000a' and to_status = 'ghosted'),
  'No reply after 21 days', 'the ghosting is on the timeline with its reason');

select * from finish();
rollback;
