import { parseMasterCv } from "@/lib/master-cv";
import { followUpDraft } from "@/lib/outreach";
import { createServiceClient } from "@/lib/supabase/server";

// ROADMAP 2.5 and 7.6: runs daily on Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a bearer
// token; anything else is refused. The proxy lets /api/cron/ through without a login.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createServiceClient();
  const { data: ghosted, error } = await db.rpc("mark_ghosted_jobs");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 7.6: a follow-up draft to the same person for each first email sent 5+ days ago with no reply.
  // A fixed template (owner decision D4): it makes no claim about the CV, and Vercel has no Claude Code.
  const [due, settings] = await Promise.all([
    db.from("outreach_follow_ups_due").select("*"),
    db.from("settings").select("master_cv").single(),
  ]);
  if (due.error || settings.error) {
    return Response.json({ ghosted, error: (due.error ?? settings.error)!.message }, { status: 500 });
  }
  const ownerName = parseMasterCv(settings.data.master_cv)?.name.trim() ?? "";
  // View columns are all nullable in the generated types; these come from not-null table columns.
  const drafts = due.data.map((first) => ({
    job_id: first.job_id!,
    kind: "follow_up" as const,
    contact_id: first.contact_id,
    to_email: first.to_email!,
    to_name: first.to_name,
    ...followUpDraft({ to_name: first.to_name, subject: first.subject!, company: first.company!, role: first.role! }, ownerName),
  }));
  if (drafts.length) {
    const { error: insertError } = await db.from("outreach_emails").upsert(drafts, { onConflict: "job_id,kind", ignoreDuplicates: true });
    if (insertError) return Response.json({ ghosted, error: insertError.message }, { status: 500 });
  }
  return Response.json({ ghosted, followUps: drafts.length });
}
