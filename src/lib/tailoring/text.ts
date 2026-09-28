// Text matching shared by the keyword score and the no-invention check.

const UNITS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * Lowercase, with numbers in one form, so "six years" and "6 years", "forty-five" and "45", and
 * "40k" and "40,000" compare equal.
 */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(new RegExp(`\\b(${TENS.join("|")})(?:[- ](${UNITS.join("|")}))?\\b`, "g"), (_, tens: string, unit?: string) =>
      String((TENS.indexOf(tens) + 2) * 10 + (unit ? UNITS.indexOf(unit) + 1 : 0)),
    )
    .replace(new RegExp(`\\b(${[...UNITS, ...TEENS].join("|")})\\b`, "g"), (word) =>
      String(UNITS.includes(word) ? UNITS.indexOf(word) + 1 : TEENS.indexOf(word) + 10),
    )
    .replace(/\b(\d+(?:\.\d+)?)([km])\b/g, (_, value: string, unit: string) =>
      String(Math.round(Number(value) * (unit === "k" ? 1_000 : 1_000_000))),
    );
}

function escape(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Variants that count as the same term, e.g. "Next.js" and "NextJS", "Node.js" and "Node". */
function variants(term: string) {
  const base = normalize(term).trim();
  const set = new Set([base]);
  if (base.endsWith(".js")) {
    set.add(base.slice(0, -3));
    set.add(`${base.slice(0, -3)}js`);
  } else if (base.endsWith("js") && !base.includes(" ")) {
    set.add(`${base.slice(0, -2)}.js`);
  }
  return [...set].filter(Boolean);
}

/** Whether `text` mentions `term` as a whole word or phrase (case-insensitive). */
export function mentions(text: string, term: string) {
  const haystack = normalize(text);
  return variants(term).some((variant) =>
    new RegExp(`(?<![a-z0-9])${escape(variant)}(?![a-z0-9+#])`).test(haystack),
  );
}

/** Every number in the text (years, percentages, counts), normalised. */
export function numbersIn(text: string) {
  return new Set(normalize(text).match(/\d+(?:[.,]\d+)*/g)?.map((n) => n.replace(/,/g, "")) ?? []);
}

export function sameText(a: string, b: string) {
  return normalize(a).replace(/\s+/g, " ").trim() === normalize(b).replace(/\s+/g, " ").trim();
}

// Ordinary words a sentence or bullet can open with. A capitalised first word that isn't one of
// these (and isn't an -ed/-ing/-ly verb or adverb) is treated as a possible name, so an invented
// "Globex hired me..." or "Redis was..." is still caught.
const OPENERS = new Set(
  `i my me we our us you your they their he she it its this that these those the a an there here what which who
  when where why how as at in on for with by from to of into after before during since while over across through
  within beyond outside alongside both each every all most many some one another more other such and but or so
  yet also then now today currently previously recently together if because although though whether not no
  thank thanks please dear kind regards best sincerely hello hi am is are was were be have has had do does did
  can could will would should may might must led built cut ran made drove grew wrote won took gave held kept set
  brought taught began chose found got met rose saw spoke went lead build own design create deliver drive help
  bring love enjoy work key strong proven experienced passionate skilled excited eager happy ready able confident`.split(/\s+/),
);

/**
 * Names in the text: capitalised words (Kubernetes, Globex), including a sentence's first word
 * unless it's an ordinary opener, and tech-style tokens (Node.js, C#, C++). Used to catch claims
 * the source text doesn't contain.
 */
export function namesIn(text: string) {
  const names = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?:;])\s+|\n+/)) {
    const words = sentence.trim().replace(/^[-•–—*\s]+/, "").split(/\s+/);
    words.forEach((raw, index) => {
      const word = raw.replace(/^[("'“‘]+|[)"'”’,.!?:;]+$/g, "");
      const techToken = /[a-z]/i.test(word) && /[#+]|[a-z]\.[a-z]/i.test(word) && !/^(e\.g|i\.e)$/i.test(word);
      const opener = index === 0 && (OPENERS.has(word.toLowerCase()) || /(ed|ing|ly)$/.test(word));
      const capitalised = /^[A-Z][A-Za-z0-9]/.test(word) && !opener && !/^I(['’][a-z]+)?$/.test(word);
      if (capitalised || techToken) names.add(word);
    });
  }
  return [...names];
}
