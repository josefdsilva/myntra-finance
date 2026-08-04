import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRunway, resolveCashOnHand, type RunwayResult } from "@/lib/runway";
import { ageReceivables, type ReceivablePlan, type ReceivablesResult } from "@/lib/receivables";
import { sumMonthly } from "@/lib/finance-helpers";

// Shared gathering of the SME runway + receivables picture. Takes any supabase
// client so both the authed server fn (RLS-scoped) and the cron (service role)
// can reuse it. The pure math lives in runway.ts / receivables.ts.

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

export async function gatherRunwayReceivables(
  sb: SupabaseClient,
  hid: string,
): Promise<RunwayReceivables> {
  const [{ data: hhRow }, { data: assets }, { data: incomes }, { data: fixed }, { data: debts }, { data: plans }] =
    await Promise.all([
      sb.from("households").select("*").eq("id", hid).single(),
      sb
        .from("assets")
        .select("current_value, liquidity")
        .eq("household_id", hid)
        .eq("liquidity", "liquid"),
      sb.from("incomes").select("monthly_amount").eq("household_id", hid),
      sb.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      sb.from("debts").select("monthly_amount").eq("household_id", hid),
      sb
        .from("plans")
        .select("id, label, amount, month, recurrence, done")
        .eq("household_id", hid)
        .eq("direction", "income")
        .eq("done", false),
    ]);

  const hh = (hhRow ?? {}) as Record<string, unknown>;
  const currency = (hh.currency as string) || "EUR";
  const baseline = Number(hh.baseline_budget ?? 0);
  const override = hh.cash_on_hand_override == null ? null : Number(hh.cash_on_hand_override);
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
}
