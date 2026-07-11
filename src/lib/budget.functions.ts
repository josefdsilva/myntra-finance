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
  source: z.enum(["manual", "ai_memo", "ai_voice", "ai_photo", "statement"]).default("manual"),
  source_meta: z.record(z.unknown()).optional(),
  kind: z.enum(["expense", "income"]).default("expense"),
  is_salary: z.boolean().optional().default(false),
  labels: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
});


function normalizeLabels(labels: string[] | undefined | null): string[] {
  if (!labels?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const s = String(raw ?? "").trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

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
        kind: data.kind,
        is_salary: data.kind === "income" ? !!data.is_salary : false,
        labels: normalizeLabels(data.labels),
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
      kind: d.kind,
      is_salary: d.kind === "income" ? !!d.is_salary : false,
      labels: normalizeLabels(d.labels),

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

// Mark a salary as received — starts a new pay cycle without treating salary as a manual expense entry.
export const markSalaryReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        amount: z.number().positive().max(10_000_000).optional(),
        occurred_at: z.string().datetime().optional(),
        note: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let amount = data.amount;
    if (amount == null) {
      const { data: incs, error: incErr } = await context.supabase
        .from("incomes")
        .select("monthly_amount")
        .eq("household_id", data.household_id);
      if (incErr) throw incErr;
      amount = (incs ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    }
    if (!amount || amount <= 0) {
      throw new Error("No salary amount configured. Add a monthly income in Settings first.");
    }
    const { data: row, error } = await context.supabase
      .from("expenses")
      .insert({
        household_id: data.household_id,
        added_by_user_id: context.userId,
        amount,
        category: "income",
        merchant: "Salary",
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        note: data.note ?? "Salary received — cycle start",
        source: "manual",
        source_meta: {} as never,
        kind: "income",
        is_salary: true,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
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

// ---- Variable estimates ----
export const upsertVariableEstimate = createServerFn({ method: "POST" })
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
        .from("variable_estimates")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("variable_estimates")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteVariableEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("variable_estimates").delete().eq("id", data.id);
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

// ---- Debts ----
export const upsertDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        label: z.string().min(1).max(80),
        kind: z
          .enum(["mortgage", "personal", "auto", "credit_card", "student", "other"])
          .default("other"),
        monthly_amount: z.number().min(0),
        taeg_pct: z.number().min(0).max(100).nullable().optional(),
        principal_remaining: z.number().min(0).nullable().optional(),
        maturity_date: z.string().date().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("debts")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("debts")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("debts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
