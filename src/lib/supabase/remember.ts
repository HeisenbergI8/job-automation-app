import type { CookieOptions } from "@supabase/ssr";

/** Set to "0" for the browser session when the owner logs in without ticking "Remember me". */
export const REMEMBER_COOKIE = "remember-me";

/**
 * Supabase writes its auth cookies with a long expiry. Without "Remember me", drop the expiry so
 * they become session cookies and the login ends when the browser closes. Removals (empty value)
 * keep their options, since they rely on maxAge 0 to delete the cookie.
 */
export function authCookieOptions(remember: boolean, value: string, options: CookieOptions) {
  if (remember || !value) return options;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...rest } = options;
  return rest;
}
