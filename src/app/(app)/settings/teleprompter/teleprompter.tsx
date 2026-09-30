"use client";

import { useEffect, useRef, useState } from "react";

/** ROADMAP 3.4: the intro scrolls as large captions while the owner records a video. */
export function Teleprompter({ script }: { script: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // pixels per second
  const [fontSize, setFontSize] = useState(44);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let offset = viewport.current?.scrollTop ?? 0;
    let frame = requestAnimationFrame(function step(now) {
      const element = viewport.current;
      if (!element) return;
      offset += ((now - last) / 1000) * speed;
      last = now;
      element.scrollTop = offset;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const restart = () => {
    setPlaying(false);
    viewport.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary w-24" onClick={() => setPlaying((value) => !value)}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="btn" onClick={restart}>Restart</button>
        <label className="flex items-center gap-2 text-sm">
          Speed
          <input type="range" min={10} max={150} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Text size
          <input type="range" min={24} max={80} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
        </label>
        <span className="text-xs text-muted">Space plays and pauses</span>
      </div>
      <div
        ref={viewport}
        className="relative h-[70vh] overflow-y-auto rounded-2xl bg-black px-8 text-center text-white [scrollbar-width:none]"
      >
        {/* Padding lets the first and last lines scroll through the reading line in the middle. */}
        <p className="whitespace-pre-wrap py-[35vh] font-medium leading-snug" style={{ fontSize }}>
          {script}
        </p>
      </div>
    </div>
  );
}
