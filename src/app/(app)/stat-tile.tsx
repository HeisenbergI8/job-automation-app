import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const TINTS = {
  indigo: "bg-chip-indigo/10 text-chip-indigo",
  sky: "bg-chip-sky/10 text-chip-sky",
  mint: "bg-chip-mint/10 text-chip-mint",
  violet: "bg-chip-violet/10 text-chip-violet",
  amber: "bg-chip-amber/10 text-chip-amber",
};

type Props = {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  href?: string;
};

/** The one filled tile a page gets: says "start here" before a figure is read. */
export function HeroTile({ label, value, note, icon: Icon }: Omit<Props, "tint" | "href">) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-hero p-6 text-white shadow-rest sm:p-8">
      {/* One soft highlight so the fill reads as a lit surface, not a flat rectangle. */}
      <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center gap-2 text-xs font-medium tracking-wide text-white/90 uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="relative mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{value}</div>
      {note && <div className="relative mt-2 text-sm text-white/85 sm:text-base">{note}</div>}
    </div>
  );
}

/** A supporting figure with a tinted icon chip. Links through when given an href. */
export function StatTile({ label, value, note, icon: Icon, tint = "indigo", href }: Props) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TINTS[tint]}`} aria-hidden="true">
          <Icon className="size-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm text-muted">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      </div>
      {note && <div className="mt-3 text-sm text-muted">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card card-link block p-4 sm:p-5">{body}</Link>
  ) : (
    <div className="card p-4 sm:p-5">{body}</div>
  );
}
