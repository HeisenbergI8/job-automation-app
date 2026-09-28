// ROADMAP 3.2: the master CV, stored as structured sections so tailoring (stage 4) can check its
// output against it field by field.
import { z } from "zod";

const experienceSchema = z.object({
  employer: z.string(),
  title: z.string(),
  location: z.string(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()),
});

const educationSchema = z.object({
  institution: z.string(),
  qualification: z.string(),
  start: z.string(),
  end: z.string(),
  details: z.array(z.string()),
});

const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
});

export const masterCvSchema = z.object({
  name: z.string(),
  headline: z.string(),
  contact: z.object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.string()),
  }),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  certifications: z.array(certificationSchema),
});

export type MasterCv = z.infer<typeof masterCvSchema>;
export type CvExperience = z.infer<typeof experienceSchema>;
export type CvEducation = z.infer<typeof educationSchema>;
export type CvCertification = z.infer<typeof certificationSchema>;

export const EMPTY_CV: MasterCv = {
  name: "",
  headline: "",
  contact: { email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  education: [],
  certifications: [],
};

/** Parses a stored CV, returning null when it is missing or no longer matches the schema. */
export function parseMasterCv(value: unknown): MasterCv | null {
  const result = masterCvSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Problems that make a CV unusable for tailoring. Empty when it is complete enough. */
export function masterCvProblems(cv: MasterCv) {
  const problems: string[] = [];
  if (!cv.name.trim()) problems.push("Add your name.");
  if (cv.skills.length === 0) problems.push("Add at least one skill.");
  if (cv.experience.length === 0) problems.push("Add at least one job.");
  cv.experience.forEach((job, index) => {
    if (!job.employer.trim() || !job.title.trim()) problems.push(`Job ${index + 1} needs an employer and a title.`);
  });
  return problems;
}

/** All the CV's content in one string, for keyword matching and the no-invention check. */
export function cvText(cv: Omit<MasterCv, "name" | "contact">) {
  return [
    cv.headline,
    cv.summary,
    ...cv.skills,
    ...cv.experience.flatMap((job) => [job.title, job.employer, job.location, job.start, job.end, ...job.bullets]),
    ...cv.education.flatMap((school) => [school.qualification, school.institution, school.start, school.end, ...school.details]),
    ...cv.certifications.flatMap((cert) => [cert.name, cert.issuer, cert.date]),
  ].join("\n");
}
