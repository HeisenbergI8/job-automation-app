"use client";

import { useState, type ReactNode } from "react";
import type { CvCertification, CvEducation, CvExperience, MasterCv } from "@/lib/master-cv";

const lines = (value: string) => value.split("\n");
const EMPTY_JOB: CvExperience = { employer: "", title: "", location: "", start: "", end: "", bullets: [] };
const EMPTY_SCHOOL: CvEducation = { institution: "", qualification: "", start: "", end: "", details: [] };
const EMPTY_CERT: CvCertification = { name: "", issuer: "", date: "" };

/** Edits a list of entries: each can be changed, moved up or removed. */
function Entries<T>({
  label,
  items,
  empty,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  empty: T;
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const update = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number) => {
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      {items.map((item, index) => (
        <div key={index} className="rounded-md border border-border p-3">
          {render(item, (patch) => update(index, patch))}
          <div className="mt-2 flex gap-3 text-xs">
            {index > 0 && (
              <button type="button" className="text-muted hover:text-foreground" onClick={() => move(index)}>Move up</button>
            )}
            <button type="button" className="text-red-600 hover:underline" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn" onClick={() => onChange([...items, empty])}>Add {label.toLowerCase().replace(/s$/, "")}</button>
      </div>
    </fieldset>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
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

export function CvEditor({ initial }: { initial: MasterCv }) {
  const [cv, setCv] = useState(initial);
  const set = (patch: Partial<MasterCv>) => setCv((current) => ({ ...current, ...patch }));
  const setContact = (patch: Partial<MasterCv["contact"]>) => set({ contact: { ...cv.contact, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <input type="hidden" name="master_cv" value={JSON.stringify(cv)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Name" value={cv.name} onChange={(name) => set({ name })} />
        <Text label="Headline" value={cv.headline} onChange={(headline) => set({ headline })} />
        <Text label="Email" value={cv.contact.email} onChange={(email) => setContact({ email })} />
        <Text label="Phone" value={cv.contact.phone} onChange={(phone) => setContact({ phone })} />
        <Text label="Location" value={cv.contact.location} onChange={(location) => setContact({ location })} />
        <Lines label="Links" hint="one per line" rows={2} value={cv.contact.links} onChange={(links) => setContact({ links })} />
      </div>

      <label className="field">
        Summary
        <textarea rows={3} value={cv.summary} onChange={(event) => set({ summary: event.target.value })} />
      </label>

      <Lines label="Skills" hint="one per line" rows={6} value={cv.skills} onChange={(skills) => set({ skills })} />

      <Entries
        label="Jobs"
        items={cv.experience}
        empty={EMPTY_JOB}
        onChange={(experience) => set({ experience })}
        render={(job, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Employer" value={job.employer} onChange={(employer) => update({ employer })} />
            <Text label="Title" value={job.title} onChange={(title) => update({ title })} />
            <Text label="Location" value={job.location} onChange={(location) => update({ location })} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Start" value={job.start} onChange={(start) => update({ start })} />
              <Text label="End" value={job.end} onChange={(end) => update({ end })} />
            </div>
            <div className="sm:col-span-2">
              <Lines label="Achievements" hint="one per line" rows={4} value={job.bullets} onChange={(bullets) => update({ bullets })} />
            </div>
          </div>
        )}
      />

      <Entries
        label="Education"
        items={cv.education}
        empty={EMPTY_SCHOOL}
        onChange={(education) => set({ education })}
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
        items={cv.certifications}
        empty={EMPTY_CERT}
        onChange={(certifications) => set({ certifications })}
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
