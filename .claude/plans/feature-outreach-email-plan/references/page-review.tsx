// Review of src/app/(app)/jobs/[id]/page.tsx (240 lines). The job detail page: a server component
// reading through requireOwner(), status control and timeline in the right column. Stage 7 adds the
// outreach panel under Status and draws the timeline from timelineEntries().

const [{ data: events }, { data: transitions }, { data: documents }, { data: intros }, { data: settings }] = await Promise.all([
  supabase.from("job_status_events").select("*").eq("job_id", id).order("changed_at"),
  // ...
]);
// NOTE: parallel reads in one Promise.all; stage 7 adds contacts, emails and the latest request.

// IMPORTANT: the timeline marks the LAST event as current. Once sent emails are merged in, the last
// entry can be an email, so "current" must become the last *status* entry.
{events?.map((event, index) => {
  const current = index === events.length - 1;
  return (
    <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
      {/* ring for current, check mark for past */}
      <div className="font-medium">{STATUS_LABELS[event.to_status]}</div>
      {/* NOTE: STATUS_LABELS is used only here (line 225); after the change it moves into timelineEntries */}
      <div className="text-xs text-muted">{new Date(event.changed_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</div>
      {event.note && <div className="mt-0.5 text-muted">{event.note}</div>}
    </li>
  );
})}

// NOTE: `export const maxDuration = 300;` is already set for tailoring actions; outreach actions are quick.
