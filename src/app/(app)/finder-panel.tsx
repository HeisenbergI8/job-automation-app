"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, CircleCheck, Clock, Moon, Search, X } from "lucide-react";
import { isActive, STAGES, type FinderRun, type FinderState } from "@/lib/finder";
import { pollFinder, requestFinderRun } from "./finder";
import { ScanMark } from "./scan-mark";

const POLL_MS = 3000;

function ago(time: string, now: number) {
  const minutes = Math.round((now - new Date(time).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(time).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Problems({ run }: { run: FinderRun }) {
  if (!run.errors.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted hover:text-foreground">{plural(run.errors.length, "problem")} along the way</summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted">
        {run.errors.map((error) => <li key={error}>{error}</li>)}
      </ul>
    </details>
  );
}

function Running({ run, now }: { run: FinderRun; now: number }) {
  const current = STAGES.findIndex((stage) => stage.id === run.stage);
  const step = Math.max(current, 0);
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <ScanMark />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Finding jobs</h2>
            {/* The server and the browser can land either side of a second, hence the suppression. */}
            <span className="text-sm text-muted tabular-nums" suppressHydrationWarning>{clock(now - new Date(run.started_at).getTime())}</span>
          </div>
          <p className="text-sm text-muted">{current >= 0 ? STAGES[current].label : "Getting started"}…</p>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${((step + 0.5) / STAGES.length) * 100}%` }} />
      </div>

      <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, index) => {
          const done = index < step;
          const here = index === step;
          return (
            <li key={stage.id} className={`flex items-center gap-2.5 ${done ? "text-foreground" : here ? "font-medium text-accent" : "text-muted"}`}>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-accent-soft text-accent" : here ? "bg-accent text-accent-foreground" : "border border-border"
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="size-3" /> : here ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
              </span>
              <span className="min-w-0">
                {stage.label}
                <span className="sr-only">{done ? " (done)" : here ? " (in progress)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-muted">
        Scoring can take a few minutes. You can leave this page: new jobs show up here, and on Telegram, when it&apos;s done.
      </p>
    </div>
  );
}

/**
 * The dashboard's header, with the "Find jobs now" button and what the finder is doing. While a run
 * is waiting for the Mac or going, it checks every few seconds; when the run ends it refreshes the
 * page, so the new best matches appear.
 */
export function FinderPanel({ initial }: { initial: FinderState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pressing, startPress] = useTransition();
  const active = isActive(state);
  const wasActive = useRef(active);

  useEffect(() => {
    if (!active) return;
    const poll = setInterval(async () => {
      try {
        setState(await pollFinder());
      } catch {
        // A missed check is retried on the next tick.
      }
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [active]);

  // The run just ended: reload the dashboard's data so its best matches and counts are current.
  useEffect(() => {
    if (wasActive.current && !active) router.refresh();
    wasActive.current = active;
  }, [active, router]);

  const press = () =>
    startPress(async () => {
      setError(null);
      const result = await requestFinderRun();
      if (result.error) setError(`The search couldn't be requested: ${result.error}`);
      if (result.state) {
        setState(result.state);
        setNow(Date.now());
      }
    });

  const busy = active || pressing;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Every application, at a glance.</p>
        </div>
        <button type="button" onClick={press} disabled={busy} className="btn-primary px-5 disabled:opacity-80">
          {busy ? <ScanMark small /> : <Search className="size-4" aria-hidden="true" />}
          {busy ? "Finding jobs…" : "Find jobs now"}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {state.kind === "idle" && (
        <p className="flex items-center gap-2 text-sm text-muted" suppressHydrationWarning>
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {state.lastRun?.finished_at
            ? `Last search ${ago(state.lastRun.finished_at, now)} · ${plural(state.lastRun.saved, "job")} saved from ${state.lastRun.fetched} checked`
            : "No searches yet. Press Find jobs now, or wait for the next scheduled search."}
        </p>
      )}

      {state.kind === "waiting" &&
        (state.slow ? (
          <div className="card flex gap-4 bg-warn-soft ring-0" role="status">
            <Moon className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
            <div className="text-sm">
              <h2 className="font-semibold">Your Mac hasn&apos;t picked this up yet</h2>
              <p className="mt-1 text-muted">
                The search runs on your Mac, so it has to be awake with the finder set up. If you haven&apos;t yet, run{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">npm run schedule</code> once in the worker folder. The
                search starts as soon as your Mac checks in.
              </p>
            </div>
          </div>
        ) : (
          <div className="card flex items-center gap-4" role="status">
            <ScanMark />
            <div className="text-sm">
              <h2 className="font-semibold">Sent to your Mac</h2>
              <p className="text-muted">It checks every 30 seconds, so the search starts within half a minute.</p>
            </div>
          </div>
        ))}

      {state.kind === "starting" && (
        <div className="card flex items-center gap-4" role="status">
          <ScanMark />
          <div className="text-sm">
            <h2 className="font-semibold">Starting the search</h2>
            <p className="text-muted">Your Mac picked it up.</p>
          </div>
        </div>
      )}

      {state.kind === "running" && <Running run={state.run} now={now} />}

      {state.kind === "done" && dismissed !== state.run.id && (
        <div className="card" role="status">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-good" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <h2 className="font-semibold">{state.run.saved ? `${plural(state.run.saved, "new job")} found` : "No new matches this time"}</h2>
              <p className="mt-0.5 text-muted">
                Checked {state.run.fetched} postings · {state.run.new_postings} new to you · {state.run.scored} scored
              </p>
              {state.run.saved > 0 && (
                <Link href="/jobs?status=found" className="mt-2 inline-block font-medium text-accent hover:underline">See the new jobs</Link>
              )}
              <Problems run={state.run} />
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setDismissed(state.run.id)} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-muted">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {state.kind === "failed" && dismissed !== state.run.id && (
        <div className="card bg-danger-soft ring-0" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <h2 className="font-semibold">The search stopped part-way</h2>
              <p className="mt-0.5 text-muted">{state.run.errors.at(-1) ?? "No reason was recorded."} The full log is in worker/logs/finder.log on your Mac.</p>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setDismissed(state.run.id)} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-danger-soft">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
