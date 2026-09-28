import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// ROADMAP 4.1: tailoring runs on Claude Opus 5.5 (owner's choice: quality over cost; about three
// jobs a day). Server-side only: ANTHROPIC_API_KEY must never reach the browser.
export const TAILORING_MODEL = "claude-opus-5-5";

const client = new Anthropic();

/** One structured-output request. Throws if Claude declines or the answer doesn't parse. */
export async function askForJson<Schema extends z.ZodType>({
  system,
  prompt,
  schema,
}: {
  system: string;
  prompt: string;
  schema: Schema;
}): Promise<z.infer<Schema>> {
  const response = await client.messages.parse({
    model: TAILORING_MODEL,
    max_tokens: 16000,
    // Opus 5.5 always thinks; effort is the only dial and its default is medium.
    output_config: { effort: "high", format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off.");
  if (!response.parsed_output) throw new Error("Claude's answer didn't match the expected format.");
  return response.parsed_output;
}
