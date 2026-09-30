import Link from "next/link";
import { BellRing, Building2, FileUser, MicVocal, Presentation, SlidersHorizontal, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/jobs";
import { EMPTY_CV, parseMasterCv } from "@/lib/master-cv";
import { requireOwner } from "@/lib/supabase/server";
import { CompanyMark } from "../jobs/company-mark";
import { addCareerBoard, removeCareerBoard, saveCriteria, saveFollowUp, saveMasterCv, saveSelfIntro } from "./actions";
import { CvEditor } from "./cv-editor";
import { IntroField } from "./intro-field";
import { SettingsForm } from "./settings-form";
import { SettingsTabs } from "./settings-tabs";
import { TagInput } from "./tag-input";

const REMOTE_OPTIONS = [
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
  { value: "any", label: "Any" },
];

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="mb-6 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A label and hint above a control that isn't a plain input, such as the tag input. */
function Field({ htmlFor, label, hint, children }: { htmlFor?: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { tab } = await searchParams;
  const supabase = await requireOwner();
  const { data: settings, error } = await supabase.from("settings").select("*").single();
  if (error) throw error;
  const { data: boards, error: boardsError } = await supabase.from("career_boards").select("*").order("created_at");
  if (boardsError) throw boardsError;
  const cv = parseMasterCv(settings.master_cv) ?? EMPTY_CV;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">What the daily finder looks for, and what tailoring works from.</p>
      </div>

      <SettingsTabs
        initial={typeof tab === "string" ? tab : ""}
        tabs={[
          {
            id: "criteria",
            label: "Job search",
            icon: <SlidersHorizontal />,
            panel: (
              <Section title="Job search" description="The daily finder scores every job it finds against these.">
                <SettingsForm action={saveCriteria}>
                  <Group title="What and where">
                    <Field htmlFor="target_roles" label="Target roles" hint="Press Enter after each one.">
                      <TagInput id="target_roles" name="target_roles" defaultValue={settings.target_roles} placeholder="e.g. AI Engineer" />
                    </Field>
                    <Field htmlFor="locations" label="Locations">
                      <TagInput id="locations" name="locations" defaultValue={settings.locations} placeholder="e.g. Philippines" />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium" id="remote-label">Work setup</span>
                      <div role="radiogroup" aria-labelledby="remote-label" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 sm:grid-cols-4">
                        {REMOTE_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors has-checked:bg-surface has-checked:text-foreground has-checked:shadow-rest has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
                          >
                            <input
                              type="radio"
                              name="remote_preference"
                              value={option.value}
                              defaultChecked={settings.remote_preference === option.value}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted">With remote only, on-site and hybrid jobs are ruled out.</p>
                    </div>
                  </Group>

                  <Group title="Pay">
                    <Field htmlFor="salary_floor" label="Lowest pay you'd accept" hint="Jobs that post a lower figure in the same currency are ruled out.">
                      <div className="flex max-w-sm rounded-xl border border-border bg-surface transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
                        <input
                          name="salary_currency"
                          aria-label="Currency"
                          maxLength={3}
                          defaultValue={settings.salary_currency ?? ""}
                          placeholder="PHP"
                          className="w-16 rounded-l-xl border-r border-border bg-surface-muted/60 px-3 text-center text-sm font-semibold uppercase outline-none"
                        />
                        <input
                          id="salary_floor"
                          name="salary_floor"
                          inputMode="numeric"
                          defaultValue={settings.salary_floor?.toLocaleString("en") ?? ""}
                          placeholder="1,000,000"
                          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm tabular-nums outline-none"
                        />
                      </div>
                    </Field>
                  </Group>

                  <Group title="Keywords">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field htmlFor="must_have_keywords" label="Must-have" hint="The more a job mentions, the higher it scores.">
                        <TagInput id="must_have_keywords" name="must_have_keywords" defaultValue={settings.must_have_keywords} placeholder="e.g. TypeScript" />
                      </Field>
                      <Field htmlFor="excluded_keywords" label="Excluded" hint="Any job that mentions one is ruled out.">
                        <TagInput id="excluded_keywords" name="excluded_keywords" defaultValue={settings.excluded_keywords} placeholder="e.g. PHP" tone="danger" />
                      </Field>
                    </div>
                  </Group>
                </SettingsForm>
              </Section>
            ),
          },
          {
            id: "career-pages",
            label: "Career pages",
            icon: <Building2 />,
            panel: (
              <Section
                title="Career pages"
                description="Company job boards the daily finder reads, from Greenhouse, Lever or Ashby."
              >
                {boards.length > 0 && (
                  <ul className="mb-6 grid gap-2 sm:grid-cols-2">
                    {boards.map((board) => (
                      <li key={board.id} className="flex items-center gap-3 rounded-xl border border-border py-2 pr-1.5 pl-2.5">
                        <CompanyMark company={board.company ?? board.slug} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{board.company ?? board.slug}</span>
                            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs text-muted capitalize">{board.ats}</span>
                          </div>
                          {board.last_error ? (
                            <p className="text-xs text-danger">{board.last_error}</p>
                          ) : (
                            <p className="text-xs text-muted">
                              {board.last_checked_at ? `Read ${formatDate(board.last_checked_at)}` : "Not read yet"}
                            </p>
                          )}
                        </div>
                        <form action={removeCareerBoard}>
                          <input type="hidden" name="id" value={board.id} />
                          <button
                            aria-label={`Remove ${board.company ?? board.slug}`}
                            title="Remove"
                            className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <SettingsForm action={addCareerBoard} submitLabel="Add career page">
                  <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <label className="field">
                      Job-board link
                      <input name="link" type="url" placeholder="https://jobs.lever.co/company" required />
                    </label>
                    <label className="field">
                      <span>Company name <span className="font-normal text-muted">(optional)</span></span>
                      <input name="company" />
                    </label>
                  </div>
                </SettingsForm>
              </Section>
            ),
          },
          {
            id: "follow-up",
            label: "Follow-up",
            icon: <BellRing />,
            panel: (
              <Section title="Follow-up" description="When a quiet application needs a nudge, and when to give up on it.">
                <SettingsForm action={saveFollowUp}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor="follow_up_after_days" label="Remind me after" hint="Shows under Follow up on the dashboard.">
                      <DaysInput id="follow_up_after_days" min={1} defaultValue={settings.follow_up_after_days} />
                    </Field>
                    <Field htmlFor="ghost_after_days" label="Mark ghosted after" hint="Must be longer than the reminder.">
                      <DaysInput id="ghost_after_days" min={2} defaultValue={settings.ghost_after_days} />
                    </Field>
                  </div>
                </SettingsForm>
              </Section>
            ),
          },
          {
            id: "intro",
            label: "Self-introduction",
            icon: <MicVocal />,
            panel: (
              <Section
                title="Self-introduction"
                description="Adapted for each application that asks for one."
                action={
                  settings.self_intro && (
                    <Link href="/settings/teleprompter" className="btn shrink-0 px-3 py-2">
                      <Presentation className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Teleprompter</span>
                    </Link>
                  )
                }
              >
                <SettingsForm action={saveSelfIntro}>
                  <IntroField defaultValue={settings.self_intro ?? ""} />
                </SettingsForm>
              </Section>
            ),
          },
          {
            id: "cv",
            label: "Master CV",
            icon: <FileUser />,
            panel: (
              <Section
                title="Master CV"
                description="Tailoring only rewords and reorders what is here. It never adds a skill, employer, title or date."
              >
                <SettingsForm action={saveMasterCv} submitLabel="Save CV">
                  <CvEditor initial={cv} />
                </SettingsForm>
              </Section>
            ),
          },
        ]}
      />
    </div>
  );
}

function DaysInput({ id, min, defaultValue }: { id: string; min: number; defaultValue: number }) {
  return (
    <div className="flex rounded-xl border border-border bg-surface transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
      <input id={id} name={id} type="number" min={min} defaultValue={defaultValue} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm tabular-nums outline-none" />
      <span className="flex items-center rounded-r-xl border-l border-border bg-surface-muted/60 px-3.5 text-sm text-muted">days</span>
    </div>
  );
}
