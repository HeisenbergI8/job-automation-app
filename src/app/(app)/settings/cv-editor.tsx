"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { CvCertification, CvEducation, CvExperience, MasterCv } from "@/lib/master-cv";
import { markDirty, TagInput } from "./tag-input";

const lines = (value: string) => value.split("\n");
const EMPTY_JOB: CvExperience = { employer: "", title: "", location: "", start: "", end: "", bullets: [] };
const EMPTY_SCHOOL: CvEducation = { institution: "", qualification: "", start: "", end: "", details: [] };
const EMPTY_CERT: CvCertification = { name: "", issuer: "", date: "" };

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        // The buttons sit in the card's summary row; clicking one must not fold the card.
        event.preventDefault();
        onClick();
      }}
      className={`flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors ${
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** One entry, folded to a summary line once filled in so a long CV stays scannable. */
function EntryCard({ title, meta, startOpen, actions, children }: { title: string; meta: string; startOpen: boolean; actions: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {meta && <span className="block truncate text-xs text-muted">{meta}</span>}
        </span>
        <span className="flex shrink-0 items-center">{actions}</span>
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

/** Edits a list of entries: each can be changed, reordered or removed. */
function Entries<T>({
  label,
  addLabel,
  items,
  empty,
  onChange,
  summarize,
  render,
}: {
  label: string;
  addLabel: string;
  items: T[];
  empty: T;
  onChange: (items: T[]) => void;
  summarize: (item: T) => { title: string; meta: string };
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Keys that survive reordering, so a card keeps its open state when it moves.
  const [keys, setKeys] = useState(() => items.map((_, index) => index));
  const [nextKey, setNextKey] = useState(items.length);
  const change = (next: T[], nextKeys: number[]) => {
    onChange(next);
    setKeys(nextKeys);
    markDirty(root.current);
  };
  const update = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const swap = (a: number, b: number) => {
    const next = [...items];
    const nextKeys = [...keys];
    [next[a], next[b]] = [next[b], next[a]];
    [nextKeys[a], nextKeys[b]] = [nextKeys[b], nextKeys[a]];
    change(next, nextKeys);
  };

  return (
    <div ref={root} className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label} <span className="font-normal">· {items.length}</span>
      </h3>
      {items.map((item, index) => {
        const { title, meta } = summarize(item);
        return (
          <EntryCard
            key={keys[index]}
            title={title || `New ${addLabel.toLowerCase()}`}
            meta={meta}
            startOpen={!title}
            actions={
              <>
                {index > 0 && (
                  <IconButton label="Move up" onClick={() => swap(index, index - 1)}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </IconButton>
                )}
                {index < items.length - 1 && (
                  <IconButton label="Move down" onClick={() => swap(index, index + 1)}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </IconButton>
                )}
                <IconButton
                  label="Remove"
                  danger
                  onClick={() => change(items.filter((_, i) => i !== index), keys.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </>
            }
          >
            {render(item, (patch) => update(index, patch))}
          </EntryCard>
        );
      })}
      <button
        type="button"
        onClick={() => {
          change([...items, empty], [...keys, nextKey]);
          setNextKey((key) => key + 1);
        }}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add {addLabel.toLowerCase()}
      </button>
    </div>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Lines({ label, hint, value, onChange, rows = 3 }: { label: string; hint: string; value: string[]; onChange: (value: string[]) => void; rows?: number }) {
  return (
    <label className="field">
      <span>{label} <span className="font-normal text-muted">({hint})</span></span>
      <textarea rows={rows} value={value.join("\n")} onChange={(event) => onChange(lines(event.target.value))} />
    </label>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</h3>;
}

const dates = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

export function CvEditor({ initial }: { initial: MasterCv }) {
  const [cv, setCv] = useState(initial);
  const set = (patch: Partial<MasterCv>) => setCv((current) => ({ ...current, ...patch }));
  const setContact = (patch: Partial<MasterCv["contact"]>) => set({ contact: { ...cv.contact, ...patch } });

  return (
    <div className="flex flex-col gap-8">
      <input type="hidden" name="master_cv" value={JSON.stringify(cv)} />

      <div className="flex flex-col gap-4">
        <Heading>Profile</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name" value={cv.name} onChange={(name) => set({ name })} />
          <Text label="Headline" value={cv.headline} onChange={(headline) => set({ headline })} placeholder="Full-Stack AI Engineer" />
          <Text label="Email" value={cv.contact.email} onChange={(email) => setContact({ email })} />
          <Text label="Phone" value={cv.contact.phone} onChange={(phone) => setContact({ phone })} />
          <Text label="Location" value={cv.contact.location} onChange={(location) => setContact({ location })} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-links" className="text-sm font-medium">Links</label>
            <TagInput id="cv-links" value={cv.contact.links} onChange={(links) => setContact({ links })} placeholder="github.com/you" />
          </div>
        </div>
        <label className="field">
          Summary
          <textarea rows={4} value={cv.summary} onChange={(event) => set({ summary: event.target.value })} className="leading-6" />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Heading>Skills</Heading>
        <TagInput value={cv.skills} onChange={(skills) => set({ skills })} placeholder="Add a skill and press Enter" />
      </div>

      <Entries
        label="Experience"
        addLabel="Job"
        items={cv.experience}
        empty={EMPTY_JOB}
        onChange={(experience) => set({ experience })}
        summarize={(job) => ({
          title: [job.title, job.employer].filter(Boolean).join(" · "),
          meta: [dates(job.start, job.end), job.location].filter(Boolean).join(" · "),
        })}
        render={(job, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Title" value={job.title} onChange={(title) => update({ title })} />
            <Text label="Employer" value={job.employer} onChange={(employer) => update({ employer })} />
            <Text label="Location" value={job.location} onChange={(location) => update({ location })} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Start" value={job.start} onChange={(start) => update({ start })} placeholder="Jan 2024" />
              <Text label="End" value={job.end} onChange={(end) => update({ end })} placeholder="Present" />
            </div>
            <div className="sm:col-span-2">
              <Lines label="Achievements" hint="one per line" rows={5} value={job.bullets} onChange={(bullets) => update({ bullets })} />
            </div>
          </div>
        )}
      />

      <Entries
        label="Education"
        addLabel="School"
        items={cv.education}
        empty={EMPTY_SCHOOL}
        onChange={(education) => set({ education })}
        summarize={(school) => ({
          title: [school.qualification, school.institution].filter(Boolean).join(" · "),
          meta: dates(school.start, school.end),
        })}
        render={(school, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Institution" value={school.institution} onChange={(institution) => update({ institution })} />
            <Text label="Qualification" value={school.qualification} onChange={(qualification) => update({ qualification })} />
            <Text label="Start" value={school.start} onChange={(start) => update({ start })} />
            <Text label="End" value={school.end} onChange={(end) => update({ end })} />
            <div className="sm:col-span-2">
              <Lines label="Details" hint="one per line" value={school.details} onChange={(details) => update({ details })} />
            </div>
          </div>
        )}
      />

      <Entries
        label="Certifications"
        addLabel="Certification"
        items={cv.certifications}
        empty={EMPTY_CERT}
        onChange={(certifications) => set({ certifications })}
        summarize={(cert) => ({ title: cert.name, meta: [cert.issuer, cert.date].filter(Boolean).join(" · ") })}
        render={(cert, update) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Text label="Name" value={cert.name} onChange={(name) => update({ name })} />
            <Text label="Issuer" value={cert.issuer} onChange={(issuer) => update({ issuer })} />
            <Text label="Date" value={cert.date} onChange={(date) => update({ date })} />
          </div>
        )}
      />
    </div>
  );
}
