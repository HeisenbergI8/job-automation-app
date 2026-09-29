-- Owner's choice (2026-09-29, option A): LinkedIn, Indeed, JobStreet and others (JSearch) are searched
-- on the first run of the day only, so three daily runs stay inside JSearch's free 200 a month.
-- Each run records how many JSearch searches it made; later runs that day see it and skip JSearch.
alter table public.worker_runs add column jsearch_searches integer not null default 0;
