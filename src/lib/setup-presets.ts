// Onboarding estimate generator. Given the few things we ask (country,
// household size, monthly income, optional housing cost), it derives a starting
// budget — fixed costs and everyday spend split per category, plus a savings
// margin — from the bundled national benchmark data. Pure and deterministic so
// it's unit-testable and produces the same numbers as the "how you compare"
// screen later. Every row it emits is an estimate the user confirms or edits.
//
// Category keys are the 14 benchmark categories, which line up with the app's
// intent/housing logic (see intent.ts + metrics.ts HOUSING_CATEGORIES), so
// "housing" counts toward the housing-cost ratio and essentials classify right.

import { expectedCategorySpend, getCountryBenchmark } from "./benchmarks";
import { defaultIntentForCategory, type IntentLevel } from "./intent";

export type PresetFixedRow = { category: string; monthly_amount: number; intent: IntentLevel; estimated: boolean };
export type PresetVariableRow = { category: string; monthly_amount: number; estimated: boolean };

export type SetupPreset = {
  fixed: PresetFixedRow[];
  variable: PresetVariableRow[];
  /** Suggested savings margin (households.margin_pct), 0..100. */
  marginPct: number;
  quintile: number | null;
  expectedMonthlySpend: number | null;
  /** True when we had benchmark data and produced estimates. */
  estimated: boolean;
  /** Typical costs + a healthy savings rate don't fit the income — there's a
   * gap to close (earn more or spend less). Drives a dashboard tip. */
  gap: boolean;
};

/** Minimum savings margin we always suggest, even on a tight budget. */
const MARGIN_FLOOR_PCT = 3;

// Which benchmark categories are recurring FIXED costs; everything else is
// everyday VARIABLE spend.
const FIXED_CATEGORIES = new Set(["housing", "utilities", "subscriptions"]);

const EMPTY: SetupPreset = {
  fixed: [],
  variable: [],
  marginPct: 0,
  quintile: null,
  expectedMonthlySpend: null,
  estimated: false,
  gap: false,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function scaleRows(rows: Array<{ monthly_amount: number }>, factor: number): void {
  for (const r of rows) r.monthly_amount = Math.max(0, Math.round(r.monthly_amount * factor));
}

export function buildSetupPresets(params: {
  country: string | null | undefined;
  adults: number;
  children: number;
  monthlyIncome: number;
  /** Optional real housing cost (rent or mortgage payment) — overrides the estimate. */
  housingMonthly?: number | null;
  isBusiness?: boolean;
}): SetupPreset {
  const income = Math.max(0, Math.round(params.monthlyIncome || 0));
  // Business spaces have no per-category benchmark to copy; and with no income
  // there's nothing to scale. Either way, skip the preset (start empty).
  if (params.isBusiness || income <= 0) return { ...EMPTY };

  const est = expectedCategorySpend({
    country: params.country,
    adults: params.adults,
    children: params.children,
    monthlyIncome: income,
  });
  if (!est) return { ...EMPTY };

  const bench = getCountryBenchmark(params.country);
  const marginPctBase = clamp(Math.round(bench?.householdSavingRatePct ?? 10), 5, 20);

  // Split into fixed vs variable, applying the housing override when the user
  // told us their real rent/mortgage.
  const fixed: PresetFixedRow[] = [];
  const variable: PresetVariableRow[] = [];
  for (const [category, amount] of Object.entries(est.byCategory)) {
    let value = Math.max(0, Math.round(amount));
    if (category === "housing" && params.housingMonthly != null) {
      value = Math.max(0, Math.round(params.housingMonthly));
    }
    if (FIXED_CATEGORIES.has(category)) {
      // A housing figure the user actually typed is not an estimate.
      const userGiven = category === "housing" && params.housingMonthly != null;
      fixed.push({
        category,
        monthly_amount: value,
        intent: defaultIntentForCategory(category),
        estimated: !userGiven,
      });
    } else {
      variable.push({ category, monthly_amount: value, estimated: true });
    }
  }

  // ---- Fit to income: never overstate spend so day-one safe-to-spend can't go
  // negative — but always reserve a small savings floor. We keep at least a 3%
  // margin, scale everyday spend down to make room, and leave fixed costs for
  // the user to correct. When typical costs + a healthy margin don't fit, we
  // flag a `gap` so the dashboard can nudge earning more or spending less.
  const rawFixed = fixed.reduce((s, r) => s + r.monthly_amount, 0);
  const rawVariable = variable.reduce((s, r) => s + r.monthly_amount, 0);
  const desiredMargin = Math.round((income * marginPctBase) / 100);
  const floorMargin = Math.round((income * MARGIN_FLOOR_PCT) / 100);
  const gap = rawFixed + rawVariable + desiredMargin > income;

  let marginAmount: number;
  const available = income - rawFixed;
  if (available <= 0) {
    // Fixed alone meets/exceeds income — nothing left to allocate.
    marginAmount = 0;
    scaleRows(variable, 0);
  } else if (available <= floorMargin) {
    // Barely anything after fixed — reserve what little remains as savings.
    marginAmount = available;
    scaleRows(variable, 0);
  } else {
    const room = available - floorMargin; // space for everyday if we keep the floor
    if (rawVariable <= room) {
      // Everyday fits with the floor reserved; grow the margin toward the
      // healthy rate if there's still room.
      marginAmount = Math.max(floorMargin, Math.min(desiredMargin, available - rawVariable));
    } else {
      // Not enough for full everyday plus savings — keep the floor and scale
      // everyday spend down to fit.
      marginAmount = floorMargin;
      scaleRows(variable, room / rawVariable);
    }
  }

  const marginPct = clamp(Math.round((marginAmount / income) * 100), 0, 100);

  return {
    fixed: fixed.filter((r) => r.monthly_amount > 0),
    variable: variable.filter((r) => r.monthly_amount > 0),
    marginPct,
    quintile: est.quintile,
    expectedMonthlySpend: est.expectedMonthlySpend,
    estimated: true,
    gap,
  };
}
