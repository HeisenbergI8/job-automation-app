// The worker's Supabase client. Service role, so it bypasses RLS; the jobs trigger and
// set_job_status() still enforce the status rules. Reads only the worker's own env file.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from the worker's env file (see worker/.env.example).`);
  return value;
}

export function createServiceClient() {
  return createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Db = ReturnType<typeof createServiceClient>;
