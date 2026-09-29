// ROADMAP 5.4: the same job on several boards, or found again on a later day, is kept once.
// Same company + role + location after normalising, and never a URL that is already saved.
import type { Posting } from "./sources";

type Identity = Pick<Posting, "url" | "company" | "role" | "location">;

const COMPANY_SUFFIX = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|gmbh|pte|plc|bv|ag)\b/g;
const ROLE_ABBREVIATIONS: Record<string, string> = { sr: "senior", jr: "junior", eng: "engineer", dev: "developer", mgr: "manager" };

function clean(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dedupeKey(job: Omit<Identity, "url">) {
  const company = clean(job.company).replace(COMPANY_SUFFIX, "").replace(/\s+/g, " ").trim();
  const role = clean(job.role).split(" ").map((word) => ROLE_ABBREVIATIONS[word] ?? word).join(" ");
  return [company, role, clean(job.location ?? "")].join("|");
}

/** Postings that aren't already saved (by URL or by key), each kept once; the first one seen wins. */
export function dedupe(postings: Posting[], saved: Identity[]) {
  const urls = new Set(saved.map((job) => job.url));
  const keys = new Set(saved.map(dedupeKey));
  return postings.filter((posting) => {
    const key = dedupeKey(posting);
    if (urls.has(posting.url) || keys.has(key)) return false;
    urls.add(posting.url);
    keys.add(key);
    return true;
  });
}
