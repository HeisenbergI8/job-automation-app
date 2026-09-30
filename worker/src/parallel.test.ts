import { describe, expect, it } from "vitest";
import { inParallel } from "./parallel";

describe("inParallel", () => {
  it("runs at most `limit` tasks at once and keeps the order", async () => {
    let running = 0;
    let most = 0;
    const results = await inParallel([30, 10, 20, 5, 15], 2, async (ms) => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running--;
      return ms * 2;
    });
    expect(results).toEqual([60, 20, 40, 10, 30]);
    expect(most).toBe(2);
  });

  it("handles no items", async () => {
    expect(await inParallel([], 4, async () => 1)).toEqual([]);
  });
});
