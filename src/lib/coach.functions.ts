import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { computeCycle } from "@/lib/cycle";
import {
  createLovableAiGatewayProvider,
  requireLovableApiKey,
} from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";

const MODEL = "google/gemini-3-flash-preview";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CoachContext = {
  today: string;
  currency: string;
  baseline: number;
  marginPct: number;
  cycle: {
    source: string;
    start: string;
    end: string;
    daysTotal: number;
    daysLeft: number;
    predicted: boolean;
  };
  fixedMonthly: number;
  variableEstimateMonthly: number;
  cycleTotals: {
    spent: number;
    received: number;
    net: number;
    byCategory: Record<string, number>;
  };
  previousCycleTotals: {
    spent: number;
    received: number;
    net: number;
  } | null;
  buckets: Array<{
    name: string;
    target_type: string;
    target_value: number;
    target_deadline: string | null;
    allocatedThisCycle: number;
  }>;
  topSpends: Array<{ amount: number; category: string; note: string | null; occurred_at: string }>;
  cycleStartKey: string; // yyyy-mm-dd for cache
};

async function buildContext(
  supabase: any,
  householdId: string,
): Promise<CoachContext> {
  const { data: hh } = await supabase
    .from("households")
    .select("currency, baseline_budget, margin_pct")
    .eq("id", householdId)
    .maybeSingle();

  const { data: salaryRows = [] } = await supabase
    .from("expenses")
    .select("occurred_at")
    .eq("household_id", householdId)
    .eq("is_salary", true)
    .order("occurred_at", { ascending: false })
    .limit(6);

  const salaryDatesDesc = (salaryRows ?? []).map((r: any) => r.occurred_at as string);
  const cycle = computeCycle(salaryDatesDesc);

  // Previous cycle bounds
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  if (salaryDatesDesc.length >= 2) {
    prevEnd = new Date(salaryDatesDesc[0]);
    prevStart = new Date(salaryDatesDesc[1]);
  }

  const startISO = cycle.start.toISOString();
  const endISO = cycle.end.toISOString();

  const { data: cycleExp = [] } = await supabase
    .from("expenses")
    .select("amount, category, kind, note, occurred_at")
    .eq("household_id", householdId)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO);

  let previousCycleTotals: CoachContext["previousCycleTotals"] = null;
  if (prevStart && prevEnd) {
    const { data: prevExp = [] } = await supabase
      .from("expenses")
      .select("amount, kind, category")
      .eq("household_id", householdId)
      .gte("occurred_at", prevStart.toISOString())
      .lt("occurred_at", prevEnd.toISOString());
    let s = 0, r = 0;
    for (const e of prevExp ?? []) {
      const a = Number(e.amount);
      if (e.kind === "income") r += a;
      else s += a;
    }
    previousCycleTotals = { spent: s, received: r, net: s - r };
  }

  const [{ data: fixed = [] }, { data: varEst = [] }, { data: buckets = [] }, { data: allocs = [] }] =
    await Promise.all([
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
      supabase.from("variable_estimates").select("monthly_amount").eq("household_id", householdId),
      supabase.from("buckets").select("id, name, target_type, target_value, target_deadline").eq("household_id", householdId),
      supabase.from("bucket_allocations").select("bucket_id, amount, confirmed_at")
        .eq("household_id", householdId).gte("confirmed_at", startISO).lt("confirmed_at", endISO),
    ]);

  const fixedMonthly = (fixed ?? []).reduce((s: number, r: any) => s + Number(r.monthly_amount), 0);
  const variableEstimateMonthly = (varEst ?? []).reduce((s: number, r: any) => s + Number(r.monthly_amount), 0);

  const allocByBucket: Record<string, number> = {};
  for (const a of allocs ?? []) {
    allocByBucket[a.bucket_id] = (allocByBucket[a.bucket_id] ?? 0) + Number(a.amount);
  }

  let spent = 0, received = 0;
  const byCategory: Record<string, number> = {};
  const spendsForTop: Array<{ amount: number; category: string; note: string | null; occurred_at: string }> = [];
  for (const e of cycleExp ?? []) {
    const a = Number(e.amount);
    if (e.kind === "income") received += a;
    else {
      spent += a;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + a;
      spendsForTop.push({ amount: a, category: e.category, note: e.note, occurred_at: e.occurred_at });
    }
  }
  spendsForTop.sort((a, b) => b.amount - a.amount);

  return {
    today: new Date().toISOString(),
    currency: hh?.currency ?? "EUR",
    baseline: Number(hh?.baseline_budget ?? 0),
    marginPct: Number(hh?.margin_pct ?? 0),
    cycle: {
      source: cycle.source,
      start: cycle.start.toISOString(),
      end: cycle.end.toISOString(),
      daysTotal: cycle.daysTotal,
      daysLeft: cycle.daysLeft,
      predicted: cycle.predicted,
    },
    fixedMonthly,
    variableEstimateMonthly,
    cycleTotals: { spent, received, net: spent - received, byCategory },
    previousCycleTotals,
    buckets: (buckets ?? []).map((b: any) => ({
      name: b.name,
      target_type: b.target_type,
      target_value: Number(b.target_value),
      target_deadline: b.target_deadline,
      allocatedThisCycle: allocByBucket[b.id] ?? 0,
    })),
    topSpends: spendsForTop.slice(0, 8),
    cycleStartKey: cycle.start.toISOString().slice(0, 10),
  };
}

const SYSTEM_BASE = `You are a warm, concise household financial coach for a family of four in Portugal. Currency EUR.
You give practical, non-judgmental guidance based ONLY on the JSON snapshot the user provides.
Never invent figures — if data is missing say so.
Format money as €X,XXX.XX. Keep answers short, skimmable, and grounded in the data.`;

const OVERVIEW_PROMPT = `Write a friendly financial overview in markdown with these sections:
### What's going well
2–4 short bullets grounded in the numbers.
### Watch outs
2–4 short bullets — categories overspending vs estimate, buckets falling behind, low days-left runway, etc.
### Recommendations
3 concrete, actionable suggestions for the rest of this cycle.
Keep the whole thing under ~220 words. No preamble.`;

/** Get cached overview or generate. Pass refresh=true to force regenerate. */
export const generateOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ householdId: z.string().uuid(), refresh: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify membership
    const { data: mem } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", data.householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) throw new Error("Not a member of this household");

    const ctx = await buildContext(supabase, data.householdId);

    // Cache check
    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("analysis_overviews")
        .select("content, generated_at, model")
        .eq("household_id", data.householdId)
        .eq("cycle_start", ctx.cycleStartKey)
        .maybeSingle();
      if (cached) {
        const age = Date.now() - new Date(cached.generated_at).getTime();
        if (age < CACHE_TTL_MS) {
          return {
            content: cached.content as string,
            generated_at: cached.generated_at as string,
            model: cached.model as string | null,
            cached: true,
          };
        }
      }
    }

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: SYSTEM_BASE,
      prompt: `Household snapshot (JSON):\n${JSON.stringify(ctx)}\n\n${OVERVIEW_PROMPT}`,
    });

    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: "ai_coach_overview",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    // Upsert via admin (RLS blocks writes from client role)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const generated_at = new Date().toISOString();
    await supabaseAdmin
      .from("analysis_overviews")
      .upsert({
        household_id: data.householdId,
        cycle_start: ctx.cycleStartKey,
        content: result.text,
        model: MODEL,
        generated_at,
      });

    return { content: result.text, generated_at, model: MODEL, cached: false };
  });

const ChatMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

/** Ephemeral chat with the coach. Rebuilds context each call (cheap). */
export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        history: z.array(ChatMsg).max(20),
        message: z.string().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", data.householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) throw new Error("Not a member of this household");

    const ctx = await buildContext(supabase, data.householdId);

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: `${SYSTEM_BASE}

Current household snapshot (JSON, always fresh):
${JSON.stringify(ctx)}

Answer the user's questions grounded in this snapshot. Be brief (usually 2–5 sentences). Use markdown when helpful.`,
      messages: [
        ...data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: data.message },
      ],
    });

    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: "ai_coach_chat",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    return { reply: result.text };
  });
