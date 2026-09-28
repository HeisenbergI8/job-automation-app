-- Local development data: ten jobs with a fixed history, small enough to check every analytics
-- number by hand (ROADMAP stage 2). Loaded by `supabase db reset`.
--
-- Expected numbers:
--   Applications per week (weeks start Monday): Aug 3: 3, Aug 10: 2, Aug 17: 2, Aug 24: 1 (8 total)
--   Funnel (ever reached): applied 8, screening 4, interview 2, offer 1
--   Response rate (any reply, including a rejection): 6 of 8 = 75%
--     by site: greenhouse 1/2, lever 2/2, linkedin 1/1, ashby 1/2, indeed 1/1
--     by method: auto 3/5 = 60%, manual 3/3 = 100%
--   Days to first reply: 3, 5, 4, 7, 5, 2 -> average 26 / 6 = 4.3 days
--   Salary midpoints (USD, 7 jobs): 70k, 80k, 90k, 100k, 100k, 115k, 135k -> median 100k

-- Triggers would stamp today's date on every event; switch them off to load the fixed history.
set session_replication_role = replica;

insert into public.jobs
  (id, site, url, company, role, location, salary_min, salary_max, salary_currency, salary_raw,
   date_found, date_applied, status, apply_method, description)
values
  ('10000000-0000-0000-0000-000000000001', 'greenhouse', 'https://boards.greenhouse.io/acme/jobs/1', 'Acme', 'Frontend Engineer', 'Remote', 90000, 110000, 'USD', '$90k–$110k', '2026-08-01', '2026-08-03', 'offer', 'auto', null),
  ('10000000-0000-0000-0000-000000000002', 'lever', 'https://jobs.lever.co/beta/2', 'Beta', 'Full-stack Developer', 'Remote', 80000, 100000, 'USD', '$80k–$100k', '2026-08-02', '2026-08-04', 'rejected', 'auto', null),
  ('10000000-0000-0000-0000-000000000003', 'linkedin', 'https://www.linkedin.com/jobs/view/3', 'Gamma', 'React Developer', 'Manila', 70000, 90000, 'USD', '$70k–$90k', '2026-08-05', '2026-08-06', 'rejected', 'manual', null),
  ('10000000-0000-0000-0000-000000000004', 'ashby', 'https://jobs.ashbyhq.com/delta/4', 'Delta', 'Software Engineer', 'Remote', 100000, 130000, 'USD', '$100k–$130k', '2026-08-10', '2026-08-11', 'ghosted', 'auto', null),
  ('10000000-0000-0000-0000-000000000005', 'indeed', 'https://www.indeed.com/viewjob?jk=5', 'Epsilon', 'Backend Developer', 'Hybrid', null, null, null, null, '2026-08-12', '2026-08-13', 'interview', 'manual', null),
  ('10000000-0000-0000-0000-000000000006', 'greenhouse', 'https://boards.greenhouse.io/zeta/jobs/6', 'Zeta', 'Platform Engineer', 'Remote', 120000, 150000, 'USD', '$120k–$150k', '2026-08-17', '2026-08-18', 'applied', 'auto', null),
  ('10000000-0000-0000-0000-000000000007', 'lever', 'https://jobs.lever.co/eta/7', 'Eta', 'TypeScript Engineer', 'Remote', 60000, 80000, 'USD', '$60k–$80k', '2026-08-18', '2026-08-19', 'screening', 'manual', null),
  ('10000000-0000-0000-0000-000000000008', 'jobstreet', 'https://www.jobstreet.com/job/8', 'Theta', 'Web Engineer', 'Manila', null, null, null, null, '2026-08-25', null, 'needs_manual', null, null),
  ('10000000-0000-0000-0000-000000000009', 'ashby', 'https://jobs.ashbyhq.com/iota/9', 'Iota', 'Frontend Lead', 'Remote', 95000, 105000, 'USD', '$95k–$105k', '2026-08-25', '2026-08-26', 'rejected', 'auto', null),
  ('10000000-0000-0000-0000-000000000010', 'greenhouse', 'https://boards.greenhouse.io/kappa/jobs/10', 'Kappa', 'Senior Frontend Engineer', 'Remote', null, null, null, 'Competitive', '2026-09-20', null, 'found', null,
   'Kappa is hiring a Senior Frontend Engineer to build our analytics dashboard.

You will:
- Build accessible UIs in React and TypeScript
- Own our Next.js app and its performance
- Work with designers on a component library using Tailwind CSS
- Write tests with Playwright

You have:
- 5+ years of frontend experience
- Strong React, TypeScript and Next.js skills
- Experience with GraphQL and Kubernetes is a plus');

insert into public.job_status_events (job_id, from_status, to_status, changed_at, note) values
  ('10000000-0000-0000-0000-000000000001', null, 'found', '2026-08-01 09:00+08', null),
  ('10000000-0000-0000-0000-000000000001', 'found', 'applied', '2026-08-03 09:00+08', null),
  ('10000000-0000-0000-0000-000000000001', 'applied', 'screening', '2026-08-06 09:00+08', null),
  ('10000000-0000-0000-0000-000000000001', 'screening', 'interview', '2026-08-12 09:00+08', null),
  ('10000000-0000-0000-0000-000000000001', 'interview', 'offer', '2026-08-20 09:00+08', null),

  ('10000000-0000-0000-0000-000000000002', null, 'found', '2026-08-02 09:00+08', null),
  ('10000000-0000-0000-0000-000000000002', 'found', 'applied', '2026-08-04 09:00+08', null),
  ('10000000-0000-0000-0000-000000000002', 'applied', 'rejected', '2026-08-09 09:00+08', null),

  ('10000000-0000-0000-0000-000000000003', null, 'found', '2026-08-05 09:00+08', null),
  ('10000000-0000-0000-0000-000000000003', 'found', 'needs_manual', '2026-08-05 10:00+08', 'Login wall'),
  ('10000000-0000-0000-0000-000000000003', 'needs_manual', 'applied', '2026-08-06 09:00+08', null),
  ('10000000-0000-0000-0000-000000000003', 'applied', 'screening', '2026-08-10 09:00+08', null),
  ('10000000-0000-0000-0000-000000000003', 'screening', 'rejected', '2026-08-15 09:00+08', null),

  ('10000000-0000-0000-0000-000000000004', null, 'found', '2026-08-10 09:00+08', null),
  ('10000000-0000-0000-0000-000000000004', 'found', 'applied', '2026-08-11 09:00+08', null),
  ('10000000-0000-0000-0000-000000000004', 'applied', 'ghosted', '2026-09-01 09:00+08', 'No reply after 21 days'),

  ('10000000-0000-0000-0000-000000000005', null, 'found', '2026-08-12 09:00+08', null),
  ('10000000-0000-0000-0000-000000000005', 'found', 'needs_manual', '2026-08-12 10:00+08', 'CAPTCHA'),
  ('10000000-0000-0000-0000-000000000005', 'needs_manual', 'applied', '2026-08-13 09:00+08', null),
  ('10000000-0000-0000-0000-000000000005', 'applied', 'screening', '2026-08-20 09:00+08', null),
  ('10000000-0000-0000-0000-000000000005', 'screening', 'interview', '2026-08-27 09:00+08', null),

  ('10000000-0000-0000-0000-000000000006', null, 'found', '2026-08-17 09:00+08', null),
  ('10000000-0000-0000-0000-000000000006', 'found', 'applied', '2026-08-18 09:00+08', null),

  ('10000000-0000-0000-0000-000000000007', null, 'found', '2026-08-18 09:00+08', null),
  ('10000000-0000-0000-0000-000000000007', 'found', 'applied', '2026-08-19 09:00+08', null),
  ('10000000-0000-0000-0000-000000000007', 'applied', 'screening', '2026-08-24 09:00+08', null),

  ('10000000-0000-0000-0000-000000000008', null, 'found', '2026-08-25 09:00+08', null),
  ('10000000-0000-0000-0000-000000000008', 'found', 'needs_manual', '2026-08-25 10:00+08', 'Account required'),

  ('10000000-0000-0000-0000-000000000009', null, 'found', '2026-08-25 09:00+08', null),
  ('10000000-0000-0000-0000-000000000009', 'found', 'applied', '2026-08-26 09:00+08', null),
  ('10000000-0000-0000-0000-000000000009', 'applied', 'rejected', '2026-08-28 09:00+08', null),

  ('10000000-0000-0000-0000-000000000010', null, 'found', '2026-09-20 09:00+08', null);

set session_replication_role = origin;

update public.settings set
  target_roles = '{"Frontend Engineer","Full-stack Engineer"}',
  locations = '{"Remote","Manila"}',
  remote_preference = 'remote',
  salary_floor = 70000,
  salary_currency = 'USD',
  must_have_keywords = '{"React","TypeScript"}',
  excluded_keywords = '{"PHP"}',
  self_intro = 'I''m a frontend engineer with six years of experience building React and TypeScript products. At Northwind I led the rebuild of a customer dashboard used by 40,000 people a month, and at Contoso I built their design system. I care about fast, accessible interfaces and clear collaboration with design and product.',
  master_cv = '{
    "name": "Sample Owner",
    "headline": "Frontend Engineer",
    "contact": {"email": "owner@example.local", "phone": "+63 900 000 0000", "location": "Manila, Philippines", "links": ["https://github.com/example"]},
    "summary": "Frontend engineer with six years of experience building React and TypeScript products, with a focus on performance and accessibility.",
    "skills": ["React", "TypeScript", "JavaScript", "Next.js", "Tailwind CSS", "Node.js", "PostgreSQL", "Jest", "Accessibility"],
    "experience": [
      {"employer": "Northwind", "title": "Senior Frontend Engineer", "location": "Remote", "start": "Jan 2022", "end": "Present",
       "bullets": ["Led the rebuild of a customer dashboard in Next.js used by 40,000 people a month", "Cut page load time by 45% by splitting bundles and caching data", "Mentored three junior engineers"]},
      {"employer": "Contoso", "title": "Frontend Engineer", "location": "Manila", "start": "Jun 2019", "end": "Dec 2021",
       "bullets": ["Built the company design system in React and Tailwind CSS", "Wrote unit tests with Jest, raising coverage from 30% to 80%"]}
    ],
    "education": [
      {"institution": "University of the Philippines", "qualification": "BS Computer Science", "start": "2015", "end": "2019", "details": []}
    ],
    "certifications": []
  }';
