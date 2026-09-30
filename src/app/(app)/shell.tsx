"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BriefcaseBusiness, ChartColumn, LayoutDashboard, LogOut, Moon, Plus, Settings, Sun } from "lucide-react";
import { logOut } from "@/app/login/actions";
import { isDark, setDark } from "@/lib/theme";

const LINKS = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", short: "Jobs", icon: BriefcaseBusiness },
  { href: "/analytics", label: "Analytics", short: "Analytics", icon: ChartColumn },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
}

// Small external stores for the two browser-only choices, so the server renders a stable default
// and the browser answers without an effect-driven second render.
function localStore(read: () => boolean) {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    notify: () => listeners.forEach((listener) => listener()),
  };
}

const COLLAPSED_KEY = "job-automation:sidebar-collapsed";
const collapsedStore = localStore(() => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
});
const themeStore = localStore(isDark);

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[0.6rem] bg-hero text-white ${className}`}>
      <BriefcaseBusiness className="size-[55%]" aria-hidden="true" />
    </span>
  );
}

/** The laptop sidebar: dark, sticky, and retracts to an icon rail when the mark is clicked. */
export function Sidebar() {
  const isActive = useIsActive();
  const collapsed = useSyncExternalStore(collapsedStore.subscribe, collapsedStore.read, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    } catch {}
    collapsedStore.notify();
  };

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`flex h-16 shrink-0 cursor-pointer items-center gap-2.5 ${collapsed ? "justify-center" : "px-5"}`}
      >
        <BrandMark />
        {!collapsed && <span className="whitespace-nowrap text-[0.95rem] font-semibold tracking-tight text-white">Job Automation</span>}
      </button>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-[0.7rem] py-2 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${
                  isActive(href)
                    ? "bg-sidebar-primary text-white shadow-rest dark:text-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-white"
                }`}
              >
                <Icon className="size-[1.05rem] shrink-0" aria-hidden="true" />
                <span className={collapsed ? "sr-only" : "whitespace-nowrap"}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function ThemeToggle() {
  const dark = useSyncExternalStore(themeStore.subscribe, themeStore.read, () => false);
  return (
    <button
      type="button"
      onClick={() => {
        setDark(!dark);
        themeStore.notify();
      }}
      aria-label="Dark mode"
      aria-pressed={dark}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted active:scale-95"
    >
      {dark ? <Moon className="size-[18px]" aria-hidden="true" /> : <Sun className="size-[18px]" aria-hidden="true" />}
    </button>
  );
}

/** The bar across the top: the mark on phones (where there is no sidebar), then theme, log out, add. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:h-16 md:px-6">
        <Link href="/" className="flex items-center gap-2 md:hidden">
          <BrandMark className="size-7" />
          <span className="font-semibold tracking-tight">Job Automation</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <form action={logOut}>
            <button
              aria-label="Log out"
              title="Log out"
              className="flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted"
            >
              <LogOut className="size-[18px]" aria-hidden="true" />
            </button>
          </form>
          <Link href="/jobs/new" className="btn-primary ml-2 hidden md:inline-flex">
            <Plus className="size-4" aria-hidden="true" />
            Add job
          </Link>
        </div>
      </div>
    </header>
  );
}

/** The phone tab bar: two tabs, a raised Add button in the middle, two tabs. */
export function TabBar() {
  const isActive = useIsActive();
  const tab = ({ href, short, icon: Icon }: (typeof LINKS)[number]) => (
    <li key={href} className="flex-1">
      <Link
        href={href}
        aria-current={isActive(href) ? "page" : undefined}
        className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium ${isActive(href) ? "text-accent" : "text-muted"}`}
      >
        <span className={`rounded-full px-4 py-1 transition-colors duration-300 ${isActive(href) ? "bg-accent-soft" : ""}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {short}
      </Link>
    </li>
  );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="flex items-stretch">
        {LINKS.slice(0, 2).map(tab)}
        <li className="flex-1">
          <Link href="/jobs/new" aria-label="Add a job" className="flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium text-muted">
            {/* Rises out of the bar instead of making it taller; the ring notches the bar around it. */}
            <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-hover ring-4 ring-background transition-transform active:scale-95">
              <Plus className="size-6" aria-hidden="true" />
            </span>
            Add
          </Link>
        </li>
        {LINKS.slice(2).map(tab)}
      </ul>
    </nav>
  );
}
