// ROADMAP 5.2: the company career pages the daily finder reads. The owner pastes a job-board link in
// Settings; this turns it into the ATS and the board's name (its "slug") in the ATS's public API.
import type { Enums } from "@/lib/supabase/types";

export type Ats = Enums<"ats">;

// Must match the career_boards.slug check in the database.
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function atsFor(host: string): Ats | null {
  if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") return "greenhouse";
  if (host === "jobs.lever.co") return "lever";
  if (host === "jobs.ashbyhq.com") return "ashby";
  return null;
}

/** "https://jobs.lever.co/acme/123" → { ats: "lever", slug: "acme" }. */
export function parseBoardLink(input: string): { ats: Ats; slug: string } | { error: string } {
  const text = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "That isn't a link." };
  }
  const ats = atsFor(url.hostname.toLowerCase());
  if (!ats) {
    return { error: "Paste a Greenhouse, Lever or Ashby job-board link, for example https://jobs.lever.co/company." };
  }
  // Greenhouse's embedded boards put the name in ?for=<slug>.
  const slug = url.searchParams.get("for") ?? url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!SLUG.test(slug) || slug === "embed") return { error: "That link doesn't include the company's board name." };
  return { ats, slug };
}
