/**
 * app/lib/llmCost.js
 *
 * Records what each Gemini call actually cost, per user.
 *
 * The agent route was already computing this — pulling usageMetadata, applying
 * the cached-token discount, producing an estimatedCostUsd — and then throwing
 * it into console.log. Every other AI route ignored usage entirely. So there was
 * no way to answer "which users cost me money" or "what is my per-user margin".
 *
 * Schema lives in docs/llm-usage.sql.
 */

import { createClient } from "@supabase/supabase-js";

export const DEFAULT_MODEL = "gemini-3-flash-preview";

/**
 * Per-token USD rates.
 *
 * These mirror the constants that were already inlined in /api/agent, so
 * recorded figures stay consistent with what has been logged historically.
 * They are the ONLY place pricing is encoded — re-check them against current
 * Google pricing whenever the model changes, since nothing here can detect a
 * price change on its own.
 */
const PRICING = {
  "gemini-3-flash-preview": {
    input: 0.000000075, //  $0.075 per 1M input tokens
    cached: 0.00000001875, // ~25% of input — Gemini's context-cache rate
    output: 0.0000003, //  $0.30  per 1M output tokens
  },
};

export function estimateCostUsd({
  model = DEFAULT_MODEL,
  inputTokens = 0,
  cachedTokens = 0,
  outputTokens = 0,
}) {
  const p = PRICING[model] || PRICING[DEFAULT_MODEL];
  // cachedContentTokenCount is a SUBSET of promptTokenCount, so bill the
  // remainder at full rate and only the cached portion at the discount.
  const uncached = Math.max(0, inputTokens - cachedTokens);
  return Number(
    (uncached * p.input + cachedTokens * p.cached + outputTokens * p.output).toFixed(6),
  );
}

/** Flatten Gemini's usageMetadata. Tolerates it being absent entirely. */
export function readUsage(usageMetadata) {
  const u = usageMetadata || {};
  const inputTokens = u.promptTokenCount ?? 0;
  const outputTokens = u.candidatesTokenCount ?? 0;
  return {
    inputTokens,
    outputTokens,
    cachedTokens: u.cachedContentTokenCount ?? 0,
    totalTokens: u.totalTokenCount ?? inputTokens + outputTokens,
  };
}

/**
 * Persist one call's usage.
 *
 * Deliberately awaitable rather than fire-and-forget: on serverless the runtime
 * can freeze the moment a response is returned, and an un-awaited insert would
 * silently vanish. Callers should await it — it's a single small insert.
 *
 * Never throws. Cost accounting must not be able to break a user-facing
 * feature.
 */
export async function recordLlmUsage({
  userId,
  route,
  model = DEFAULT_MODEL,
  usageMetadata,
  latencyMs = null,
  ok = true,
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const t = readUsage(usageMetadata);
    // Nothing to bill and nothing to learn from — skip the write.
    if (!t.totalTokens && ok) return;

    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from("llm_usage").insert({
      user_id: userId || null,
      route,
      model,
      input_tokens: t.inputTokens,
      cached_tokens: t.cachedTokens,
      output_tokens: t.outputTokens,
      total_tokens: t.totalTokens,
      cost_usd: estimateCostUsd({ model, ...t }),
      latency_ms: latencyMs,
      ok,
    });
    if (error) console.warn("[llmCost] insert failed:", error.message);
  } catch (err) {
    console.warn("[llmCost] failed:", err?.message);
  }
}
