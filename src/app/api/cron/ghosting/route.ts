import { createServiceClient } from "@/lib/supabase/server";

// ROADMAP 2.5: runs daily on Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a bearer
// token; anything else is refused. The proxy lets /api/cron/ through without a login.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: ghosted, error } = await createServiceClient().rpc("mark_ghosted_jobs");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ghosted });
}
