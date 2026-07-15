import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";
import { CATEGORIES } from "./statement-import";

const MODEL = "google/gemini-3-flash-preview";
const CATEGORY_LIST = CATEGORIES.join(", ");
const VALID = new Set<string>(CATEGORIES);

function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("AI response was not valid JSON: " + text.slice(0, 200));
  }
}

/**
 * Categorize distinct unknown merchant strings. Checks the household's learned
 * `merchant_rules` cache first (free); only cache misses go to the AI in one
 * batched call, and the results are written back to the cache so future imports
 * are free. Cost scales with *new* merchants, not transaction count.
 */
export const categorizeMerchants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        merchants: z.array(z.string().min(1).max(120)).min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const unique = Array.from(new Set(data.merchants.map((m) => m.trim()).filter(Boolean)));

    // 1. Cache lookup (learned mappings).
    const { data: cached } = await context.supabase
      .from("merchant_rules")
      .select("merchant_key, category")
      .eq("household_id", data.householdId)
      .in("merchant_key", unique);
    const map: Record<string, string> = {};
    for (const r of cached ?? []) map[r.merchant_key] = r.category;

    const misses = unique.filter((m) => !(m in map));
    if (misses.length === 0) return { map, aiUsed: 0 };

    // 2. AI categorize the misses in one batched call.
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: `You categorize bank-statement merchant names into household expense categories.
Use EXACTLY one category from this list: ${CATEGORY_LIST}.
Respond ONLY with JSON of shape {"map":{"<merchant>":"<category>", ...}}, using each provided
merchant string VERBATIM as the key. If unsure, use "other". No prose, no markdown fences.`,
      prompt: JSON.stringify(misses),
    });
    const parsed = z.object({ map: z.record(z.string()) }).parse(extractJson(result.text));

    const learned: Array<{
      household_id: string;
      merchant_key: string;
      category: string;
      source: string;
    }> = [];
    for (const m of misses) {
      const guess = parsed.map[m];
      const cat = guess && VALID.has(guess) ? guess : "other";
      map[m] = cat;
      learned.push({ household_id: data.householdId, merchant_key: m, category: cat, source: "ai" });
    }

    // 3. Persist to the learning cache.
    if (learned.length) {
      await context.supabase
        .from("merchant_rules")
        .upsert(learned, { onConflict: "household_id,merchant_key" });
    }

    // 4. Meter credits.
    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId: context.userId,
      operation: "statement_categorize",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
      meta: { merchants: misses.length },
    });

    return { map, aiUsed: misses.length };
  });

/** Persist a user's category correction so future imports respect it. */
export const saveMerchantRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        merchant: z.string().min(1).max(120),
        category: z.enum(CATEGORIES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("merchant_rules").upsert(
      {
        household_id: data.householdId,
        merchant_key: data.merchant.trim(),
        category: data.category,
        source: "user",
      },
      { onConflict: "household_id,merchant_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

const labelKey = (s: string) => s.trim().toLowerCase();

/**
 * Write the user-approved candidates into Settings. Matches existing rows by
 * label (case-insensitive) so re-imports UPDATE rather than duplicate — this is
 * what powers the "review any time" flow (e.g. rent 800 → 850). Debts are only
 * inserted when new, so an existing debt's schedule/rate isn't clobbered.
 */
export const applyStatementImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        fileName: z.string().max(200).nullable().optional(),
        fixed: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              monthly_amount: z.number().min(0),
              category: z.string().max(50).nullable().optional(),
            }),
          )
          .default([]),
        variable: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              category: z.string().max(50).nullable().optional(),
              monthly_amount: z.number().min(0),
            }),
          )
          .default([]),
        incomes: z
          .array(z.object({ label: z.string().min(1).max(80), monthly_amount: z.number().min(0) }))
          .default([]),
        debts: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              monthly_amount: z.number().min(0),
              kind: z.string().max(30).optional(),
            }),
          )
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const hh = data.householdId;
    const sb = context.supabase;
    const summary = {
      fixed: { inserted: 0, updated: 0 },
      variable: { inserted: 0, updated: 0 },
      incomes: { inserted: 0, updated: 0 },
      debts: { inserted: 0, skipped: 0 },
    };

    // Fixed expenses — upsert by label.
    {
      const { data: existing } = await sb
        .from("fixed_expenses")
        .select("id, label")
        .eq("household_id", hh);
      const byLabel = new Map((existing ?? []).map((r) => [labelKey(r.label), r.id]));
      for (const row of data.fixed) {
        const id = byLabel.get(labelKey(row.label));
        const payload = {
          label: row.label,
          monthly_amount: row.monthly_amount,
          category: row.category ?? null,
        };
        if (id) {
          const { error } = await sb.from("fixed_expenses").update(payload).eq("id", id);
          if (error) throw error;
          summary.fixed.updated += 1;
        } else {
          const { error } = await sb.from("fixed_expenses").insert({ household_id: hh, ...payload });
          if (error) throw error;
          summary.fixed.inserted += 1;
        }
      }
    }

    // Variable estimates — upsert by label.
    {
      const { data: existing } = await sb
        .from("variable_estimates")
        .select("id, label")
        .eq("household_id", hh);
      const byLabel = new Map((existing ?? []).map((r) => [labelKey(r.label), r.id]));
      for (const row of data.variable) {
        const id = byLabel.get(labelKey(row.label));
        const payload = {
          label: row.label,
          monthly_amount: row.monthly_amount,
          category: row.category ?? null,
        };
        if (id) {
          const { error } = await sb.from("variable_estimates").update(payload).eq("id", id);
          if (error) throw error;
          summary.variable.updated += 1;
        } else {
          const { error } = await sb
            .from("variable_estimates")
            .insert({ household_id: hh, ...payload });
          if (error) throw error;
          summary.variable.inserted += 1;
        }
      }
    }

    // Incomes — upsert by label.
    {
      const { data: existing } = await sb.from("incomes").select("id, label").eq("household_id", hh);
      const byLabel = new Map((existing ?? []).map((r) => [labelKey(r.label), r.id]));
      for (const row of data.incomes) {
        const id = byLabel.get(labelKey(row.label));
        const payload = { label: row.label, monthly_amount: row.monthly_amount };
        if (id) {
          const { error } = await sb.from("incomes").update(payload).eq("id", id);
          if (error) throw error;
          summary.incomes.updated += 1;
        } else {
          const { error } = await sb.from("incomes").insert({ household_id: hh, ...payload });
          if (error) throw error;
          summary.incomes.inserted += 1;
        }
      }
    }

    // Debts — insert only when new (never overwrite an existing debt's schedule).
    {
      const { data: existing } = await sb.from("debts").select("label").eq("household_id", hh);
      const seen = new Set((existing ?? []).map((r) => labelKey(r.label)));
      for (const row of data.debts) {
        if (seen.has(labelKey(row.label))) {
          summary.debts.skipped += 1;
          continue;
        }
        const { error } = await sb.from("debts").insert({
          household_id: hh,
          label: row.label,
          monthly_amount: row.monthly_amount,
          kind: row.kind ?? "other",
        });
        if (error) throw error;
        summary.debts.inserted += 1;
      }
    }

    // Audit trail.
    await sb.from("bank_imports").insert({
      household_id: hh,
      file_name: data.fileName ?? null,
      status: "approved",
      uploaded_by: context.userId,
      raw_extract: JSON.parse(JSON.stringify(summary)),
    });

    return summary;
  });

/**
 * AI fallback for mapping statement columns when the deterministic header
 * heuristic fails on an unfamiliar bank layout. Returns 0-based column indexes.
 */
export const inferStatementColumnsAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid().optional(),
        headers: z.array(z.string()).min(1).max(40),
        sampleRows: z.array(z.array(z.string())).max(5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: `You map bank-statement CSV columns. Given the header row and a few sample rows,
return the 0-based column indexes for: date, description, and EITHER a single signed "amount"
column OR separate "debit"/"credit" columns.
Respond ONLY with JSON: {"date":number,"description":number,"amount"?:number,"debit"?:number,"credit"?:number}.
No prose, no markdown.`,
      prompt: JSON.stringify({ headers: data.headers, sampleRows: data.sampleRows ?? [] }),
    });
    const parsed = z
      .object({
        date: z.number().int().min(0),
        description: z.number().int().min(0),
        amount: z.number().int().min(0).optional(),
        debit: z.number().int().min(0).optional(),
        credit: z.number().int().min(0).optional(),
      })
      .parse(extractJson(result.text));

    if (data.householdId) {
      const est = estimateTextCredits(MODEL, result.usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "statement_infer_columns",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
      });
    }
    return parsed;
  });
