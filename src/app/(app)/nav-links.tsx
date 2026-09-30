"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Thin 1.5px line icons, 24px grid.
const ICONS = {
  dashboard: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />,
  jobs: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="1.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
    </>
  ),
  analytics: <path d="M4 20h16M7 16.5V11M11 16.5V6M15 16.5v-4M19 16.5V8.5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
    </>
  ),
};

const LINKS = [
  { href: "/", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/jobs", label: "Jobs", icon: ICONS.jobs },
  { href: "/analytics", label: "Analytics", icon: ICONS.analytics },
  { href: "/settings", label: "Settings", icon: ICONS.settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/** Text tabs in the top bar; the active one is underlined in the accent. */
export function NavLinks() {
  const isActive = useIsActive();
  return (
    <nav className="hidden self-stretch sm:flex sm:gap-6">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`-mb-px flex items-center border-b-2 text-sm transition-colors ${
            isActive(href)
              ? "border-accent font-medium text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar on phone widths, in place of the top tabs. */
export function TabBar() {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      {LINKS.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-col items-center gap-1 py-2 text-[11px] ${isActive(href) ? "font-medium text-accent" : "text-muted"}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon}
          </svg>
          {label}
        </Link>
      ))}
    </nav>
  );
}
