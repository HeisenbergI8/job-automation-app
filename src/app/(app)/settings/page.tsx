import Link from "next/link";
import { formatDate } from "@/lib/jobs";
import { EMPTY_CV, parseMasterCv } from "@/lib/master-cv";
import { requireOwner } from "@/lib/supabase/server";
import { addCareerBoard, removeCareerBoard, saveCriteria, saveFollowUp, saveMasterCv, saveSelfIntro } from "./actions";
import { CvEditor } from "./cv-editor";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await requireOwner();
  const { data: settings, error } = await supabase.from("settings").select("*").single();
  if (error) throw error;
  const { data: boards, error: boardsError } = await supabase.from("career_boards").select("*").order("created_at");
  if (boardsError) throw boardsError;
  const cv = parseMasterCv(settings.master_cv) ?? EMPTY_CV;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="page-title">Settings</h1>

      <section className="card">
        <h2 className="section-title">Job criteria</h2>
        <SettingsForm action={saveCriteria}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Target roles <span className="font-normal text-muted">(one per line)</span></span>
              <textarea name="target_roles" rows={3} defaultValue={settings.target_roles.join("\n")} />
            </label>
            <label className="field">
              <span>Locations <span className="font-normal text-muted">(one per line)</span></span>
              <textarea name="locations" rows={3} defaultValue={settings.locations.join("\n")} />
            </label>
            <label className="field">
              Remote
              <select name="remote_preference" defaultValue={settings.remote_preference}>
                <option value="any">Any</option>
                <option value="remote">Remote only</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </label>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <label className="field">
                Salary floor
                <input name="salary_floor" inputMode="numeric" defaultValue={settings.salary_floor ?? ""} />
              </label>
              <label className="field">
                Currency
                <input name="salary_currency" maxLength={3} defaultValue={settings.salary_currency ?? ""} />
              </label>
            </div>
            <label className="field">
              <span>Must-have keywords <span className="font-normal text-muted">(one per line)</span></span>
              <textarea name="must_have_keywords" rows={3} defaultValue={settings.must_have_keywords.join("\n")} />
            </label>
            <label className="field">
              <span>Excluded keywords <span className="font-normal text-muted">(one per line)</span></span>
              <textarea name="excluded_keywords" rows={3} defaultValue={settings.excluded_keywords.join("\n")} />
            </label>
          </div>
        </SettingsForm>
      </section>

      <section className="card">
        <h2 className="section-title">Company career pages</h2>
        <p className="mb-4 text-sm text-muted">
          The daily finder reads these job boards. Paste the link to a company’s Greenhouse, Lever or Ashby
          job board, for example https://jobs.lever.co/company.
        </p>
        {boards.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {boards.map((board) => (
              <li key={board.id} className="flex items-start justify-between gap-3">
                <span>
                  {board.company ?? board.slug} <span className="text-muted">({board.ats}: {board.slug})</span>
                  {board.last_error ? (
                    <span className="block text-red-600">{board.last_error}</span>
                  ) : (
                    board.last_checked_at && <span className="block text-muted">Read {formatDate(board.last_checked_at)}</span>
                  )}
                </span>
                <form action={removeCareerBoard}>
                  <input type="hidden" name="id" value={board.id} />
                  <button className="text-sm text-muted hover:text-red-600">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <SettingsForm action={addCareerBoard}>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className="field">
              Job-board link
              <input name="link" placeholder="https://jobs.lever.co/company" required />
            </label>
            <label className="field">
              <span>Company name <span className="font-normal text-muted">(optional)</span></span>
              <input name="company" />
            </label>
          </div>
        </SettingsForm>
      </section>

      <section className="card">
        <h2 className="section-title">Follow-up</h2>
        <SettingsForm action={saveFollowUp}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              Remind me after (days with no reply)
              <input name="follow_up_after_days" type="number" min={1} defaultValue={settings.follow_up_after_days} />
            </label>
            <label className="field">
              Mark ghosted after (days)
              <input name="ghost_after_days" type="number" min={2} defaultValue={settings.ghost_after_days} />
            </label>
          </div>
        </SettingsForm>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Self-introduction</h2>
          {settings.self_intro && (
            <Link href="/settings/teleprompter" className="text-sm text-accent hover:underline">Open teleprompter</Link>
          )}
        </div>
        <SettingsForm action={saveSelfIntro}>
          <label className="field">
            <span>Your answer to “Tell us about yourself” <span className="font-normal text-muted">(also the teleprompter script)</span></span>
            <textarea name="self_intro" rows={7} defaultValue={settings.self_intro ?? ""} />
          </label>
        </SettingsForm>
      </section>

      <section className="card">
        <h2 className="section-title">Master CV</h2>
        <p className="mb-4 text-sm text-muted">
          Tailoring only rewords and reorders what is here. It can never add a skill, employer, title or date
          that isn’t in this CV.
        </p>
        <SettingsForm action={saveMasterCv}>
          <CvEditor initial={cv} />
        </SettingsForm>
      </section>
    </div>
  );
}
