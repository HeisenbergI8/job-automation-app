// Small single-series charts rendered on the server as HTML. Every chart has a hover/focus
// tooltip and a table view, so no value depends on reading a bar's length.
import type { ReactNode } from "react";

// Near a chart's edge the tooltip anchors to that side, so it never spills past the page.
const TOOLTIP_ALIGN = { center: "left-1/2 -translate-x-1/2", start: "left-0", end: "right-0" };

function Tooltip({ children, align = "center" }: { children: ReactNode; align?: keyof typeof TOOLTIP_ALIGN }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full z-10 mb-2 ${TOOLTIP_ALIGN[align]} whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus:opacity-100`}
    >
      {children}
    </span>
  );
}

export function TableView({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted hover:text-foreground">Show table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="tabular-nums">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Vertical columns over time. */
export function ColumnChart({ data }: { data: { label: string; value: number; tooltip: string }[] }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <div className="flex gap-2">
      <div className="flex h-40 flex-col justify-between text-right text-xs tabular-nums text-muted">
        <span>{max}</span>
        <span>0</span>
      </div>
      <div className="flex-1">
        <div className="flex h-40 items-end gap-0.5 border-b border-border">
          {data.map((point, index) => (
            <div key={point.label} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
              <div
                className="w-full max-w-12 rounded-t bg-accent group-hover:opacity-80 group-focus:opacity-80"
                style={{ height: `${(point.value / max) * 100}%` }}
              />
              <Tooltip align={index < data.length * 0.3 ? "start" : index >= data.length * 0.7 ? "end" : "center"}>{point.tooltip}</Tooltip>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{data[0]?.label}</span>
          {data.length > 1 && <span>{data.at(-1)!.label}</span>}
        </div>
      </div>
    </div>
  );
}

/** A thin single line over time, one focusable dot per point. */
export function LineChart({ data }: { data: { label: string; value: number; tooltip: string }[] }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const x = (index: number) => (data.length === 1 ? 50 : (index / (data.length - 1)) * 100);
  const y = (value: number) => 100 - (value / max) * 100;
  return (
    <div className="flex gap-3">
      <div className="flex h-32 flex-col justify-between text-right text-xs tabular-nums text-muted">
        <span>{max}</span>
        <span>0</span>
      </div>
      <div className="flex-1">
        <div className="relative h-32 border-b border-l border-border">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <polyline
              points={data.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {data.map((point, index) => (
            <span
              key={point.label}
              tabIndex={0}
              className="group absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent ring-2 ring-surface outline-none"
              style={{ left: `${x(index)}%`, bottom: `${100 - y(point.value)}%` }}
            >
              <Tooltip align={x(index) < 30 ? "start" : x(index) > 70 ? "end" : "center"}>{point.tooltip}</Tooltip>
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{data[0]?.label}</span>
          {data.length > 1 && <span>{data.at(-1)!.label}</span>}
        </div>
      </div>
    </div>
  );
}

/** Horizontal bars with a direct value label; `value` is a share of `max`. */
export function BarList({
  data,
  max,
}: {
  data: { label: string; value: number; display: string; tooltip: string }[];
  max: number;
}) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {data.map((row) => (
        <li key={row.label} tabIndex={0} className="group relative grid grid-cols-[7rem_1fr_6rem] items-center gap-3 outline-none">
          <span className="truncate">{row.label}</span>
          <span className="h-3 rounded-r bg-surface-muted">
            <span
              className="block h-full rounded-r bg-accent group-hover:opacity-80 group-focus:opacity-80"
              style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-muted">{row.display}</span>
          <Tooltip>{row.tooltip}</Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** One dot per value on a shared axis, with the median marked. */
export function StripPlot({
  values,
  min,
  max,
  median,
  format,
}: {
  values: number[];
  min: number;
  max: number;
  median: number;
  format: (value: number) => string;
}) {
  const position = (value: number) => (max === min ? 50 : ((value - min) / (max - min)) * 100);
  // Equal values stack upwards instead of hiding behind each other.
  const seen = new Map<number, number>();
  const dots = values.map((value) => {
    const stack = seen.get(value) ?? 0;
    seen.set(value, stack + 1);
    return { value, stack };
  });
  return (
    <div className="px-2">
      <div className="relative h-12">
        <div className="absolute inset-x-0 bottom-3 h-px bg-border" />
        <div className="absolute bottom-0 h-8 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${position(median)}%` }} />
        {dots.map(({ value, stack }, index) => (
          <span
            key={index}
            tabIndex={0}
            className="group absolute size-3 -translate-x-1/2 rounded-full bg-accent ring-2 ring-surface outline-none"
            style={{ left: `${position(value)}%`, bottom: `${6 + stack * 14}px` }}
          >
            <Tooltip>{format(value)}</Tooltip>
          </span>
        ))}
      </div>
      <div className="relative h-5 text-xs tabular-nums text-muted">
        <span className="absolute left-0">{format(min)}</span>
        <span className="absolute -translate-x-1/2 font-medium text-foreground" style={{ left: `${position(median)}%` }}>
          median {format(median)}
        </span>
        <span className="absolute right-0">{format(max)}</span>
      </div>
    </div>
  );
}
