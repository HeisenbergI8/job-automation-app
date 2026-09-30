-- Owner's rule (2026-09-30): a Gmail alert job is only sent after its full posting is looked up on
-- JSearch and Claude scores it 70+ (worker/src/verify.ts). The free plan's 200 requests a month are
-- split into 3 searches and 3 lookups a day; each run records its lookups so later runs that day
-- know how many are left.
alter table public.worker_runs add column jsearch_lookups integer not null default 0;
