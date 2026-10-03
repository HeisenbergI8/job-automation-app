-- ROADMAP 7.1 / 7.4: outreach email status order and times, the redraft rule, who may write what,
-- and the follow-up view.
begin;
select plan(17);

insert into public.jobs (id, site, url, company, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'lever', 'https://example.test/outreach', 'Mail Co', 'Frontend Engineer');
insert into public.job_contacts (id, job_id, name, title, email, source, confidence, rank) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'Ana Cruz', 'Recruiter', 'ana.cruz@mail.test', 'job_post', 95, 1),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', 'Ben Ong', 'Engineering Manager', 'ben.ong@mail.test', 'hunter', 88, 2);

select throws_ok(
  $$ insert into public.job_contacts (job_id, name, email, source, rank)
     values ('00000000-0000-0000-0000-0000000000e1', 'Made Up', 'made.up@mail.test', 'guessed', 1) $$,
  '22P02', null, 'there is no guessed source: real emails only');

select throws_ok(
  $$ insert into public.outreach_emails (job_id, to_email, subject, body, status)
     values ('00000000-0000-0000-0000-0000000000e1', 'ana.cruz@mail.test', 'Hi', 'Hello', 'sent') $$,
  '23514', null, 'a new email starts as a draft');

insert into public.outreach_emails (id, job_id, contact_id, to_email, subject, body) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
   'ana.cruz@mail.test', 'Frontend Engineer role', 'Hi Ana, ...');

select throws_ok(
  $$ insert into public.outreach_emails (job_id, to_email, subject, body)
     values ('00000000-0000-0000-0000-0000000000e1', 'ben.ong@mail.test', 'Again', 'Hello') $$,
  '23505', null, 'one first email per job');

update public.outreach_emails set status = 'opened' where id = '00000000-0000-0000-0000-0000000000a1';
select isnt((select opened_at from public.outreach_emails where id = '00000000-0000-0000-0000-0000000000a1'), null, 'opening stamps opened_at');

select throws_ok(
  $$ update public.outreach_emails set status = 'draft' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'an opened email can''t go back to draft without a redraft');

-- A redraft for the backup contact: new recipient and text, back to draft, opened time cleared.
update public.outreach_emails
  set status = 'draft', contact_id = '00000000-0000-0000-0000-0000000000f2', to_email = 'ben.ong@mail.test', body = 'Hi Ben, ...'
  where id = '00000000-0000-0000-0000-0000000000a1';
select is((select opened_at from public.outreach_emails where id = '00000000-0000-0000-0000-0000000000a1'), null, 'a redraft clears opened_at');

update public.outreach_emails set status = 'sent' where id = '00000000-0000-0000-0000-0000000000a1';
select isnt((select sent_at from public.outreach_emails where id = '00000000-0000-0000-0000-0000000000a1'), null, 'draft -> sent stamps sent_at');

select throws_ok(
  $$ update public.outreach_emails set body = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'a sent email can''t be rewritten');
select throws_ok(
  $$ update public.outreach_emails set status = 'opened' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'a sent email can''t move back');

select ok(has_column_privilege('authenticated', 'public.outreach_emails', 'status', 'UPDATE'), 'the owner can change an email''s status');
select ok(not has_column_privilege('authenticated', 'public.outreach_emails', 'body', 'UPDATE'), 'the owner can''t rewrite a draft in the app');
select ok(not has_column_privilege('authenticated', 'public.outreach_emails', 'sent_at', 'UPDATE'), 'the owner can''t set the sent time');
select ok(not has_table_privilege('authenticated', 'public.job_contacts', 'INSERT'), 'only the worker saves contacts');
select ok(has_table_privilege('authenticated', 'public.outreach_requests', 'INSERT'), 'the owner can ask the Mac for a lookup');
select ok(not has_table_privilege('authenticated', 'public.outreach_requests', 'UPDATE'), 'only the Mac marks a request done');

-- Follow-up view: due after 5 days with no reply; gone once the job has a reply.
update public.outreach_emails set sent_at = now() - interval '6 days' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.outreach_follow_ups_due where job_id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'a sent email with no reply after 5 days is due a follow-up');
select public.set_job_status('00000000-0000-0000-0000-0000000000e1', 'applied');
select public.set_job_status('00000000-0000-0000-0000-0000000000e1', 'screening');
select is((select count(*)::int from public.outreach_follow_ups_due where job_id = '00000000-0000-0000-0000-0000000000e1'), 0,
  'a job with a reply needs no follow-up');

select * from finish();
rollback;
