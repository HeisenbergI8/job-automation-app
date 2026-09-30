"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";

export async function logIn(_prev: string | null, formData: FormData) {
  const remember = formData.get("remember") === "on";
  const supabase = await createClient({ remember });
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return error.message;
  // The proxy reads this on every refresh, so later auth cookies follow the same choice. Without
  // an expiry it disappears along with the session cookies when the browser closes.
  const cookieStore = await cookies();
  if (remember) cookieStore.delete(REMEMBER_COOKIE);
  else cookieStore.set(REMEMBER_COOKIE, "0", { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect("/login");
}
