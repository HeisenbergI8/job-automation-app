-- ROADMAP 1.2: invalid transitions are refused, and every valid one leaves exactly one event row.
begin;
select plan(11);

insert into public.jobs (id, site, url, company, role)
values ('00000000-0000-0000-0000-000000000001', 'greenhouse', 'https://example.test/1', 'Acme', 'Engineer');

select is(
  (select count(*)::int from public.job_status_events where job_id = '00000000-0000-0000-0000-000000000001'),
  1, 'a new job starts its timeline with one found event');

select throws_ok(
  $$ select public.set_job_status('00000000-0000-0000-0000-000000000001', 'offer') $$,
  '23514', null, 'found -> offer is refused');

select throws_ok(
  $$ update public.jobs set status = 'applied' where id = '00000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a direct status update is refused');

select throws_ok(
  $$ insert into public.jobs (site, url, company, role, status) values ('x', 'https://example.test/2', 'A', 'B', 'applied') $$,
  '23514', null, 'a new job cannot start as applied');

select lives_ok(
  $$ select public.set_job_status('00000000-0000-0000-0000-000000000001', 'applied') $$,
  'found -> applied is allowed');
select is(
  (select count(*)::int from public.job_status_events where job_id = '00000000-0000-0000-0000-000000000001'),
  2, 'applying adds exactly one event');
select is(
  (select date_applied from public.jobs where id = '00000000-0000-0000-0000-000000000001'),
  current_date, 'applying sets date_applied');
select is(
  (select apply_method::text from public.jobs where id = '00000000-0000-0000-0000-000000000001'),
  'manual', 'apply method defaults to manual');

select throws_ok(
  $$ select public.set_job_status('00000000-0000-0000-0000-000000000001', 'found') $$,
  '23514', null, 'applied -> found is refused');
select is(
  (select count(*)::int from public.job_status_events where job_id = '00000000-0000-0000-0000-000000000001'),
  2, 'a refused move leaves no event');

select public.set_job_status('00000000-0000-0000-0000-000000000001', 'screening');
select is(
  (select array_agg(to_status::text order by changed_at, id) from public.job_status_events
   where job_id = '00000000-0000-0000-0000-000000000001'),
  array['found', 'applied', 'screening'], 'the timeline records each move');

select * from finish();
rollback;
