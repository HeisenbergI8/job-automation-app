import { describe, expect, it } from "vitest";
import { finderState, type FinderRequest, type FinderRun } from "./finder";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

function run(patch: Partial<FinderRun> = {}): FinderRun {
  return {
    id: "run-1",
    started_at: ago(120),
    finished_at: null,
    ok: null,
    stage: "scoring",
    fetched: 0,
    new_postings: 0,
    scored: 0,
    saved: 0,
    errors: [],
    ...patch,
  };
}
const request = (patch: Partial<FinderRequest> = {}): FinderRequest => ({
  id: "req-1",
  requested_at: ago(10),
  picked_up_at: null,
  run_id: null,
  ...patch,
});

describe("finderState", () => {
  it("waits for the Mac, and says so once it is slow", () => {
    expect(finderState(request(), null, null, NOW)).toEqual({ kind: "waiting", since: ago(10), slow: false });
    expect(finderState(request({ requested_at: ago(120) }), null, null, NOW)).toMatchObject({ kind: "waiting", slow: true });
  });

  it("is starting between pickup and the run row", () => {
    expect(finderState(request({ picked_up_at: ago(5) }), null, null, NOW)).toMatchObject({ kind: "starting" });
  });

  it("follows the requested run while it runs", () => {
    const current = run();
    expect(finderState(request({ picked_up_at: ago(100), run_id: "run-1" }), current, current, NOW)).toEqual({ kind: "running", run: current });
  });

  it("shows a scheduled run in progress without any press", () => {
    const scheduled = run({ id: "run-2" });
    expect(finderState(null, null, scheduled, NOW)).toEqual({ kind: "running", run: scheduled });
  });

  it("treats a run silent for 45 minutes as dead", () => {
    const dead = run({ started_at: ago(46 * 60) });
    expect(finderState(null, null, dead, NOW)).toEqual({ kind: "idle", lastRun: null });
  });

  it("reports the result of a press for 15 minutes, then goes idle", () => {
    const finished = run({ ok: true, stage: null, finished_at: ago(60), saved: 3 });
    const pressed = request({ picked_up_at: ago(300), run_id: "run-1" });
    expect(finderState(pressed, finished, finished, NOW)).toEqual({ kind: "done", run: finished });
    const old = run({ ok: true, finished_at: ago(16 * 60) });
    expect(finderState(pressed, old, old, NOW)).toEqual({ kind: "idle", lastRun: old });
  });

  it("reports a failed run", () => {
    const failed = run({ ok: false, stage: null, finished_at: ago(30), errors: ["Gmail: login failed"] });
    expect(finderState(request({ picked_up_at: ago(200), run_id: "run-1" }), failed, failed, NOW)).toEqual({ kind: "failed", run: failed });
  });

  it("shows a scheduled run's result as the last run, not as a press result", () => {
    const scheduled = run({ ok: true, finished_at: ago(60) });
    expect(finderState(null, null, scheduled, NOW)).toEqual({ kind: "idle", lastRun: scheduled });
  });
});
