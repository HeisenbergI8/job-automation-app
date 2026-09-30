import { describe, expect, it } from "vitest";
import { formatFoundAt } from "./jobs";

// 2026-09-30 11:00 PM in Manila (UTC+8).
const NOW = new Date("2026-09-30T15:00:00Z");

describe("formatFoundAt", () => {
  it("shows the owner's clock, not UTC", () => {
    // 14:30 UTC is 10:30 PM in Manila.
    expect(formatFoundAt("2026-09-30T14:30:00Z", NOW)).toBe("Today, 10:30 PM");
  });

  it("uses the Manila calendar day for Today and Yesterday", () => {
    // 17:00 UTC on the 29th is 1:00 AM on the 30th in Manila: still today there.
    expect(formatFoundAt("2026-09-29T17:00:00Z", NOW)).toBe("Today, 1:00 AM");
    expect(formatFoundAt("2026-09-29T01:05:00Z", NOW)).toBe("Yesterday, 9:05 AM");
  });

  it("shows the date for older finds, and the year only when it differs", () => {
    expect(formatFoundAt("2026-09-27T14:30:00Z", NOW)).toBe("Sep 27, 10:30 PM");
    expect(formatFoundAt("2025-12-31T04:00:00Z", NOW)).toBe("Dec 31, 2025, 12:00 PM");
  });
});
