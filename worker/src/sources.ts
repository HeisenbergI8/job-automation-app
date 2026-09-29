// ROADMAP 5.2: company career pages, read through each ATS's public job-board API (no login, no
// browser). Field names come from real responses recorded on 2026-09-29 (worker/fixtures/).
import type { Ats } from "@/lib/career-boards";
import type { Tables, TablesInsert } from "@/lib/supabase/types";

type JobFields = "site" | "url" | "company" | "role" | "location" | "description" | "salary_min" | "salary_max" | "salary_currency" | "salary_raw";
// Every parser saves a description (possibly empty), so it is never null here.
export type Posting = Required<Pick<TablesInsert<"jobs">, JobFields>> & {
  description: string;
  remote: boolean;
  /** Something the owner must know before applying, e.g. that the link won't open. */
  note?: string;
  /** When the job was first posted (ISO), if the board says; used to keep only new jobs. */
  posted_at?: string | null;
  /** Came from the owner's own job-alert email: always gets a Claude review (see rank). */
  fromAlert?: boolean;
};
export type Board = Pick<Tables<"career_boards">, "ats" | "slug" | "company">;

// Hybrid and on-site aren't remote, whatever a board's remote flag says (owner, 2026-09-29).
export const NOT_REMOTE = /\b(hybrid|on-?site|in[- ]office)\b/i;

const NO_SALARY = { salary_min: null, salary_max: null, salary_currency: null, salary_raw: null };
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) =>
    code[0] !== "#"
      ? (ENTITIES[code.toLowerCase()] ?? match)
      : String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))),
  );
}

/** Job-description HTML to readable plain text: the copy saved on the job. */
export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/ul|\/ol)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/^-\n+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n(?=- )/g, "\n")
    .trim();
}

type GreenhouseBoard = {
  jobs: { absolute_url: string; title: string; company_name?: string; location?: { name?: string }; content?: string; first_published?: string }[];
};

export function parseGreenhouse(body: GreenhouseBoard, board: Board): Posting[] {
  return body.jobs.map((job) => {
    const location = job.location?.name?.trim() || null;
    return {
      site: "greenhouse",
      url: job.absolute_url,
      company: board.company ?? job.company_name ?? board.slug,
      role: job.title.trim(),
      location,
      // `content` is entity-escaped HTML ("&lt;p&gt;"), so it is decoded once before the tags go.
      description: htmlToText(decodeEntities(job.content ?? "")),
      ...NO_SALARY,
      remote: /remote/i.test(location ?? "") && !NOT_REMOTE.test(location ?? ""),
      posted_at: job.first_published ?? null,
    };
  });
}

type LeverPosting = {
  text: string;
  hostedUrl: string;
  categories?: { location?: string };
  workplaceType?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  salaryRange?: { currency?: string; min?: number; max?: number };
  createdAt?: number;
};

export function parseLever(body: LeverPosting[], board: Board): Posting[] {
  return body.map((job) => {
    const location = job.categories?.location?.trim() || null;
    const lists = (job.lists ?? []).map((list) => `${list.text.trim()}\n${htmlToText(list.content)}`);
    return {
      site: "lever",
      url: job.hostedUrl,
      company: board.company ?? board.slug,
      role: job.text.trim(),
      location,
      description: [job.descriptionPlain, ...lists, job.additionalPlain].filter(Boolean).join("\n\n").trim(),
      salary_min: job.salaryRange?.min ?? null,
      salary_max: job.salaryRange?.max ?? null,
      salary_currency: job.salaryRange?.currency ?? null,
      salary_raw: null,
      // Lever's "unspecified" says nothing, so the location decides then.
      remote:
        job.workplaceType && job.workplaceType !== "unspecified"
          ? job.workplaceType === "remote"
          : /remote/i.test(location ?? "") && !NOT_REMOTE.test(location ?? ""),
      posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    };
  });
}

type AshbyBoard = {
  jobs: {
    title: string;
    jobUrl: string;
    location?: string;
    isListed?: boolean;
    isRemote?: boolean;
    workplaceType?: string;
    descriptionPlain?: string;
    publishedAt?: string;
    compensation?: {
      scrapeableCompensationSalarySummary?: string | null;
      summaryComponents?: { compensationType: string; currencyCode: string | null; minValue: number | null; maxValue: number | null }[];
    };
  }[];
};

export function parseAshby(body: AshbyBoard, board: Board): Posting[] {
  return body.jobs
    .filter((job) => job.isListed !== false)
    .map((job) => {
      const salary = job.compensation?.summaryComponents?.find((part) => part.compensationType === "Salary");
      return {
        site: "ashby",
        url: job.jobUrl,
        company: board.company ?? board.slug,
        role: job.title.trim(),
        location: job.location?.trim() || null,
        description: job.descriptionPlain?.trim() ?? "",
        salary_min: salary?.minValue ?? null,
        salary_max: salary?.maxValue ?? null,
        salary_currency: salary?.currencyCode ?? null,
        salary_raw: job.compensation?.scrapeableCompensationSalarySummary ?? null,
        // Ashby sets isRemote on hybrid jobs too (527 of OpenAI's, seen 2026-09-29), so workplaceType wins.
        remote: job.workplaceType ? job.workplaceType === "Remote" : job.isRemote === true,
        posted_at: job.publishedAt ?? null,
      };
    });
}

const ENDPOINTS: Record<Ats, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
};

/** Reads one board. Errors carry an owner-readable reason: it is shown in Settings and on Telegram. */
export async function fetchBoard(board: Board): Promise<Posting[]> {
  const response = await fetch(ENDPOINTS[board.ats](encodeURIComponent(board.slug)), {
    signal: AbortSignal.timeout(30_000),
  });
  // All three APIs answer 404 for a board name that doesn't exist (checked 2026-09-29).
  if (response.status === 404) throw new Error("Board not found. Check the link in Settings.");
  if (!response.ok) throw new Error(`The ${board.ats} board answered with error ${response.status}.`);
  const body: unknown = await response.json();
  const jobs = board.ats === "lever" ? body : (body as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) throw new Error(`Unexpected answer from ${board.ats}.`);
  if (board.ats === "greenhouse") return parseGreenhouse(body as GreenhouseBoard, board);
  if (board.ats === "lever") return parseLever(body as LeverPosting[], board);
  const postings = parseAshby(body as AshbyBoard, board);
  if (postings.length === 0 || (await ashbyPagesOpen(board.slug))) return postings;
  const company = postings[0].company;
  const note = `${company} has switched off its Ashby job pages, so this link may not open. Apply on ${company}'s own careers site.`;
  return postings.map((posting) => ({ ...posting, note }));
}

/**
 * Some companies (PostHog, seen 2026-09-29) publish jobs through Ashby's API but switch off Ashby's
 * job pages, so every job link shows "Page not found". An enabled page carries the company's
 * details (`hostedJobsPageSlug`); a disabled one doesn't. When unsure, assume the pages are open.
 */
async function ashbyPagesOpen(slug: string) {
  try {
    const response = await fetch(`https://jobs.ashbyhq.com/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(30_000) });
    // Only a page that loaded fine and lacks the marker counts as switched off.
    return !response.ok || (await response.text()).includes('"hostedJobsPageSlug"');
  } catch {
    return true;
  }
}
