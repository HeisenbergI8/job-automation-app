// The finder's own job search (owner request, 2026-10-02): a homemade JSearch in Python
// (worker/jobsearch/jobsearch.py). Free job APIs on every run, as they have no monthly limit, plus
// LinkedIn, Indeed and Glassdoor scraped directly when the owner sets SCRAPE_JOB_SITES=true.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Search } from "./jsearch";
import type { Posting } from "./sources";

/** Searches a run, rotated by day like JSearch's: scraping too many at once gets an IP blocked sooner. */
export const MAX_SEARCHES = 6;
const SCRIPT = fileURLToPath(new URL("../jobsearch/jobsearch.py", import.meta.url));
// Every source is asked at once; jobspy reading full LinkedIn descriptions is the slow one.
const TIMEOUT_MS = 180_000;

const money = z.number().nullable();
const job = z.object({
  site: z.string(),
  url: z.url(),
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().nullable(),
  description: z.string(),
  salary_min: money,
  salary_max: money,
  salary_currency: z.string().nullable(),
  salary_raw: z.string().nullable(),
  remote: z.boolean(),
  posted_at: z.string().nullable(),
});
const answer = z.object({ jobs: z.array(z.unknown()), errors: z.array(z.string()) });

/** The script's output. Jobs that don't fit are left out and counted, so one odd job doesn't cost the rest. */
export function parseOwnSearch(stdout: string): { postings: Posting[]; errors: string[] } {
  const { jobs, errors } = answer.parse(JSON.parse(stdout));
  const postings = jobs.flatMap((item) => {
    const checked = job.safeParse(item);
    return checked.success ? [checked.data] : [];
  });
  const dropped = jobs.length - postings.length;
  return { postings, errors: dropped ? [...errors, `${dropped} unreadable ${dropped === 1 ? "job was" : "jobs were"} left out.`] : errors };
}

/** Runs one search through the Python script (PYTHON_BIN, default python3). */
export function searchOwn(search: Search, remoteOnly: boolean) {
  const args = [SCRIPT, search.role, "--country", search.country, "--days", "3", ...(remoteOnly ? ["--remote"] : [])];
  return new Promise<{ postings: Posting[]; errors: string[] }>((resolve, reject) => {
    execFile(process.env.PYTHON_BIN?.trim() || "python3", args, { timeout: TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
        return reject(new Error("Python 3 isn't installed (or PYTHON_BIN in worker/.env is wrong)."));
      }
      if (error) return reject(new Error(error.killed ? "timed out" : stderr.trim().split("\n").at(-1) || error.message));
      try {
        resolve(parseOwnSearch(stdout));
      } catch (parseError) {
        reject(new Error(`unreadable answer from jobsearch.py: ${(parseError as Error).message}`));
      }
    });
  });
}
