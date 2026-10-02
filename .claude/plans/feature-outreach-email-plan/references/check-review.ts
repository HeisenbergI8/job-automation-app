// Review of src/lib/tailoring/check.ts (92 lines). The no-invention rule for CVs and free text, pure,
// already imported by the worker. Stage 7 reuses findTextInventions UNCHANGED through an adapter
// (findEmailInventions in src/lib/outreach.ts).

/** JD keywords the master CV doesn't support: output must never mention these. */
export function unsupportedKeywords(master: MasterCv, keywords: string[], allowed: string[] = []) {
  const source = cvText(master);
  return keywords.filter(
    (keyword) => !mentions(source, keyword) && !allowed.some((text) => mentions(text, keyword)),
  );
}

// IMPORTANT: three passes. (1) keywords the CV lacks, matched case-insensitively; (2) every capitalised
// word / tech token (namesIn) must appear in the CV or in `allowed`; (3) every number must be in the CV.
export function findTextInventions(
  master: MasterCv,
  text: string,
  { keywords, allowed = [] }: { keywords: string[]; allowed?: string[] },
) {
  const problems: string[] = [];
  for (const keyword of unsupportedKeywords(master, keywords, allowed)) {
    if (mentions(text, keyword)) problems.push(`Mentions "${keyword}", which isn't in the master CV.`);
  }
  // IMPORTANT: cvText(master) leaves out `name` and `contact` (see master-cv.ts cvText), so an email's
  // sign-off ("Sample Owner") and the recipient's name ("Hi Ana") would be flagged unless they're in
  // `allowed`. The adapter adds master.name and master.contact.location; the caller adds company, role,
  // recipient and team.
  const source = [cvText(master), ...allowed].join("\n");
  for (const name of namesIn(text)) {
    if (!mentions(source, name) && !problems.some((problem) => problem.includes(`"${name}"`))) {
      problems.push(`Mentions "${name}", which isn't in the master CV.`);
    }
  }
  // NOTE: strict on numbers: "a 15-minute chat" is rejected unless 15 is in the CV. The draft prompt
  // forbids numbers not copied from the CV.
  const known = numbersIn(source);
  for (const number of numbersIn(text)) {
    if (!known.has(number)) problems.push(`Uses the number "${number}", which isn't in the master CV.`);
  }
  return problems;
}

// IMPORTANT: with keywords = [] (worker-saved jobs have ats_keywords = null), a lowercase invented skill
// ("graphql") passes: only pass (2) runs, and it catches capitalised words only. That is why the stage 7
// extraction call returns the posting's skills and passes them as `keywords`.

// NOTE: findCvInventions (the structured-CV check) is not relevant to an email and is not reused.
