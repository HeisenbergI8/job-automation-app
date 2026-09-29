// ROADMAP 5.6: Telegram messages (decided 2026-09-29). Without TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHAT_ID the message is printed instead, which is how local runs work.
import { formatSalary } from "@/lib/jobs";
import { MIN_FIT, TOP, type Ranked } from "./scoring";

// How each source is named to the owner.
const SITE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn", jobstreet: "JobStreet", indeed: "Indeed", glassdoor: "Glassdoor",
  greenhouse: "company careers page", lever: "company careers page", ashby: "company careers page",
};

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (text: string) => (text.length > 200 ? `${text.slice(0, 199)}…` : text);

/**
 * The daily message: today's picks with score and link, then anything that went wrong. Says plainly
 * when fewer than TOP jobs (or none) out of the `checked` new postings reached MIN_FIT.
 */
export function batchMessage(saved: Ranked[], problems: string[], checked: number) {
  const belowBar = saved.length === 1 && saved[0].score < MIN_FIT;
  const heading = belowBar
    ? `<b>No new job scored ${MIN_FIT} or more today. Here's the closest of ${checked}:</b>`
    : saved.length >= TOP
      ? `<b>Today's top ${TOP} jobs</b>`
      : saved.length
        ? `<b>Only ${saved.length} of today's ${checked} new jobs scored ${MIN_FIT} or more</b>`
        : `<b>No new jobs today (${checked} checked).</b>`;
  const lines = [heading];
  // Nothing is applied automatically until stage 6 (auto-apply) exists.
  if (saved.length) lines.push("Not applied yet: open each link and apply, then mark it Applied in the app.");
  saved.forEach((job, index) => {
    lines.push(
      "",
      `${index + 1}. <a href="${escape(job.url)}">${escape(job.role)}</a> at ${escape(job.company)}`,
      `Fit ${job.score}/100 · ${escape(SITE_NAMES[job.site] ?? job.site)} · ${escape(job.location ?? "Location not stated")} · ${escape(formatSalary(job))}`,
      ...job.reasons.slice(0, 2).map((reason) => `• ${escape(short(reason))}`),
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
