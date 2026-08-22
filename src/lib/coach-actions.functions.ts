import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";
import { ACTION_KINDS, normalizeActions } from "./coach-actions";
import { COACH_ACTION_SYSTEM, extractActionJson } from "./coach-actions.server";

/**
 * Turn one free-text chat message into proposed actions. Extraction only — the
 * client confirms every row before any write happens.
 */
export const parseCoachActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        text: z.string().min(1).max(1000),
        today: z.string().min(4).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: cats } = await context.supabase
      .from("expense_categories")
      .select("name")
      .eq("household_id", data.householdId);
    const categories = (cats ?? []).map((c) => (c as { name: string }).name);

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const system = COACH_ACTION_SYSTEM(categories, data.today ?? new Date().toISOString().slice(0, 10));
    const schema = z.object({
      actions: z.array(
        z.object({
          kind: z.enum(ACTION_KINDS),
          label: z.string(),
          amount: z.number(),
          category: z.string().nullable().optional(),
          taeg_pct: z.number().nullable().optional(),
          occurred_at: z.string().nullable().optional(),
        }),
      ),
    });

    let parsed: { actions?: unknown };
    let usage: unknown;
    try {
      const res = await generateObject({
        model: gateway("google/gemini-3-flash-preview"),
        abortSignal: AbortSignal.timeout(45_000),
        schema,
        system,
        prompt: data.text,
      });
      parsed = res.object as { actions?: unknown };
      usage = res.usage;
    } catch {
      const res = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        abortSignal: AbortSignal.timeout(45_000),
        system: `${system}\n\nRespond with ONLY valid minified JSON — no prose, no markdown.`,
        prompt: data.text,
      });
      parsed = extractActionJson(res.text);
      usage = res.usage;
    }

    const est = estimateTextCredits("google/gemini-3-flash-preview", usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId: context.userId,
      operation: "ai_coach_actions",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
      meta: {},
    });

    return { actions: normalizeActions(parsed?.actions, categories), categories };
  });
