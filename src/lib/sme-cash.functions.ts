import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeRunway, resolveCashOnHand, type RunwayResult } from "@/lib/runway";
import { ageReceivables, type ReceivablePlan, type ReceivablesResult } from "@/lib/receivables";

export type RunwayReceivables = {
  currency: string;
  cashOnHand: number;
  override: number | null;
  overrideAt: string | null;
  computedCash: number;
  monthlyIncome: number;
  monthlyOutgoings: number;
  runway: RunwayResult;
  receivables: ReceivablesResult;
};

const sumMonthly = (rows: Array<{ monthly_amount: number | string }> | null) =>
  (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

/** Everything the SME runway + receivables card needs, computed server-side. */
export const getRunwayReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<RunwayReceivables> => {
    const hid = data.household_id;

    const [{ data: hhRow }, { data: assets }, { data: incomes }, { data: fixed }, { data: debts }, { data: plans }] =
      await Promise.all([
        context.supabase.from("households").select("*").eq("id", hid).single(),
        context.supabase
          .from("assets")
          .select("current_value, liquidity")
          .eq("household_id", hid)
          .eq("liquidity", "liquid"),
        context.supabase.from("incomes").select("monthly_amount").eq("household_id", hid),
        context.supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
        context.supabase.from("debts").select("monthly_amount").eq("household_id", hid),
        context.supabase
          .from("plans")
          .select("id, label, amount, month, recurrence, done")
          .eq("household_id", hid)
          .eq("direction", "income")
          .eq("done", false),
      ]);

    const hh = (hhRow ?? {}) as Record<string, unknown>;
    const currency = (hh.currency as string) || "EUR";
    const baseline = Number(hh.baseline_budget ?? 0);
    const override =
      hh.cash_on_hand_override == null ? null : Number(hh.cash_on_hand_override);
    const overrideAt = (hh.cash_on_hand_override_at as string | null) ?? null;

    const computedCash = ((assets as Array<{ current_value: number | string }> | null) ?? []).reduce(
      (s, a) => s + Number(a.current_value),
      0,
    );
    const cashOnHand = resolveCashOnHand({ override, computed: computedCash });

    const monthlyIncome = sumMonthly(incomes as Array<{ monthly_amount: number | string }> | null);
    const fixedTotal =
      sumMonthly(fixed as Array<{ monthly_amount: number | string }> | null) +
      sumMonthly(debts as Array<{ monthly_amount: number | string }> | null);
    // Outgoings include variable spend when a baseline is set (baseline already
    // rolls fixed + debt + variable + margin together); otherwise fall back to
    // just the recurring commitments.
    const monthlyOutgoings = Math.max(baseline, fixedTotal);

    const runway = computeRunway({ cashOnHand, monthlyOutgoings, monthlyIncome });

    const receivablePlans: ReceivablePlan[] = (
      (plans as Array<Record<string, unknown>> | null) ?? []
    ).map((p) => ({
      id: String(p.id),
      label: String(p.label ?? ""),
      amount: Number(p.amount) || 0,
      month: String(p.month),
      recurrence: String(p.recurrence ?? "one_off"),
      done: Boolean(p.done),
    }));
    const receivables = ageReceivables(receivablePlans, new Date());

    return {
      currency,
      cashOnHand,
      override,
      overrideAt,
      computedCash,
      monthlyIncome,
      monthlyOutgoings,
      runway,
      receivables,
    };
  });

/** Set or clear the manual cash-on-hand override for a space. */
export const setCashOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        amount: z.number().min(0).max(1_000_000_000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("households")
      .update({
        cash_on_hand_override: data.amount,
        cash_on_hand_override_at: data.amount == null ? null : new Date().toISOString(),
      } as never)
      .eq("id", data.household_id);
    if (error) throw error;
    return { ok: true };
  });
