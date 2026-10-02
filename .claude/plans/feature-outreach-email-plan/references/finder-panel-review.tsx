// Review of src/app/(app)/finder-panel.tsx (238 lines). The "Find jobs now" button and its waiting
// state: the pattern stage 7's "Find people" / "Use this person" waiting state copies (useOutreachRequest).

// NOTE: poll every 3s only while active; refresh the page when it stops being active.
useEffect(() => {
  if (!active) return;
  const poll = setInterval(async () => {
    try {
      setState(await pollFinder());          // a server action, called from the client
    } catch {
      // A missed check is retried on the next tick.
    }
  }, POLL_MS);
  // ...
}, [active]);

useEffect(() => {
  if (wasActive.current && !active) router.refresh();
  wasActive.current = active;
}, [active, router]);

// NOTE: the copy for a Mac that hasn't checked in (state.slow after MAC_SLOW_AFTER_MS = 90s in
// src/lib/finder.ts): "Your Mac hasn't picked this up yet ... it has to be awake with the finder set up".
// Stage 7 reuses MAC_SLOW_AFTER_MS and adds "or busy with a job search", because watch.ts handles
// outreach requests only when no requested run is in progress.

// NOTE: status cards use role="status" / aria-live="polite"; stage 7's RequestStatus does the same.
