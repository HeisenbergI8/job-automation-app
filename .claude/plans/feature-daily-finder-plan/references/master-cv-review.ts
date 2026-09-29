// Review of src/lib/master-cv.ts (88 lines). The structured master CV schema (zod) and helpers.
// The worker reuses parseMasterCv (to read settings.master_cv safely) and cvText (to put the CV in the scoring prompt).

// IMPORTANT: imports zod. From worker code this resolves to the ROOT node_modules/zod (Node walks up from
// src/lib), not worker/node_modules, so the root `npm install` must have been run. It always has, because the web app needs it.
import { z } from "zod";

/** Parses a stored CV, returning null when it is missing or no longer matches the schema. */
export function parseMasterCv(value: unknown): MasterCv | null {
  const result = masterCvSchema.safeParse(value);
  return result.success ? result.data : null;
}

// NOTE: leaves out name and contact, so no personal contact details go into the scoring prompt.
export function cvText(cv: Omit<MasterCv, "name" | "contact">) {
  return [
    cv.headline,
    cv.summary,
    ...cv.skills,
    ...cv.experience.flatMap((job) => [job.title, job.employer, job.location, job.start, job.end, ...job.bullets]),
    // ... education, certifications
  ].join("\n");
}
