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
  it("lists each pick with its score, link and top two reasons, escaped for Telegram HTML", () => {
    const text = batchMessage([job, job, job], [], 12);
    expect(text).toContain("<b>Today's top 3 jobs</b>");
    expect(text).toContain("Not applied yet: open each link and apply, then mark it Applied in the app.");
    expect(text).toContain('1. <a href="https://jobs.lever.co/acme/1">Frontend Engineer</a> at R&amp;D &lt;Labs&gt;');
    expect(text).toContain("Fit 86/100 · company careers page ·");
    expect(text).toContain("• Has 2 of 2 must-have keywords.");
    expect(text).not.toContain("• Remote.");
  });

  it("says plainly when fewer than three jobs reached the minimum score", () => {
    expect(batchMessage([job], [], 12)).toContain("<b>Only 1 of today's 12 new jobs scored 50 or more</b>");
  });

  it("labels the closest match when nothing reached the minimum score", () => {
    const text = batchMessage([{ ...job, site: "linkedin", score: 42 }], [], 40);
    expect(text).toContain("No new job scored 50 or more today. Here's the closest of 40:");
    expect(text).toContain("Fit 42/100 · LinkedIn ·");
  });

  it("says so when there are no new jobs at all, and lists problems", () => {
    const text = batchMessage([], ["acme (lever): Board not found. Check the link in Settings."], 0);
    expect(text).toContain("No new jobs today (0 checked).");
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
