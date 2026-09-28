// ROADMAP 4.3 / 4.4: the no-invention rule. Tailoring may only reword and reorder the master CV;
// anything that names a skill, employer, title, date or number the master CV doesn't have is
// rejected. Pure, so it runs the same in the web app, the worker and the tests.
import { cvText, type MasterCv } from "@/lib/master-cv";
import { mentions, namesIn, numbersIn, sameText } from "./text";

export type TailoredCv = Omit<MasterCv, "name" | "contact">;

/** JD keywords the master CV doesn't support: output must never mention these. */
export function unsupportedKeywords(master: MasterCv, keywords: string[], allowed: string[] = []) {
  const source = cvText(master);
  return keywords.filter(
    (keyword) => !mentions(source, keyword) && !allowed.some((text) => mentions(text, keyword)),
  );
}

/** Checks free text (a cover letter, an intro) against the master CV. */
export function findTextInventions(
  master: MasterCv,
  text: string,
  { keywords, allowed = [] }: { keywords: string[]; allowed?: string[] },
) {
  const problems: string[] = [];
  for (const keyword of unsupportedKeywords(master, keywords, allowed)) {
    if (mentions(text, keyword)) problems.push(`Mentions "${keyword}", which isn't in the master CV.`);
  }
  const source = [cvText(master), ...allowed].join("\n");
  for (const name of namesIn(text)) {
    if (!mentions(source, name) && !problems.some((problem) => problem.includes(`"${name}"`))) {
      problems.push(`Mentions "${name}", which isn't in the master CV.`);
    }
  }
  const known = numbersIn(source);
  for (const number of numbersIn(text)) {
    if (!known.has(number)) problems.push(`Uses the number "${number}", which isn't in the master CV.`);
  }
  return problems;
}

/** Checks a tailored CV against the master CV. Empty when nothing was invented. */
export function findCvInventions(master: MasterCv, tailored: TailoredCv, keywords: string[]) {
  const problems: string[] = [];

  for (const skill of tailored.skills) {
    if (!master.skills.some((known) => sameText(known, skill))) {
      problems.push(`Skill "${skill}" isn't in the master CV.`);
    }
  }

  for (const job of tailored.experience) {
    const sameEmployer = master.experience.filter((known) => sameText(known.employer, job.employer));
    if (sameEmployer.length === 0) {
      problems.push(`Employer "${job.employer}" isn't in the master CV.`);
    } else if (!sameEmployer.some((known) => sameText(known.title, job.title))) {
      problems.push(`Title "${job.title}" at ${job.employer} isn't in the master CV.`);
    } else if (
      !sameEmployer.some(
        (known) => sameText(known.title, job.title) && sameText(known.start, job.start) && sameText(known.end, job.end),
      )
    ) {
      problems.push(`Dates "${job.start} – ${job.end}" for ${job.title} at ${job.employer} don't match the master CV.`);
    }
  }

  for (const school of tailored.education) {
    const match = master.education.some(
      (known) =>
        sameText(known.institution, school.institution) &&
        sameText(known.qualification, school.qualification) &&
        sameText(known.start, school.start) &&
        sameText(known.end, school.end),
    );
    if (!match) problems.push(`Education "${school.qualification}, ${school.institution}" doesn't match the master CV.`);
  }

  for (const cert of tailored.certifications) {
    const match = master.certifications.some(
      (known) => sameText(known.name, cert.name) && sameText(known.issuer, cert.issuer) && sameText(known.date, cert.date),
    );
    if (!match) problems.push(`Certification "${cert.name}" doesn't match the master CV.`);
  }

  const titles = [master.headline, ...master.experience.map((job) => job.title)];
  if (tailored.headline.trim() && !titles.some((title) => sameText(title, tailored.headline))) {
    problems.push(`Headline "${tailored.headline}" isn't a title from the master CV.`);
  }

  // Skills, dates and numbers slipped into the summary or bullets.
  problems.push(...findTextInventions(master, cvText(tailored), { keywords }));

  return [...new Set(problems)];
}
