"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

/** Tells the surrounding SettingsForm something changed, for edits that fire no input event. */
export function markDirty(element: Element | null) {
  element?.dispatchEvent(new Event("input", { bubbles: true }));
}

const split = (text: string) =>
  text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * A list typed as chips: Enter or a comma adds one, Backspace on an empty box removes the last, and
 * a pasted list splits itself. Text still in the box is added on blur, so Save never drops it.
 *
 * With `name` it submits the list newline-joined, which the settings actions already split. With
 * `value` and `onChange` it is controlled instead (the CV editor).
 */
export function TagInput({
  id,
  name,
  defaultValue = [],
  value,
  onChange,
  placeholder,
  tone = "default",
}: {
  id?: string;
  name?: string;
  defaultValue?: string[];
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  tone?: "default" | "danger";
}) {
  const [own, setOwn] = useState(defaultValue);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const tags = value ?? own;

  const commit = (next: string[]) => {
    if (onChange) onChange(next);
    else setOwn(next);
    markDirty(box.current);
  };
  const add = (text: string) => {
    const fresh = split(text).filter((tag) => !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()));
    if (fresh.length) commit([...tags, ...fresh]);
    setDraft("");
  };

  const chip = tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent";

  return (
    <div
      ref={box}
      onClick={() => box.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus()}
      className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20"
    >
      {name && <input type="hidden" name={name} value={tags.join("\n")} />}
      {tags.map((tag, index) => (
        <span key={tag} className={`inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5 text-sm font-medium ${chip}`}>
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(event) => {
              event.stopPropagation();
              commit(tags.filter((_, i) => i !== index));
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded-md opacity-70 hover:bg-current/10 hover:opacity-100"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={tags.length ? "" : placeholder}
        onChange={(event) => {
          const text = event.target.value;
          if (text.includes(",")) add(text);
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(draft);
          } else if (event.key === "Backspace" && !draft && tags.length) {
            commit(tags.slice(0, -1));
          }
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (/[\n,]/.test(text)) {
            event.preventDefault();
            add(draft + text);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted/70"
      />
    </div>
  );
}
