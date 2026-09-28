-- ROADMAP 4.6: an unapproved intro can't be used, and the application waits for approval.
begin;
select plan(6);

insert into public.jobs (id, site, url, company, role)
values ('00000000-0000-0000-0000-0000000000c1', 'ashby', 'https://example.test/intro', 'Intro Co', 'PM');
insert into public.intro_adaptations (id, job_id, requirements, adapted_text)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Max 100 words', 'Hi, I am...');

select throws_ok(
  $$ insert into public.application_documents (job_id, kind, file_name, storage_path, intro_adaptation_id)
     values ('00000000-0000-0000-0000-0000000000c1', 'intro', 'intro.txt', 'x/intro.txt', '00000000-0000-0000-0000-0000000000d1') $$,
  '23514', null, 'a pending intro cannot be recorded as sent');

select throws_ok(
  $$ select public.set_job_status('00000000-0000-0000-0000-0000000000c1', 'applied') $$,
  '23514', null, 'the application waits while the intro is pending');

update public.intro_adaptations set status = 'approved', decided_at = now()
where id = '00000000-0000-0000-0000-0000000000d1';

select lives_ok(
  $$ insert into public.application_documents (job_id, kind, file_name, storage_path, intro_adaptation_id)
     values ('00000000-0000-0000-0000-0000000000c1', 'intro', 'intro.txt', 'x/intro.txt', '00000000-0000-0000-0000-0000000000d1') $$,
  'an approved intro can be recorded as sent');

select lives_ok(
  $$ select public.set_job_status('00000000-0000-0000-0000-0000000000c1', 'applied') $$,
  'the application proceeds once the intro is approved');

update public.intro_adaptations set adapted_text = 'Edited after approval'
where id = '00000000-0000-0000-0000-0000000000d1';
select is(
  (select status::text from public.intro_adaptations where id = '00000000-0000-0000-0000-0000000000d1'),
  'pending', 'editing an approved intro sends it back for approval');

update public.intro_adaptations set adapted_text = 'Edited and approved', status = 'approved'
where id = '00000000-0000-0000-0000-0000000000d1';
select is(
  (select status::text from public.intro_adaptations where id = '00000000-0000-0000-0000-0000000000d1'),
  'approved', 'editing and approving in one step keeps it approved');

select * from finish();
rollback;
