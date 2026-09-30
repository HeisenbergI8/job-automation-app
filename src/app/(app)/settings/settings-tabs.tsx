"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

export type SettingsTab = { id: string; label: string; icon: ReactNode; panel: ReactNode };

/**
 * One settings section at a time. Every panel stays mounted and is only hidden, so edits not yet
 * saved in one tab are still there after visiting another.
 *
 * The open tab is `?tab=` in the URL, so a reload or a shared link returns to it. The server reads
 * it too and renders that tab first, so nothing flashes. A search param rather than a hash, because
 * Next's router tracks search params written with replaceState and keeps them through the refresh
 * that follows a save; a hash it does not.
 */
export function SettingsTabs({ tabs, initial }: { tabs: SettingsTab[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((tab) => tab.id === initial) ? initial : tabs[0].id);

  const open = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `?tab=${id}`);
  };

  // On a phone the tabs are a row that scrolls sideways; keep the open one in view.
  useEffect(() => {
    document.getElementById(`tab-${active}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  // Arrow keys move between tabs. All four work, since the list is a row on phones and a column on
  // wider screens.
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length].id;
    open(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
      <div
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:px-0"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => open(tab.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-xl lg:border-0 lg:px-3 ${
                selected
                  ? "border-transparent bg-accent text-accent-foreground shadow-rest"
                  : "border-border bg-surface text-muted hover:text-foreground lg:bg-transparent lg:hover:bg-surface"
              }`}
            >
              <span className="[&_svg]:size-4" aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        {tabs.map((tab) => (
          <div key={tab.id} id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== active}>
            {tab.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
