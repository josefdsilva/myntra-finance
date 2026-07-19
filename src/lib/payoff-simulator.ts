import { addMonths } from "date-fns";
import { debtLiveSchedule, debtMonthlyRate, previewOverpayment, type Debt } from "@/lib/debt-schedule";
import type { RecomputeMode } from "@/lib/movements";


/**
 * Multi-loan payoff simulator.
 *
 * Simulates paying every loan month by month, using the household's real
 * scheduled installment for each debt. Any "extra" budget is directed at ONE
 * focus debt per month chosen by the strategy:
 *   - "avalanche": highest monthly rate first (mathematically optimal — least
 *     interest paid overall)
 *   - "snowball": smallest remaining balance first (quickest visible wins —
 *     easier to stick with)
 *
 * When the focus debt is paid off mid-month, its freed installment rolls into
 * the extra budget for the next focus debt (classic "debt snowball" rollover),
 * and any unused extra from the current payment carries over the same month.
 */

export type Strategy = "avalanche" | "snowball";

type LoanState = {
  id: string;
  label: string;
  monthlyRate: number;
  installment: number;
  balance: number;
  startingBalance: number;
  paidOffMonth: number | null;
  interestPaid: number;
};

export type PayoffPlan = {
  months: number;
  totalInterest: number;
  payoffDate: Date;
  /** Payoff month index per loan (0-based), null if not paid off in horizon. */
  perLoan: Array<{ id: string; label: string; paidOffMonth: number | null; interestPaid: number }>;
};

export type SimulationInput = {
  debts: Debt[];
  /** Extra €/month applied on top of scheduled installments. */
  extraPerMonth: number;
  strategy: Strategy;
  /** Safety cap; sane loans finish well under this. */
  horizonMonths?: number;
  today?: Date;
};

function initState(debts: Debt[], today: Date): LoanState[] {
  return debts
    .map<LoanState | null>((d) => {
      const s = debtLiveSchedule(d, today);
      if (s.paidOff || s.remaining <= 0) return null;
      const installment = Number(d.monthly_amount ?? 0);
      if (installment <= 0) return null;
      return {
        id: d.id,
        label: d.label,
        monthlyRate: debtMonthlyRate(d),
        installment,
        balance: s.remaining,
        startingBalance: s.remaining,
        paidOffMonth: null,
        interestPaid: 0,
      };
    })
    .filter((x): x is LoanState => x !== null);
}

function pickFocus(loans: LoanState[], strategy: Strategy): LoanState | null {
  const alive = loans.filter((l) => l.balance > 0);
  if (alive.length === 0) return null;
  if (strategy === "avalanche") {
    // Highest monthly rate first; break ties by smallest balance (finish sooner).
    return alive.reduce((a, b) =>
      b.monthlyRate > a.monthlyRate ||
      (b.monthlyRate === a.monthlyRate && b.balance < a.balance)
        ? b
        : a,
    );
  }
  // snowball — smallest balance first; break ties by highest rate.
  return alive.reduce((a, b) =>
    b.balance < a.balance || (b.balance === a.balance && b.monthlyRate > a.monthlyRate) ? b : a,
  );
}

export function simulatePayoff(input: SimulationInput): PayoffPlan {
  const today = input.today ?? new Date();
  const horizon = input.horizonMonths ?? 600;
  const loans = initState(input.debts, today);

  if (loans.length === 0) {
    return {
      months: 0,
      totalInterest: 0,
      payoffDate: today,
      perLoan: [],
    };
  }

  let month = 0;
  let freedInstallments = 0; // rolls into extra once a debt is cleared

  while (loans.some((l) => l.balance > 0) && month < horizon) {
    month += 1;

    // 1) Accrue interest on every live loan.
    for (const l of loans) {
      if (l.balance <= 0) continue;
      const interest = l.balance * l.monthlyRate;
      l.balance += interest;
      l.interestPaid += interest;
    }

    // 2) Apply each loan's scheduled installment (principal reduction after interest).
    for (const l of loans) {
      if (l.balance <= 0) continue;
      const pay = Math.min(l.installment, l.balance);
      l.balance -= pay;
      if (l.balance <= 0.005) {
        l.balance = 0;
        if (l.paidOffMonth === null) {
          l.paidOffMonth = month;
          freedInstallments += l.installment;
        }
      }
    }

    // 3) Apply the extra budget (user + freed installments) to the focus debt(s).
    let extra = input.extraPerMonth + freedInstallments;
    let guard = 0;
    while (extra > 0.005 && guard < 32) {
      const focus = pickFocus(loans, input.strategy);
      if (!focus) break;
      const pay = Math.min(extra, focus.balance);
      focus.balance -= pay;
      extra -= pay;
      if (focus.balance <= 0.005) {
        focus.balance = 0;
        if (focus.paidOffMonth === null) {
          focus.paidOffMonth = month;
          freedInstallments += focus.installment;
        }
      }
      guard += 1;
    }
  }

  const totalInterest =
    Math.round(loans.reduce((sum, l) => sum + l.interestPaid, 0) * 100) / 100;

  return {
    months: month,
    totalInterest,
    payoffDate: addMonths(today, month),
    perLoan: loans.map((l) => ({
      id: l.id,
      label: l.label,
      paidOffMonth: l.paidOffMonth,
      interestPaid: Math.round(l.interestPaid * 100) / 100,
    })),
  };
}

/** Order loans by the strategy's payoff priority (for display). */
export function payoffOrder(debts: Debt[], strategy: Strategy, today: Date = new Date()): Debt[] {
  const withState = debts
    .map((d) => ({ d, s: debtLiveSchedule(d, today), r: debtMonthlyRate(d) }))
    .filter((x) => !x.s.paidOff && x.s.remaining > 0 && Number(x.d.monthly_amount ?? 0) > 0);
  const sorted = [...withState].sort((a, b) => {
    if (strategy === "avalanche") return b.r - a.r || a.s.remaining - b.s.remaining;
    return a.s.remaining - b.s.remaining || b.r - a.r;
  });
  return sorted.map((x) => x.d);
}
