// ROADMAP 5.6: Telegram messages (decided 2026-09-29). Without TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHAT_ID the message is printed instead, which is how local runs work.
import { formatSalary } from "@/lib/jobs";
import { TOP, type Ranked } from "./scoring";

// How each source is named to the owner.
const SITE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn", jobstreet: "JobStreet", indeed: "Indeed", onlinejobs: "OnlineJobs.ph", glassdoor: "Glassdoor",
  greenhouse: "company careers page", lever: "company careers page", ashby: "company careers page",
};

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (text: string, max = 200) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
/** How much of the fit reason a daily pick shows. */
const FIT_LENGTH = 140;

/**
 * The daily message, kept short (owner, 2026-09-30): per job only the site, title, salary, score and
 * one line on why it fits. Fewer than TOP only when fewer new jobs than that were reviewed.
 */
export function batchMessage(saved: Ranked[], problems: string[], checked: number) {
  // Every job sent passed the full-posting check (verify.ts), so fewer than TOP means fewer passed.
  const heading =
    saved.length >= TOP
      ? `<b>Today's top ${TOP} jobs</b>`
      : saved.length
        ? `<b>Only ${saved.length} ${saved.length === 1 ? "job" : "jobs"} passed today's check</b>`
        : `<b>No jobs passed today's check (${checked} new checked).</b>`;
  const lines = [heading];
  saved.forEach((job, index) => {
    const salary = formatSalary(job);
    lines.push(
      "",
      `${index + 1}. <a href="${escape(job.url)}">${escape(job.role)}</a>`,
      `${escape(SITE_NAMES[job.site] ?? job.site)} · ${escape(salary === "—" ? "Salary not stated" : salary)} · <b>${job.score}/100</b>`,
      ...job.reasons.slice(0, 1).map((reason) => escape(short(reason, FIT_LENGTH))),
    );
  });
  if (problems.length) {
    lines.push("", "<b>Problems</b>", ...problems.slice(0, 10).map((problem) => `• ${escape(short(problem))}`));
  }
  return lines.join("\n");
}

export function needsManualMessage(job: { company: string; role: string; url: string }, note: string | null) {
  return [
    `<b>Needs you:</b> <a href="${escape(job.url)}">${escape(job.role)}</a> at ${escape(job.company)}`,
    escape(short(note ?? "Apply by hand with the link.")),
  ].join("\n");
}

/** Sends one message. Returns false (and prints it) when Telegram isn't set up. */
export async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.log(`[Telegram isn't set up; message below]\n${text}\n`);
    return false;
  }
  // The owner's connection to Telegram drops connections now and then (seen 2026-09-29), so a failed
  // connection is retried; a refusal from Telegram itself is not.
  let response: Response | undefined;
  for (let attempt = 1; !response; attempt++) {
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      // Never include the URL in the error: it contains the bot token.
      if (attempt === SEND_ATTEMPTS) throw new Error(`Couldn't reach Telegram after ${SEND_ATTEMPTS} tries.`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  if (!response.ok) throw new Error(`Telegram refused the message (${response.status}): ${await response.text()}`);
  return true;
}

const SEND_ATTEMPTS = 4;
let retryDelayMs = 5_000;
/** Tests only: skip the wait between retries. */
export const setRetryDelayForTests = (ms: number) => (retryDelayMs = ms);
