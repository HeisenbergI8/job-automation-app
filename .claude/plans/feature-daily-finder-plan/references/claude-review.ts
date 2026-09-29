// Review of src/lib/claude.ts (35 lines), plus the header of src/lib/tailoring/generate.ts.
// The web app's Claude API client (paid API, ANTHROPIC_API_KEY) used by Stage 4 tailoring.

// IMPORTANT: server-only. The worker cannot import this file, or generate.ts, which imports it.
// Stage 5 scoring therefore has its own Scorer (Claude Code CLI) and does not reuse askForJson().
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const TAILORING_MODEL = "claude-opus-5-5";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// NOTE: decided by the owner on 2026-09-29: tailoring moves off the paid API to Claude Code on the
// subscription as part of Stage 6. Stage 5 leaves this file untouched (recorded in the plan's ROADMAP update, Step 8.4).
export async function askForJson<Schema extends z.ZodType>({ system, prompt, schema }) {
  const response = await client.messages.parse({
    model: TAILORING_MODEL,
    output_config: { effort: "high", format: zodOutputFormat(schema) },
    // ...
  });
  // ...
}

// src/lib/tailoring/generate.ts
// IMPORTANT: also server-only. extractKeywords() (which fills jobs.ats_keywords) is only callable from the web
// app, so the worker leaves ats_keywords null. Nothing in Stage 5 needs it.
import "server-only";
