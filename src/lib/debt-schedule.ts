import { differenceInCalendarMonths } from "date-fns";
import {
  monthlyRateFromTaeg,
  monthlyRateFromNominalTan,
  installmentFor,
  impliedAnnualRate,
  scheduleSummary,
  applyOverpayment,
  type ScheduleSummary,
} from "@/lib/amortization";
import type { Database } from "@/integrations/supabase/types";
import type { RecomputeMode } from "@/lib/movements";

export type Debt = Database["public"]["Tables"]["debts"]["Row"];

/**
 * Bridges a stored `debts` row and the pure amortization engine.
 *
 * The rate actually used for every calculation is the DEDUCED rate — the annual
 * effective rate solved so that principal + monthly + maturity are mutually
 * consistent (see `computeDeducedRate`). The user-entered `taeg_pct` is only a
 * reference estimate. When no deduced rate is stored yet, we fall back to
 * tan_pct, then taeg_pct, and derive a maturity-consistent installment.
 */

/** Monthly rate for a debt — deduced rate first, then nominal TAN, then TAEG. */
export function debtMonthlyRate(
  debt: Pick<Debt, "tan_pct" | "taeg_pct" | "deduced_rate_pct">,
): number {
  if (debt.deduced_rate_pct != null) return monthlyRateFromTaeg(Number(debt.deduced_rate_pct));
  if (debt.tan_pct != null) return monthlyRateFromNominalTan(Number(debt.tan_pct));
  return monthlyRateFromTaeg(Number(debt.taeg_pct ?? 0));
}

/** The date the current schedule started (last overpayment, or loan open date). */
export function debtAnchorDate(debt: Debt): Date {
  return new Date(debt.last_recompute_at ?? debt.opened_at ?? debt.created_at);
}

/**
 * Solve the annual effective rate implied by the current principal, monthly
 * payment, and maturity — the "deduced rate". Returns null when there's no
 * maturity or the inputs can't amortize (payments fall short of the principal).
 * `anchor` defaults to now: on a Settings save the schedule is re-anchored to
 * today, so the rate reflects paying the remaining principal off by maturity.
 */
export function computeDeducedRate(
  debt: Pick<Debt, "principal_remaining" | "starting_principal" | "monthly_amount" | "maturity_date">,
  anchor: Date = new Date(),
): number | null {
  if (!debt.maturity_date) return null;
  const principal = Number(debt.principal_remaining ?? debt.starting_principal ?? 0);
  const monthly = Number(debt.monthly_amount ?? 0);
  if (principal <= 0 || monthly <= 0) return null;
  const term = differenceInCalendarMonths(new Date(debt.maturity_date), anchor);
  if (term <= 0) return null;
  return impliedAnnualRate(principal, monthly, term);
}

/**
 * The installment that drives the schedule. With a deduced rate present, the
 * stored monthly payment is already consistent with the maturity, so use it
 * directly. Otherwise derive an installment that clears the principal by the
 * user's maturity (keeps payoff correct for legacy rows).
 */
function scheduleInstallment(debt: Debt, principal: number, monthlyRate: number, anchor: Date): number {
  if (debt.deduced_rate_pct != null) return Number(debt.monthly_amount ?? 0);
  if (debt.maturity_date) {
    const term = differenceInCalendarMonths(new Date(debt.maturity_date), anchor);
    if (term > 0) {
      const derived = installmentFor(principal, monthlyRate, term);
      if (derived > 0) return derived;
    }
  }
  return Number(debt.monthly_amount ?? 0);
}

/** Live payoff summary for the progress UI, evaluated at `today`. */
export function debtLiveSchedule(debt: Debt, today: Date = new Date()): ScheduleSummary {
  const anchorPrincipal = Number(debt.principal_remaining ?? debt.starting_principal ?? 0);
  const startingPrincipal = Number(debt.starting_principal ?? debt.principal_remaining ?? 0);
  const r = debtMonthlyRate(debt);
  const anchor = debtAnchorDate(debt);
  const installment = scheduleInstallment(debt, anchorPrincipal, r, anchor);
  const summary = scheduleSummary({
    principal: anchorPrincipal,
    startingPrincipal,
    monthlyRate: r,
    installment,
    anchorDate: anchor,
    today,
  });
  // Honor the user-defined maturity as the payoff date when present.
  if (debt.maturity_date && !summary.paidOff) {
    return { ...summary, payoffDate: new Date(debt.maturity_date) };
  }
  return summary;
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
  const anchor = debtAnchorDate(debt);
  const anchorPrincipal = Number(debt.principal_remaining ?? debt.starting_principal ?? 0);
  const installment = scheduleInstallment(debt, anchorPrincipal, r, anchor);
  const maturity = debt.maturity_date ? new Date(debt.maturity_date) : (live.payoffDate ?? asOf);

  const result = applyOverpayment(
    { principal: balanceBefore, monthlyRate: r, installment, maturityDate: maturity },
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
