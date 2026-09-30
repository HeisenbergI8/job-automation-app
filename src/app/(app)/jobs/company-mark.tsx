/** A monogram tile standing in for a company logo. */
export function CompanyMark({ company, size = "md" }: { company: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted font-semibold ${
        size === "lg" ? "size-12 text-xl" : "size-9 text-sm"
      }`}
    >
      {company.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
