import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { batchMessage, needsManualMessage, sendTelegram, setRetryDelayForTests } from "./notify";
import type { Ranked } from "./scoring";

const job: Ranked = {
  site: "lever",
  url: "https://jobs.lever.co/acme/1",
  company: "R&D <Labs>",
  role: "Frontend Engineer",
  location: "Remote",
  description: "",
  salary_min: 120000,
  salary_max: 150000,
  salary_currency: "USD",
  salary_raw: null,
  remote: true,
  score: 86,
  reasons: ["Title matches.", "Has 2 of 2 must-have keywords.", "Remote."],
  scoredBy: "claude-code",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("batchMessage", () => {
  it("lists each pick with site, salary, score, link and one fit reason, escaped for Telegram HTML", () => {
    const text = batchMessage([{ ...job, role: "R&D <Engineer>" }, job, job], [], 12);
    expect(text).toContain("<b>Today's top 3 jobs</b>");
    expect(text).toContain('1. <a href="https://jobs.lever.co/acme/1">R&amp;D &lt;Engineer&gt;</a>\n');
    expect(text).toContain("company careers page · USD 120K–150K · <b>86/100</b>\nTitle matches.");
    expect(text).not.toContain("Labs");
    expect(text).not.toContain("Has 2 of 2");
    expect(text).not.toContain("Not applied yet");
  });

  it("says when no salary is stated and shortens a long reason", () => {
    const text = batchMessage([{ ...job, salary_min: null, salary_max: null, reasons: ["x".repeat(300)] }], [], 5);
    expect(text).toContain("· Salary not stated ·");
    expect(text).toContain(`${"x".repeat(139)}…`);
  });

  it("says plainly when fewer than three jobs reached the minimum score", () => {
    expect(batchMessage([job], [], 12)).toContain("<b>1 of today's 12 new jobs scored 80+</b>");
  });

  it("says so when nothing reached the minimum score, and lists problems", () => {
    const text = batchMessage([], ["acme (lever): Board not found. Check the link in Settings."], 40);
    expect(text).toContain("No new job scored 80+ today (40 checked).");
    expect(text).toContain("<b>Problems</b>\n• acme (lever): Board not found.");
  });
});

describe("needsManualMessage", () => {
  it("links the job", () => {
    expect(needsManualMessage(job, "CAPTCHA on the form")).toBe(
      '<b>Needs you:</b> <a href="https://jobs.lever.co/acme/1">Frontend Engineer</a> at R&amp;D &lt;Labs&gt;\nCAPTCHA on the form',
    );
  });
});

describe("sendTelegram", () => {
  it("prints instead of sending when Telegram isn't set up", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await sendTelegram("hi")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts to the bot's sendMessage with HTML parse mode", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendTelegram("hi")).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "42", text: "hi", parse_mode: "HTML" });
  });

  describe("on a flaky connection", () => {
    beforeEach(() => {
      setRetryDelayForTests(0);
      vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
      vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    });

    it("retries a dropped connection", async () => {
      const fetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(Response.json({ ok: true }));
      vi.stubGlobal("fetch", fetch);
      expect(await sendTelegram("hi")).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("gives up after four tries, without the token in the error", async () => {
      const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
      vi.stubGlobal("fetch", fetch);
      await expect(sendTelegram("hi")).rejects.toThrow("Couldn't reach Telegram after 4 tries.");
      await expect(sendTelegram("hi")).rejects.not.toThrow("123:abc");
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    it("doesn't retry when Telegram itself refuses", async () => {
      const fetch = vi.fn(async () => new Response("chat not found", { status: 400 }));
      vi.stubGlobal("fetch", fetch);
      await expect(sendTelegram("hi")).rejects.toThrow("Telegram refused the message (400)");
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
