"use server";

import { revalidatePath } from "next/cache";
import { masterCvProblems, masterCvSchema } from "@/lib/master-cv";
import { requireOwner } from "@/lib/supabase/server";
import { Constants, type Enums, type TablesUpdate } from "@/lib/supabase/types";

export type SettingsState = { error?: string; saved?: boolean } | null;

/** One entry per line or comma. */
function list(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

/** 3.1 */
export async function saveCriteria(_prev: SettingsState, formData: FormData) {
  const remote = String(formData.get("remote_preference")) as Enums<"remote_preference">;
  if (!Constants.public.Enums.remote_preference.includes(remote)) return { error: "Pick a remote preference." };
  const floor = String(formData.get("salary_floor") ?? "").replace(/,/g, "").trim();
  if (floor && Number.isNaN(Number(floor))) return { error: "Salary floor must be a number." };

  return save({
    target_roles: list(formData.get("target_roles")),
    locations: list(formData.get("locations")),
    remote_preference: remote,
    salary_floor: floor ? Number(floor) : null,
    salary_currency: String(formData.get("salary_currency") ?? "").trim().toUpperCase() || null,
    must_have_keywords: list(formData.get("must_have_keywords")),
    excluded_keywords: list(formData.get("excluded_keywords")),
  });
}

/** 2.5 */
export async function saveFollowUp(_prev: SettingsState, formData: FormData) {
  const followUp = Number(formData.get("follow_up_after_days"));
  const ghost = Number(formData.get("ghost_after_days"));
  if (!Number.isInteger(followUp) || !Number.isInteger(ghost) || followUp < 1) {
    return { error: "Use whole numbers of days." };
  }
  if (ghost <= followUp) return { error: "Ghosting has to come after the follow-up reminder." };
  return save({ follow_up_after_days: followUp, ghost_after_days: ghost });
}

/** 3.3 */
export async function saveSelfIntro(_prev: SettingsState, formData: FormData) {
  return save({ self_intro: String(formData.get("self_intro") ?? "").trim() || null });
}

/** 3.2: the editor posts the whole CV as JSON. */
export async function saveMasterCv(_prev: SettingsState, formData: FormData) {
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("master_cv")));
  } catch {
    return { error: "The CV couldn't be read. Reload and try again." };
  }
  const parsed = masterCvSchema.safeParse(json);
  if (!parsed.success) return { error: "The CV is missing fields. Reload and try again." };

  const trim = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
  const cv = {
    ...parsed.data,
    skills: trim(parsed.data.skills),
    contact: { ...parsed.data.contact, links: trim(parsed.data.contact.links) },
    experience: parsed.data.experience.map((job) => ({ ...job, bullets: trim(job.bullets) })),
    education: parsed.data.education.map((school) => ({ ...school, details: trim(school.details) })),
  };
  const problems = masterCvProblems(cv);
  if (problems.length) return { error: problems.join(" ") };
  return save({ master_cv: cv });
}
