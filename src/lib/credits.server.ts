/**
 * Per-household credit accounting. Called from server functions after each AI/Cloud op.
 * Rates are approximations aligned with the Lovable AI Gateway pricing observed
 * for this project. They are conservative on the higher side so users don't
 * blow past their cap silently.
 */

// Credits per token (rough, based on observed Gemini 3 Flash gateway rates)
const RATES = {
  "google/gemini-3-flash-preview": {
    input: 0.0000015, // ~ $0.30/M tokens, 1 credit ≈ $0.20
    output: 0.0000125, // ~ $2.50/M tokens
  },
  "openai/gpt-4o-mini-transcribe": {
    // billed per audio-second; approximate 0.005 credits per call
    fixed: 0.005,
  },
} as const;

export function estimateTextCredits(
  model: keyof typeof RATES,
  usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number },
): { credits: number; input: number; output: number } {
  const rate = RATES[model] as { input?: number; output?: number };
  const input = usage?.inputTokens ?? usage?.promptTokens ?? 0;
  const output = usage?.outputTokens ?? usage?.completionTokens ?? 0;
  const credits = (input * (rate.input ?? 0)) + (output * (rate.output ?? 0));
  // Floor at a small minimum so completely-unknown usage still leaves a trace
  return { credits: Math.max(credits, 0.001), input, output };
}

export function estimateTranscribeCredits(): { credits: number } {
  return { credits: (RATES["openai/gpt-4o-mini-transcribe"] as { fixed: number }).fixed };
}

export async function logHouseholdCredits(input: {
  householdId: string;
  userId?: string | null;
  operation: string;
  credits: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("credit_usage").insert({
      household_id: input.householdId,
      user_id: input.userId ?? null,
      operation: input.operation,
      credits: Number(input.credits.toFixed(6)),
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      meta: input.meta ?? {},
    });
  } catch (err) {
    // Never let accounting failure break the user-facing operation
    console.error("[credit-usage] log failed", err);
  }
}
