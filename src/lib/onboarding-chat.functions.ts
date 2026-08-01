import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";

// Conversational onboarding: turn a free-text answer ("rent 800, netflix 12")
// into structured {label, monthly_amount} rows the client can confirm before
// writing. Deliberately extraction-only — no writes happen here, so the money
// stays under the user's control (confirm-before-save on the client).

const MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 45_000;

const TOPICS = ["income", "fixed", "variable", "debt"] as const;
type Topic = (typeof TOPICS)[number];

const RawList = z.object({
  items: z.array(z.object({ label: z.string(), monthly_amount: z.number() })),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const s = trimmed.indexOf("{");
    const e = trimmed.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(trimmed.slice(s, e + 1));
    return { items: [] };
  }
}

function normalize(items: unknown[]): Array<{ label: string; monthly_amount: number }> {
  const out: Array<{ label: string; monthly_amount: number }> = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 80) : "";
    let n: number | null = null;
    if (typeof r.monthly_amount === "number") n = r.monthly_amount;
    else if (typeof r.monthly_amount === "string")
      n = Number(r.monthly_amount.replace(/[^0-9.\-]/g, ""));
    if (!label || n === null || !Number.isFinite(n)) continue;
    const amount = Math.abs(n);
    if (amount <= 0) continue;
    out.push({ label, monthly_amount: amount });
  }
  return out;
}

const TOPIC_SYSTEM: Record<Topic, string> = {
  income:
    "Extract each source of income the person or business describes. Give each a short label and a MONTHLY amount.",
  fixed:
    "Extract recurring FIXED costs/bills (rent, utilities, subscriptions, insurance, salaries). Give each a short label and a MONTHLY amount.",
  variable:
    "Extract typical VARIABLE spending estimates (groceries, dining, fuel, materials). Give each a short label and a MONTHLY amount.",
  debt:
    "Extract debts, loans or financing, using the MONTHLY payment/instalment as the amount. Give each a short label and its MONTHLY payment.",
};

/** Extract structured {label, monthly_amount} rows from a free-text answer. */
export const extractSetupItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        topic: z.enum(TOPICS),
        text: z.string().min(1).max(2000),
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const system = `${TOPIC_SYSTEM[data.topic]}
Convert every amount to a MONTHLY figure in the user's currency: weekly ×4.33, fortnightly ×2.17, quarterly ÷3, yearly ÷12. Amounts are always positive numbers, no currency symbol.
Ignore anything that isn't one of these items. If there are none, return an empty list.
Shape: {"items":[{"label":string,"monthly_amount":number}]}`;

    let obj: { items?: unknown[] };
    let usage: unknown;
    try {
      const res = await generateObject({
        model: gateway(MODEL),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        schema: RawList,
        system,
        prompt: data.text,
      });
      obj = res.object as { items?: unknown[] };
      usage = res.usage;
    } catch {
      const res = await generateText({
        model: gateway(MODEL),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        system: `${system}\n\nRespond with ONLY valid minified JSON — no prose, no markdown.`,
        prompt: data.text,
      });
      obj = extractJson(res.text) as { items?: unknown[] };
      usage = res.usage;
    }

    if (data.householdId) {
      const est = estimateTextCredits(MODEL, usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_onboarding_chat",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
        meta: { topic: data.topic },
      });
    }

    return { items: normalize(Array.isArray(obj?.items) ? obj.items : []) };
  });
