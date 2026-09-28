// ROADMAP 4.2: ATS keyword match. The keywords come from the job description (extracted once by
// Claude and saved on the job); the score is the share of them the CV mentions.
import { mentions } from "./text";

export function keywordScore(keywords: string[], text: string) {
  const matched = keywords.filter((keyword) => mentions(text, keyword));
  return {
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
    matched,
    missing: keywords.filter((keyword) => !matched.includes(keyword)),
  };
}
