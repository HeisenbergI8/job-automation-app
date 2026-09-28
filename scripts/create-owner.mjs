// Creates the single owner account, or resets its password. Public sign-up is disabled, so this
// is the only way in. Usage: npm run owner:create -- you@example.com 'a-long-password'
// With no arguments it uses OWNER_EMAIL and OWNER_PASSWORD from .env.local (db:reset relies on this).
import { createClient } from "@supabase/supabase-js";

const [email = process.env.OWNER_EMAIL, password = process.env.OWNER_PASSWORD] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run owner:create -- <email> <password>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;
const owner = data.users[0];

if (owner && owner.email !== email) {
  console.error(`An owner already exists (${owner.email}). This app has exactly one user.`);
  process.exit(1);
}

const { error } = owner
  ? await supabase.auth.admin.updateUserById(owner.id, { password })
  : await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
console.log(owner ? `Password reset for ${email}.` : `Owner ${email} created.`);
