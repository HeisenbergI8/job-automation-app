import { describe, expect, it } from "vitest";
import type { MasterCv } from "@/lib/master-cv";
import { keywordScore } from "./ats";
import { findCvInventions, findTextInventions, type TailoredCv } from "./check";

const master: MasterCv = {
  name: "Sample Owner",
  headline: "Frontend Engineer",
  contact: { email: "owner@example.local", phone: "", location: "Manila", links: [] },
  summary: "Frontend engineer with six years of experience building React and TypeScript products.",
  // (bullets below include "used by 40,000 people a month")
  skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Jest"],
  experience: [
    {
      employer: "Northwind",
      title: "Senior Frontend Engineer",
      location: "Remote",
      start: "Jan 2022",
      end: "Present",
      bullets: ["Led the rebuild of a customer dashboard in Next.js used by 40,000 people a month", "Cut page load time by 45%"],
    },
    {
      employer: "Contoso",
      title: "Frontend Engineer",
      location: "Manila",
      start: "Jun 2019",
      end: "Dec 2021",
      bullets: ["Built the design system in React and Tailwind CSS"],
    },
  ],
  education: [{ institution: "University of the Philippines", qualification: "BS Computer Science", start: "2015", end: "2019", details: [] }],
  certifications: [],
};

const JD_KEYWORDS = ["React", "TypeScript", "Next.js", "GraphQL", "Kubernetes", "Playwright"];

// A faithful tailoring: reordered skills and experience, reworded bullets, a dropped skill.
const faithful: TailoredCv = {
  headline: "Senior Frontend Engineer",
  summary: "Frontend engineer with 6 years building products in TypeScript and React.",
  skills: ["TypeScript", "React", "next.js", "Tailwind CSS"],
  experience: [
    { ...master.experience[0], bullets: ["Cut page load time by 45%", "Led a Next.js rebuild of the customer dashboard"] },
    master.experience[1],
  ],
  education: master.education,
  certifications: [],
};

describe("no-invention check for a tailored CV", () => {
  it("accepts rewording, reordering and dropping", () => {
    expect(findCvInventions(master, faithful, JD_KEYWORDS)).toEqual([]);
  });

  it("rejects a deliberately invented skill in the skills list", () => {
    const tailored = { ...faithful, skills: [...faithful.skills, "GraphQL"] };
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual(
      expect.arrayContaining(['Skill "GraphQL" isn\'t in the master CV.']),
    );
  });

  it("rejects a job keyword the CV lacks, slipped into a bullet", () => {
    const tailored = structuredClone(faithful);
    tailored.experience[0].bullets.push("Deployed services on Kubernetes");
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual([
      'Mentions "Kubernetes", which isn\'t in the master CV.',
    ]);
  });

  it("rejects an invented tool that isn't among the job's keywords either", () => {
    const tailored = structuredClone(faithful);
    tailored.summary += " Experienced with Docker and Vue.js.";
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual([
      'Mentions "Docker", which isn\'t in the master CV.',
      'Mentions "Vue.js", which isn\'t in the master CV.',
    ]);
  });

  it("rejects an invented employer, title and dates", () => {
    const tailored = structuredClone(faithful);
    tailored.experience.push({ ...master.experience[1], employer: "Globex" });
    tailored.experience[1].title = "Lead Frontend Engineer";
    tailored.experience[0].start = "Jan 2020";
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual(
      expect.arrayContaining([
        'Employer "Globex" isn\'t in the master CV.',
        'Title "Lead Frontend Engineer" at Contoso isn\'t in the master CV.',
        'Dates "Jan 2020 – Present" for Senior Frontend Engineer at Northwind don\'t match the master CV.',
      ]),
    );
  });

  it("rejects an inflated number and an invented headline", () => {
    const tailored = structuredClone(faithful);
    tailored.experience[0].bullets[0] = "Cut page load time by 60%";
    tailored.headline = "Staff Engineer";
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual(
      expect.arrayContaining([
        'Uses the number "60", which isn\'t in the master CV.',
        'Headline "Staff Engineer" isn\'t a title from the master CV.',
      ]),
    );
  });

  it("rejects changed education", () => {
    const tailored = { ...faithful, education: [{ ...master.education[0], qualification: "MS Computer Science" }] };
    expect(findCvInventions(master, tailored, JD_KEYWORDS)).toEqual([
      'Education "MS Computer Science, University of the Philippines" doesn\'t match the master CV.',
      'Mentions "MS", which isn\'t in the master CV.',
    ]);
  });
});

describe("no-invention check for free text", () => {
  const allowed = ["Kappa", "Senior Frontend Engineer"];
  it("accepts a letter that only uses the CV and the job's own name", () => {
    const letter = "I'd love to join Kappa as a Senior Frontend Engineer, and I'm sure I've got the React background. I have 6 years of React and Next.js work, and cut load time by 45%.";
    expect(findTextInventions(master, letter, { keywords: JD_KEYWORDS, allowed })).toEqual([]);
  });

  it("rejects an invented name at the start of a sentence", () => {
    expect(findTextInventions(master, "Globex hired me as a consultant. I have strong React skills.", { keywords: JD_KEYWORDS })).toEqual([
      'Mentions "Globex", which isn\'t in the master CV.',
    ]);
    expect(findTextInventions(master, "Redis was something I used daily with React.", { keywords: JD_KEYWORDS })).toEqual([
      'Mentions "Redis", which isn\'t in the master CV.',
    ]);
  });

  it("accepts ordinary sentence openers and faithful number rewordings", () => {
    const letter =
      "Most recently I worked at Northwind. There I led a rebuild used by 40k people a month. Spearheaded a Next.js migration. Together we cut page load time by forty-five percent. Drove the design system at Contoso.";
    expect(findTextInventions(master, letter.replace("40k", "40K"), { keywords: JD_KEYWORDS, allowed })).toEqual([]);
    expect(findTextInventions(master, letter, { keywords: JD_KEYWORDS, allowed })).toEqual([]);
  });

  it("rejects a letter that claims a missing skill or an invented number", () => {
    const letter = "I have 8 years of experience with GraphQL.";
    expect(findTextInventions(master, letter, { keywords: JD_KEYWORDS, allowed })).toEqual([
      'Mentions "GraphQL", which isn\'t in the master CV.',
      'Uses the number "8", which isn\'t in the master CV.',
    ]);
  });
});

describe("ATS keyword score", () => {
  it("scores the share of keywords the text mentions, matching whole words only", () => {
    const result = keywordScore(["React", "Next.js", "Go", "C++"], "Built apps in React and NextJS. Good at Google Docs. C++ too.");
    expect(result).toEqual({ score: 75, matched: ["React", "Next.js", "C++"], missing: ["Go"] });
  });

  it("scores zero with no keywords", () => {
    expect(keywordScore([], "anything").score).toBe(0);
  });
});
