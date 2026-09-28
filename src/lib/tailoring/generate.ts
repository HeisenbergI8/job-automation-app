import "server-only";
import { z } from "zod";
import { askForJson } from "@/lib/claude";
import { masterCvSchema, type MasterCv } from "@/lib/master-cv";
import { findCvInventions, findTextInventions, unsupportedKeywords, type TailoredCv } from "./check";

type JobForTailoring = { company: string; role: string; description: string };

const RULES = `You work only from the candidate's master CV. You may reword, reorder, shorten and leave things out.
You must never add a skill, tool, employer, job title, qualification, date, number or claim that is not in the master CV.
Never change an employer, job title, qualification or date: copy them exactly.
Write plain, specific English: no buzzwords, no exaggeration.`;

/** Asks, checks against the no-invention rule, and asks once more with the problems if needed. */
async function generateChecked<T>(ask: (feedback: string) => Promise<T>, check: (result: T) => string[]) {
  let result = await ask("");
  let problems = check(result);
  if (problems.length) {
    result = await ask(
      `\n\nYour previous answer was rejected because it added things that are not in the master CV:\n- ${problems.join("\n- ")}\nFix every one of these.`,
    );
    problems = check(result);
  }
  if (problems.length) throw new Error(`The output was rejected by the no-invention check: ${problems.join(" ")}`);
  return result;
}

/** 4.2: the keywords an ATS would match in this job description. Saved on the job once. */
export async function extractKeywords(description: string) {
  const { keywords } = await askForJson({
    system:
      "You extract the keywords an applicant tracking system would match in a job description: hard skills, tools, technologies, methods, certifications and qualifications. Use the exact wording of the job description. Skip soft skills, benefits and company names.",
    prompt: `Job description:\n\n${description}\n\nList up to 30 keywords, most important first.`,
    schema: z.object({ keywords: z.array(z.string()) }),
  });
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

const tailoredCvSchema = masterCvSchema.omit({ name: true, contact: true });

/** 4.3: the master CV reworded and reordered around this job. */
export function tailorCv(master: MasterCv, job: JobForTailoring, keywords: string[]): Promise<TailoredCv> {
  const avoid = unsupportedKeywords(master, keywords);
  const content = tailoredCvSchema.parse(master); // drops name and contact
  return generateChecked(
    (feedback) =>
      askForJson({
        system: `You tailor CVs so they pass applicant tracking systems for one specific job.\n${RULES}`,
        prompt: `Job: ${job.role} at ${job.company}

Job description:
${job.description}

ATS keywords for this job: ${keywords.join(", ")}
The master CV does NOT support these, so they must not appear anywhere: ${avoid.join(", ") || "(none)"}

Master CV (JSON):
${JSON.stringify(content, null, 2)}

Return the tailored CV in the same shape. Lead with what matters most for this job. Use the job's wording for things the master CV already shows. The headline must be the master CV's headline or one of its job titles. Skills must be copied from the master CV's skills list.${feedback}`,
        schema: tailoredCvSchema,
      }),
    (tailored) => findCvInventions(master, tailored, keywords),
  );
}

/** 4.4: a cover letter under the same no-invention rule. Returns its paragraphs. */
export async function writeCoverLetter(master: MasterCv, job: JobForTailoring, keywords: string[]) {
  const allowed = [job.company, job.role];
  const { paragraphs } = await generateChecked(
    (feedback) =>
      askForJson({
        system: `You write short, specific cover letters.\n${RULES}\nDon't name any product, technology or organisation other than the ones in the master CV and the company you're applying to.`,
        prompt: `Write the body of a cover letter for ${job.role} at ${job.company}: three or four short paragraphs, no greeting and no sign-off.

Job description:
${job.description}

These are not supported by the master CV, so don't mention them: ${unsupportedKeywords(master, keywords, allowed).join(", ") || "(none)"}

Master CV (JSON):
${JSON.stringify(master, null, 2)}${feedback}`,
        schema: z.object({ paragraphs: z.array(z.string()) }),
      }),
    ({ paragraphs }) => findTextInventions(master, paragraphs.join("\n"), { keywords, allowed }),
  );
  return paragraphs;
}

/** 4.6: the self-intro adapted to a job's format. The owner must approve it before it's used. */
export async function adaptIntro(
  master: MasterCv,
  intro: string,
  job: Pick<JobForTailoring, "company" | "role">,
  requirements: string,
  keywords: string[],
) {
  const allowed = [job.company, job.role, intro];
  const { text } = await generateChecked(
    (feedback) =>
      askForJson({
        system: `You adapt a candidate's self-introduction to the format a job application asks for.\n${RULES}\nThe candidate's written intro counts as a source too. Keep their voice.`,
        prompt: `Application: ${job.role} at ${job.company}

What the application asks for:
${requirements}

The candidate's intro:
${intro}

Master CV (JSON):
${JSON.stringify(master, null, 2)}

Rewrite the intro to meet exactly what the application asks for (length, word count, questions to answer).${feedback}`,
        schema: z.object({ text: z.string() }),
      }),
    ({ text }) => findTextInventions(master, text, { keywords, allowed }),
  );
  return text.trim();
}
