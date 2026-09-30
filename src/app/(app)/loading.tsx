// Shown the moment a page is clicked, while its data loads. The layout reads no request data, so
// Next can prefetch this and swap it in at once instead of freezing on the old page.
export default function Loading() {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <span aria-hidden="true" className="flex w-11 flex-col gap-[5px]">
        {["w-full", "w-[72%]", "w-[86%]"].map((width, index) => (
          <span
            key={width}
            className={`block h-[7px] origin-left rounded-full bg-accent ${width} animate-[scan-row_1.1s_cubic-bezier(0.5,0,0.2,1)_infinite]`}
            style={{ animationDelay: `${[0, 0.12, 0.22][index]}s` }}
          />
        ))}
      </span>
      <span className="text-sm text-muted">Loading…</span>
    </div>
  );
}
