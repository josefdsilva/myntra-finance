import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const expenseInput = z.object({
  household_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  category: z.string().min(1).max(50),
  merchant: z.string().max(120).optional().nullable(),
  occurred_at: z.string().datetime().optional(),
  note: z.string().max(500).optional().nullable(),
  source: z.enum(["manual", "ai_memo", "ai_voice", "statement"]).default("manual"),
  source_meta: z.record(z.unknown()).optional(),
});

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => expenseInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("expenses")
      .insert({
        household_id: data.household_id,
        added_by_user_id: context.userId,
        amount: data.amount,
        category: data.category,
        merchant: data.merchant ?? null,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        note: data.note ?? null,
        source: data.source,
        source_meta: (data.source_meta ?? {}) as never,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const addExpensesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ items: z.array(expenseInput).min(1).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const rows = data.items.map((d) => ({
      household_id: d.household_id,
      added_by_user_id: context.userId,
      amount: d.amount,
      category: d.category,
      merchant: d.merchant ?? null,
      occurred_at: d.occurred_at ?? new Date().toISOString(),
      note: d.note ?? null,
      source: d.source,
      source_meta: (d.source_meta ?? {}) as never,
    }));
    const { data: inserted, error } = await context.supabase.from("expenses").insert(rows).select();
    if (error) throw error;
    return inserted;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Incomes ----
export const upsertIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        label: z.string().min(1).max(80),
        monthly_amount: z.number().min(0),
        owner_user_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("incomes")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("incomes")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("incomes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Fixed expenses ----
export const upsertFixedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        label: z.string().min(1).max(80),
        category: z.string().max(50).optional().nullable(),
        monthly_amount: z.number().min(0),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("fixed_expenses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("fixed_expenses")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteFixedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("fixed_expenses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Buckets ----
export const upsertBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        name: z.string().min(1).max(60),
        target_type: z.enum(["pct_surplus", "fixed_monthly", "fixed_yearly", "goal_by_date"]),
        target_value: z.number().min(0),
        target_deadline: z.string().date().nullable().optional(),
        color: z.string().max(20).optional().nullable(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("buckets")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("buckets")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("buckets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
