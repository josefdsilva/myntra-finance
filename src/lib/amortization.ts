import { addMonths, differenceInCalendarMonths } from "date-fns";

/**
 * Loan amortization engine — pure, deterministic, dependency-light.
 *
 * All core functions take a MONTHLY rate `r` (a fraction, e.g. 0.005 for 0.5%/mo)
 * so they are agnostic to how that rate was derived (effective TAEG vs nominal
 * TAN). Use the `monthlyRateFromTaeg` / `monthlyRateFromNominalTan` helpers at
 * the call site to pick a convention.
 *
 * Amounts are plain numbers in the household currency. Rounding to cents is done
 * only where a value is surfaced, not inside intermediate math.
 */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Effective monthly rate from an effective annual rate (TAEG), given as a percent. */
export function monthlyRateFromTaeg(taegPct: number): number {
  return Math.pow(1 + taegPct / 100, 1 / 12) - 1;
}

/** Monthly rate from a nominal annual rate (TAN), given as a percent. */
export function monthlyRateFromNominalTan(tanPct: number): number {
  return tanPct / 100 / 12;
}

/** Standard amortizing installment for principal P, monthly rate r, over n months. */
export function installmentFor(P: number, r: number, n: number): number {
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Remaining term in months for a principal P at monthly rate r paid with a fixed
 * `installment`. Returns null when the installment never amortizes the loan
 * (installment <= interest accrued each period).
 */
export function termMonthsFor(P: number, r: number, installment: number): number | null {
  if (P <= 0 || installment <= 0) return null;
  if (r === 0) return P / installment;
  const inside = 1 - (P * r) / installment;
  if (inside <= 0) return null; // installment <= monthly interest → never amortizes
  return -Math.log(inside) / Math.log(1 + r);
}

/** Remaining balance after k scheduled payments (k need not be an integer). */
export function balanceAfter(P: number, r: number, installment: number, k: number): number {
  if (k <= 0) return P;
  if (r === 0) return Math.max(0, P - installment * k);
  const g = Math.pow(1 + r, k);
  return Math.max(0, P * g - installment * ((g - 1) / r));
}

export type ScheduleInput = {
  /** Balance at `anchorDate` (the current schedule's principal). */
  principal: number;
  /** Monthly rate as a fraction. */
  monthlyRate: number;
  /** Fixed monthly installment. */
  installment: number;
  /** Start of the current schedule (loan open date, or last overpayment date). */
  anchorDate: Date;
  /** Point to evaluate at (usually today). */
  today: Date;
  /** Original principal — the progress-bar denominator. */
  startingPrincipal: number;
};

export type ScheduleSummary = {
  /** Live remaining balance at `today`. */
  remaining: number;
  /** Total principal paid off since the loan opened. */
  paidPrincipal: number;
  /** 0–100. */
  progressPct: number;
  /** Projected payoff date, or null if the installment never amortizes. */
  payoffDate: Date | null;
  /** Interest still to be paid from `today` to payoff (approximate). */
  totalInterestRemaining: number;
  /** Whole scheduled payments elapsed since `anchorDate`. */
  monthsElapsed: number;
  paidOff: boolean;
};

/** Everything the debt progress UI needs, derived analytically from the schedule. */
export function scheduleSummary(input: ScheduleInput): ScheduleSummary {
  const { principal, monthlyRate: r, installment, anchorDate, today, startingPrincipal } = input;

  const nTotal = termMonthsFor(principal, r, installment); // months from anchor to payoff
  const elapsed = Math.max(0, differenceInCalendarMonths(today, anchorDate));
  const k = nTotal === null ? elapsed : Math.min(elapsed, Math.floor(nTotal));

  const remaining = round2(balanceAfter(principal, r, installment, k));
  const paidPrincipal = round2(Math.max(0, startingPrincipal - remaining));
  const progressPct =
    startingPrincipal > 0
      ? Math.min(100, Math.max(0, (paidPrincipal / startingPrincipal) * 100))
      : 0;

  const payoffDate = nTotal === null ? null : addMonths(anchorDate, Math.ceil(nTotal));
  const totalInterestRemaining =
    nTotal === null ? 0 : round2(Math.max(0, installment * (nTotal - k) - remaining));

  return {
    remaining,
    paidPrincipal,
    progressPct,
    payoffDate,
    totalInterestRemaining,
    monthsElapsed: k,
    paidOff: remaining <= 0,
  };
}

export type DebtScheduleState = {
  /** Current balance (as of `asOf`). */
  principal: number;
  /** Monthly rate as a fraction. */
  monthlyRate: number;
  installment: number;
  /** Current scheduled payoff date. */
  maturityDate: Date;
};

export type OverpaymentResult = {
  principal: number;
  installment: number;
  maturityDate: Date;
  paidOff: boolean;
};

/**
 * Apply a lump-sum overpayment (100% to principal), then recompute the schedule.
 *  - `reduce_installment`: keep the remaining term, lower the monthly payment.
 *  - `shorten_term`: keep the monthly payment, bring the payoff date forward.
 * `asOf` is the date the overpayment is made (anchor for the new schedule).
 */
export function applyOverpayment(
  state: DebtScheduleState,
  amount: number,
  mode: "reduce_installment" | "shorten_term",
  asOf: Date,
): OverpaymentResult {
  const r = state.monthlyRate;
  const newPrincipal = round2(state.principal - amount);

  if (newPrincipal <= 0) {
    return { principal: 0, installment: 0, maturityDate: asOf, paidOff: true };
  }

  if (mode === "reduce_installment") {
    // Keep the remaining term measured from the pre-overpayment schedule.
    const nRemaining = termMonthsFor(state.principal, r, state.installment);
    const term = nRemaining ?? Math.max(1, differenceInCalendarMonths(state.maturityDate, asOf));
    return {
      principal: newPrincipal,
      installment: round2(installmentFor(newPrincipal, r, term)),
      maturityDate: state.maturityDate,
      paidOff: false,
    };
  }

  // shorten_term: keep the installment, solve for the new (shorter) term.
  const nNew = termMonthsFor(newPrincipal, r, state.installment);
  const maturityDate = nNew === null ? state.maturityDate : addMonths(asOf, Math.ceil(nNew));
  return {
    principal: newPrincipal,
    installment: state.installment,
    maturityDate,
    paidOff: false,
  };
}

/**
 * Solve for the annual EFFECTIVE rate implied by a principal, a fixed monthly
 * installment, and a term — i.e. the rate that makes those three consistent.
 * There is no closed form, so this bisects on the monthly rate.
 *
 * Returns the annual effective rate as a percent (e.g. 5.25), or null when no
 * non-negative rate can amortize the principal over the term (the installment is
 * lower than principal / term, so total payments fall short of the principal).
 */
export function impliedAnnualRate(
  principal: number,
  installment: number,
  termMonths: number,
): number | null {
  if (principal <= 0 || installment <= 0 || termMonths <= 0) return null;

  const zeroRateInstallment = principal / termMonths;
  if (installment < zeroRateInstallment - 1e-9) return null; // can't amortize, even at 0%
  if (Math.abs(installment - zeroRateInstallment) < 1e-9) return 0;

  const f = (r: number) => installmentFor(principal, r, termMonths) - installment;

  // Bracket the root: installmentFor is increasing in r.
  let lo = 0;
  let hi = 0.02; // ~26.8% annual effective, a sane starting ceiling
  let guard = 0;
  while (f(hi) < 0 && hi < 1 && guard < 64) {
    hi *= 2;
    guard += 1;
  }
  if (f(hi) < 0) return null; // rate absurdly high — treat as unsolvable

  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (Math.abs(v) < 1e-7) {
      lo = mid;
      hi = mid;
      break;
    }
    if (v < 0) lo = mid;
    else hi = mid;
  }
  const r = (lo + hi) / 2;
  const annualEffectivePct = (Math.pow(1 + r, 12) - 1) * 100;
  return Math.round(annualEffectivePct * 10000) / 10000; // 4 dp
}

/**
 * Derive the missing field at debt-creation time. Given principal + monthly rate
 * and exactly one of { term months, installment }, compute the other.
 */
export function reconcileDebtInputs(params: {
  principal: number;
  monthlyRate: number;
  termMonths?: number;
  installment?: number;
}): { termMonths: number; installment: number } | null {
  const { principal, monthlyRate: r, termMonths, installment } = params;
  if (termMonths != null) {
    return { termMonths, installment: round2(installmentFor(principal, r, termMonths)) };
  }
  if (installment != null) {
    const n = termMonthsFor(principal, r, installment);
    if (n === null) return null;
    return { termMonths: Math.ceil(n), installment };
  }
  return null;
}
