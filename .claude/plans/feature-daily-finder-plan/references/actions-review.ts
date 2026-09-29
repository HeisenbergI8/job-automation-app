// Review of src/app/(app)/settings/actions.ts. The pattern the new addCareerBoard/removeCareerBoard follow.
// Settings server actions: each checks the owner, validates the form, writes, revalidates and returns
// { error } or { saved: true } for SettingsForm (useActionState).

export type SettingsState = { error?: string; saved?: boolean } | null;

// NOTE: the one-entry-per-line list parser. Not needed for boards, where one link is added at a time.
function list(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// NOTE: requireOwner() returns the cookie-bound Supabase client (RLS as the owner). It is server-only,
// which is fine here and irrelevant to the worker.
async function save(changes: TablesUpdate<"settings">): Promise<SettingsState> {
  const supabase = await requireOwner();
  const { error } = await supabase
    .from("settings")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { saved: true };
}

// NOTE: the canonical shape of an action: validate first, return a plain-language { error }, then save.
export async function saveCriteria(_prev: SettingsState, formData: FormData) {
  const remote = String(formData.get("remote_preference")) as Enums<"remote_preference">;
  if (!Constants.public.Enums.remote_preference.includes(remote)) return { error: "Pick a remote preference." };
  // ...
}
