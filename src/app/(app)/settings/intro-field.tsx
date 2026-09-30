"use client";

import { useState } from "react";

// A comfortable interview pace.
const WORDS_PER_MINUTE = 130;

/** The self-introduction box, with a live word count and how long it takes to say. */
export function IntroField({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60);
  const spoken = seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="self_intro" className="text-sm font-medium">Your answer to “Tell us about yourself”</label>
      <textarea
        id="self_intro"
        name="self_intro"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="input leading-6"
      />
      <p className="text-xs text-muted">
        {words} words · about {spoken} spoken. It is also the teleprompter script.
      </p>
    </div>
  );
}
