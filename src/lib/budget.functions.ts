import { createServerFn } from "@tanstack/react-start";
import { differenceInCalendarMonths } from "date-fns";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { impliedAnnualRate } from "@/lib/amortization";
import { CADENCES, monthlyEquivalent } from "@/lib/cadence";
import { z } from "zod";

const expenseInput = z.object({
  household_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  category: z.string().min(1).max(50),
  merchant: z.string().max(120).optional().nullable(),
  occurred_at: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }),
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

// Mark a specific recurring income as received for the current cycle. Records a
// money-in receipt linked back to that income (income_id) so a cycle can show
// which expected inflows have arrived. Only the cycle-anchor income's receipt
// is flagged is_salary — i.e. only it rolls an event-mode cycle; other incomes
// (a partner's pay, rent) are recorded as money-in without starting a new cycle.
export const markIncomeReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        income_id: z.string().uuid(),
        amount: z.number().positive().max(10_000_000).optional(),
        occurred_at: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const [{ data: income, error: incErr }, { data: hh }] = await Promise.all([
      context.supabase
        .from("incomes")
        .select("id, label, native_amount, monthly_amount, type")
        .eq("id", data.income_id)
        .eq("household_id", data.household_id)
        .maybeSingle(),
      context.supabase
        .from("households")
        .select("cycle_anchor_income_id")
        .eq("id", data.household_id)
        .maybeSingle(),
    ]);
    if (incErr) throw incErr;
    if (!income) throw new Error("Income not found for this household.");

    const amount = data.amount ?? Number(income.native_amount ?? income.monthly_amount);
    if (!amount || amount <= 0) {
      throw new Error("This income has no amount set.");
    }

    // The anchor income rolls the cycle. With no explicit anchor, the primary
    // salary (type 'salary') plays that role, matching today's default.
    const anchorId = hh?.cycle_anchor_income_id ?? null;
    const isAnchor = anchorId ? anchorId === income.id : income.type === "salary";

    const { data: row, error } = await context.supabase
      .from("expenses")
      .insert({
        household_id: data.household_id,
        added_by_user_id: context.userId,
        amount,
        category: "income",
        merchant: income.label,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        note: null,
        source: "manual",
        source_meta: {} as never,
        kind: "income",
        is_salary: isAnchor,
        income_id: income.id,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// Mark a recurring fixed cost as settled this cycle (payables checklist). This
// is a pure tracking overlay — it does NOT change the baseline or "actual out",
// which keep treating fixed costs as assumptions, so nothing is double-counted.
export const markFixedExpensePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        fixed_expense_id: z.string().uuid(),
        amount: z.number().positive().max(10_000_000).optional(),
        occurred_at: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: fx, error: fxErr } = await context.supabase
      .from("fixed_expenses")
      .select("id, native_amount, monthly_amount")
      .eq("id", data.fixed_expense_id)
      .eq("household_id", data.household_id)
      .maybeSingle();
    if (fxErr) throw fxErr;
    if (!fx) throw new Error("Fixed cost not found for this household.");

    const amount = data.amount ?? Number(fx.native_amount ?? fx.monthly_amount) || 0;
    const { data: row, error } = await context.supabase
      .from("fixed_expense_settlements")
      .insert({
        household_id: data.household_id,
        fixed_expense_id: data.fixed_expense_id,
        amount,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// Undo a fixed-cost settlement (removes it from the payables checklist).
export const unmarkFixedExpensePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ settlement_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("fixed_expense_settlements")
      .delete()
      .eq("id", data.settlement_id);
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
        // Either monthly_amount (legacy callers) or native_amount + cadence.
        monthly_amount: z.number().min(0).optional(),
        native_amount: z.number().min(0).optional(),
        cadence: z.enum(CADENCES).optional(),
        type: z
          .enum([
            "salary",
            "rent",
            "pension",
            "benefits",
            "services",
            "sales",
            "subscriptions",
            "interest",
            "grants",
            "other",
          ])
          .optional(),
        owner_user_id: z.string().uuid().nullable().optional(),
      })
      .refine((d) => d.monthly_amount != null || d.native_amount != null, {
        message: "amount required",
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, native_amount, cadence, monthly_amount, ...rest } = data;
    const cad = cadence ?? "monthly";
    // native_amount is the figure at the chosen cadence; monthly_amount is the
    // canonical monthly-equivalent all budget math reads. Legacy callers send
    // only monthly_amount (implicitly monthly), so native falls back to it.
    const native = native_amount ?? monthly_amount ?? 0;
    const payload = {
      ...rest,
      cadence: cad,
      native_amount: native,
      monthly_amount: monthlyEquivalent(native, cad),
    };
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
        monthly_amount: z.number().min(0).optional(),
        native_amount: z.number().min(0).optional(),
        cadence: z.enum(CADENCES).optional(),
      })
      .refine((d) => d.monthly_amount != null || d.native_amount != null, {
        message: "amount required",
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, native_amount, cadence, monthly_amount, ...rest } = data;
    const cad = cadence ?? "monthly";
    const native = native_amount ?? monthly_amount ?? 0;
    const payload = {
      ...rest,
      cadence: cad,
      native_amount: native,
      monthly_amount: monthlyEquivalent(native, cad),
    };
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

/**
 * Set the estimate for a whole category to a figure the user chose (their actual
 * spend this cycle). Replaces every estimate row for that category with a single
 * one, so the category's estimate becomes exactly the adopted amount. This is the
 * "learn from reality" action behind the estimate-vs-actual view.
 */
export const adoptCategoryEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        category: z.string().min(1).max(50),
        label: z.string().min(1).max(80),
        monthly_amount: z.number().min(0).max(10_000_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    await sb
      .from("variable_estimates")
      .delete()
      .eq("household_id", data.household_id)
      .eq("category", data.category);
    const { error } = await sb.from("variable_estimates").insert({
      household_id: data.household_id,
      label: data.label,
      category: data.category,
      monthly_amount: data.monthly_amount,
    });
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
        initial_balance: z.number().min(0).optional(),
        kind: z.enum(["savings", "emergency", "investment"]).optional(),
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
        // Balance owed today (optional override). When a start date + original
        // amount are given without this, the balance is derived from the schedule.
        principal_remaining: z.number().min(0).nullable().optional(),
        // Original amount borrowed — the progress-bar denominator.
        starting_principal: z.number().min(0).nullable().optional(),
        // The date the loan started, so past progress can be reconstructed.
        opened_at: z.string().date().nullable().optional(),
        maturity_date: z.string().date().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...payload } = data;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // --- Decide the schedule anchor -----------------------------------------
    // "Historical" path: the user gave the original amount and the start date but
    // no explicit balance-today. Anchor to the start date with the original
    // principal, so the projection reconstructs today's balance and progress.
    // Otherwise anchor to today: a known balance-today (or the simple path where
    // that balance is all we have) starts the schedule from now.
    const origPrincipal = payload.starting_principal ?? null;
    const balanceToday = payload.principal_remaining ?? null;
    const openedAt = payload.opened_at ?? null;
    const historical = origPrincipal != null && openedAt != null && balanceToday == null;

    const anchorDateStr = historical ? openedAt! : todayStr;
    const anchorPrincipal = historical ? origPrincipal : (balanceToday ?? origPrincipal);
    const startingPrincipal = origPrincipal ?? balanceToday;
    const openedAtStore = openedAt ?? todayStr;

    // Deduce the annual effective rate from the anchor principal + monthly +
    // (anchor → maturity). Null when the inputs can't amortize.
    let deduced_rate_pct: number | null = null;
    if (payload.maturity_date && anchorPrincipal && payload.monthly_amount > 0) {
      const term = differenceInCalendarMonths(new Date(payload.maturity_date), new Date(anchorDateStr));
      if (term > 0) deduced_rate_pct = impliedAnnualRate(anchorPrincipal, payload.monthly_amount, term);
    }

    if (id) {
      // Edits re-anchor to today against the (possibly updated) balance.
      const editDeduced =
        payload.maturity_date && balanceToday && payload.monthly_amount > 0
          ? impliedAnnualRate(
              balanceToday,
              payload.monthly_amount,
              differenceInCalendarMonths(new Date(payload.maturity_date), today),
            )
          : null;
      const { data: row, error } = await context.supabase
        .from("debts")
        .update({ ...payload, deduced_rate_pct: editDeduced, last_recompute_at: todayStr })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("debts")
      .insert({
        // Explicit anchor fields below intentionally override the raw payload.
        ...payload,
        deduced_rate_pct,
        principal_remaining: anchorPrincipal,
        starting_principal: startingPrincipal,
        opened_at: openedAtStore,
        last_recompute_at: anchorDateStr,
      })
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
