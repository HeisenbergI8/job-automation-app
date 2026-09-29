-- ROADMAP 5.1 / 5.2: the company list refuses duplicates and unsafe slugs; only the worker writes runs.
begin;
select plan(5);

insert into public.career_boards (ats, slug) values ('lever', 'Acme');

select throws_ok(
  $$insert into public.career_boards (ats, slug) values ('lever', 'acme')$$,
  '23505', null, 'the same board can''t be added twice, whatever its case');
select lives_ok(
  $$insert into public.career_boards (ats, slug) values ('ashby', 'acme')$$,
  'the same slug on another ATS is a different board');
select throws_ok(
  $$insert into public.career_boards (ats, slug) values ('greenhouse', 'acme/../x')$$,
  '23514', null, 'a slug can''t carry a path');
select ok(not has_table_privilege('authenticated', 'public.worker_runs', 'INSERT'), 'only the worker writes the run log');
select ok(has_table_privilege('authenticated', 'public.worker_runs', 'SELECT'), 'the owner can read the run log');

select * from finish();
rollback;
