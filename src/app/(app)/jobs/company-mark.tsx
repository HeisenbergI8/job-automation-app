// The tint is derived from the name, so a company keeps its colour on every screen. It is decoration
// only, and never one of the status colours.
const TINTS = [
  "bg-chip-indigo/12 text-chip-indigo",
  "bg-chip-sky/12 text-chip-sky",
  "bg-chip-mint/12 text-chip-mint",
  "bg-chip-violet/12 text-chip-violet",
  "bg-chip-amber/12 text-chip-amber",
];

function tintFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** "White Cloak Technologies, Inc." → "WC". */
function initialsFor(name: string) {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

/** A company as its initials in a tinted circle, standing in for a logo. */
export function CompanyMark({ company, size = "md" }: { company: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tintFor(company)} ${
        size === "lg" ? "size-14 text-lg" : "size-10 text-xs"
      }`}
    >
      {initialsFor(company)}
    </span>
  );
}
