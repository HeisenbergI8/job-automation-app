// ROADMAP 5.6: Telegram messages (decided 2026-09-29). Without TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHAT_ID the message is printed instead, which is how local runs work.
import { formatSalary } from "@/lib/jobs";
import { MIN_FIT, TOP, type Ranked } from "./scoring";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (text: string) => (text.length > 200 ? `${text.slice(0, 199)}…` : text);

/**
 * The daily message: today's picks with score and link, then anything that went wrong. Says plainly
 * when fewer than TOP jobs (or none) out of the `checked` new postings reached MIN_FIT.
 */
export function batchMessage(saved: Ranked[], problems: string[], checked: number) {
  const heading =
    saved.length >= TOP
      ? `<b>Today's top ${TOP} jobs</b>`
      : saved.length
        ? `<b>Only ${saved.length} of today's ${checked} new jobs scored ${MIN_FIT} or more</b>`
        : `<b>No jobs today: none of the ${checked} new jobs scored ${MIN_FIT} or more.</b>`;
  const lines = [heading];
  saved.forEach((job, index) => {
    lines.push(
      "",
      `${index + 1}. <a href="${escape(job.url)}">${escape(job.role)}</a> at ${escape(job.company)}`,
      `Fit ${job.score}/100 · ${escape(job.location ?? "Location not stated")} · ${escape(formatSalary(job))}`,
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
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(30_000),
  });
  // Never include the URL in the error: it contains the bot token.
  if (!response.ok) throw new Error(`Telegram refused the message (${response.status}): ${await response.text()}`);
  return true;
}
