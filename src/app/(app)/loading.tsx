import { ScanMark } from "./scan-mark";

// Shown the moment a page is clicked, while its data loads. The layout reads no request data, so
// Next can prefetch this and swap it in at once instead of freezing on the old page.
export default function Loading() {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <ScanMark />
      <span className="text-sm text-muted">Loading…</span>
    </div>
  );
}
