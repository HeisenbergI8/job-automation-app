// Review of src/lib/tailoring/text.ts (92 lines) and src/lib/tailoring/ats.ts (12 lines).
// Pure text matching shared by the ATS keyword score and the no-invention check. The keyword scorer reuses it.

// NOTE: pure, with no imports at all, so it is safe for the worker (tested with tsx on 2026-09-29).
// Whole-word, case-insensitive, and tolerant of "Next.js"/"NextJS" and "six"/"6".
export function mentions(text: string, term: string) {
  const haystack = normalize(text);
  return variants(term).some((variant) =>
    new RegExp(`(?<![a-z0-9])${escape(variant)}(?![a-z0-9+#])`).test(haystack),
  );
}

// NOTE: normalize() rewrites number words ("forty-five" -> "45", "40k" -> "40000"). That suits keyword
// matching, but it is NOT reused for the dedupe key, which needs punctuation-insensitive identity instead.
export function normalize(text: string) { /* ... */ }

// src/lib/tailoring/ats.ts. Reused by keywordFit() for the must-have share (score is 0-100).
export function keywordScore(keywords: string[], text: string) {
  const matched = keywords.filter((keyword) => mentions(text, keyword));
  return {
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
    matched,
    missing: keywords.filter((keyword) => !matched.includes(keyword)),
  };
}
