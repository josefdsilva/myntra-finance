import {
  monthlyRateFromTaeg,
  monthlyRateFromNominalTan,
  scheduleSummary,
  applyOverpayment,
  type ScheduleSummary,
} from "@/lib/amortization";
import type { Database } from "@/integrations/supabase/types";
import type { RecomputeMode } from "@/lib/movements";

export type Debt = Database["public"]["Tables"]["debts"]["Row"];

/**
 * Bridges a stored `debts` row and the pure amortization engine. Debts store the
 * schedule anchor (principal at `last_recompute_at`); the live balance for today
 * is derived, so normal monthly installments advance the payoff automatically.
 */

/** Monthly rate for a debt — nominal TAN when available, else derived from TAEG. */
export function debtMonthlyRate(debt: Pick<Debt, "tan_pct" | "taeg_pct">): number {
  if (debt.tan_pct != null) return monthlyRateFromNominalTan(Number(debt.tan_pct));
  return monthlyRateFromTaeg(Number(debt.taeg_pct ?? 0));
}

/** The date the current schedule started (last overpayment, or loan open date). */
export function debtAnchorDate(debt: Debt): Date {
  return new Date(debt.last_recompute_at ?? debt.opened_at ?? debt.created_at);
}

/** Live payoff summary for the progress UI, evaluated at `today`. */
export function debtLiveSchedule(debt: Debt, today: Date = new Date()): ScheduleSummary {
  const anchorPrincipal = Number(debt.principal_remaining ?? debt.starting_principal ?? 0);
  const startingPrincipal = Number(debt.starting_principal ?? debt.principal_remaining ?? 0);
  return scheduleSummary({
    principal: anchorPrincipal,
    startingPrincipal,
    monthlyRate: debtMonthlyRate(debt),
    installment: Number(debt.monthly_amount ?? 0),
    anchorDate: debtAnchorDate(debt),
    today,
  });
}

export type OverpaymentPreview = {
  /** Live remaining balance just before the overpayment. */
  balanceBefore: number;
  /** Overpayment amount applied (clamped to the balance). */
  applied: number;
  /** New stored principal after the overpayment (pass to service_debt). */
  newPrincipal: number;
  /** New monthly installment (reduce_installment mode) or unchanged. */
  newInstallment: number;
  /** New payoff date (shorten_term mode) or unchanged. */
  newMaturity: Date;
  paidOff: boolean;
};

/**
 * Preview the effect of a lump-sum overpayment made at `asOf`, using the live
 * balance (not the stale stored anchor) as the starting point. Feed the result
 * into `serviceDebt(...)`.
 */
export function previewOverpayment(
  debt: Debt,
  amount: number,
  mode: RecomputeMode,
  asOf: Date = new Date(),
): OverpaymentPreview {
  const live = debtLiveSchedule(debt, asOf);
  const balanceBefore = live.remaining;
  const applied = Math.min(amount, balanceBefore);
  const r = debtMonthlyRate(debt);
  const maturity = debt.maturity_date
    ? new Date(debt.maturity_date)
    : (live.payoffDate ?? asOf);

  const result = applyOverpayment(
    { principal: balanceBefore, monthlyRate: r, installment: Number(debt.monthly_amount ?? 0), maturityDate: maturity },
    applied,
    mode,
    asOf,
  );

  return {
    balanceBefore,
    applied,
    newPrincipal: result.principal,
    newInstallment: result.installment,
    newMaturity: result.maturityDate,
    paidOff: result.paidOff,
  };
}
