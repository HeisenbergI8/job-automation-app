import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieOptions, REMEMBER_COOKIE } from "./remember";
import type { Database } from "./types";

/**
 * Acts as the signed-in owner, so row-level security applies. `remember` overrides the stored
 * "Remember me" choice, for the login action that is making that choice.
 */
export async function createClient({ remember }: { remember?: boolean } = {}) {
  const cookieStore = await cookies();
  const keep = remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          // Server components can't set cookies; the proxy refreshes the session instead.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, authCookieOptions(keep, value, options)),
            );
          } catch {}
        },
      },
    },
  );
}

/**
 * A client for server actions and pages that must only run for the owner. The proxy already
 * redirects logged-out visitors, but server actions are reachable by direct POST, so check again.
 */
export async function requireOwner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return supabase;
}

/** Bypasses row-level security. Only for trusted server jobs such as the ghosting cron. */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
