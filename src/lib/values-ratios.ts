/**
 * Values ratios — "is the money going where the household says it wants to go?"
 *
 * The journey asks households for their purpose and values. These ratios turn
 * that answer into numbers that can be tracked cycle over cycle:
 *
 *  1. Alignment ratio      aligned flexible spend / all flexible spend
 *  2. Drift ratio          off-values flexible spend / income
 *  3. Dream-funding ratio  money moved into value-serving buckets / income
 *  4. Drift per dream euro for every €1 sent to the dreams, €X went elsewhere
 *  5. Redirect gain        months a dream arrives sooner if half the drift moved
 *
 * Everything is pure so it can be unit-tested and reused by the coach.
 */

import {
  alignmentSummary,
  matchValue,
  type AlignmentSummary,
  type HouseholdValue,
} from "@/lib/values";

export type RatioBucket = {
  id: string;
  name: string;
  /** Bucket kind ("savings" | "emergency" | "investment"), when known. */
  kind?: string | null;
  /** Target amount, when the bucket has one. */
  target?: number | null;
  /** Current balance (initial funds + everything allocated so far). */
  balance: number;
  /** Amount allocated to this bucket in the current cycle. */
  fundedThisCycle: number;
  /** Average monthly funding pace, when history exists. */
  monthlyPace?: number | null;
};

export type RedirectGain = {
  bucketId: string;
  bucketName: string;
  /** Amount we suggest redirecting (half the drift, rounded down to euros). */
  redirect: number;
  remaining: number;
  monthsNow: number | null;
  monthsAfter: number | null;
  monthsSaved: number;
};

export type ValuesGrade = "unset" | "on_course" | "drifting" | "off_course";

export type ValuesRatios = {
  unset: boolean;
  align: AlignmentSummary;
  income: number;
  /** Aligned share of flexible spend, 0-100. */
  alignmentPct: number;
  /** Off-values flexible spend as a share of income, 0-100. */
  driftPct: number;
  /** Off-values flexible spend, absolute. */
  drift: number;
  /** Money moved into value-serving buckets this cycle. */
  dreamFunded: number;
  /** Dream funding as a share of income, 0-100. */
  dreamFundingPct: number;
  /** Total money moved into any bucket this cycle. */
  savedTotal: number;
  /** For every €1 to the dreams, €X drifted elsewhere. null when nothing funded. */
  driftPerDreamEuro: number | null;
  /** The single best swap available right now. */
  redirect: RedirectGain | null;
  /** Change in alignment ratio vs the previous cycle, in points. */
  trendPts: number | null;
  grade: ValuesGrade;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lowercase and strip accents so "Óscar" matches "Oscar". */
const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Does this bucket serve one of the household's values?
 *
 * Bucket names are rarely literal ("Óscar Savings" is family money, "Savings"
 * is the safety net), so we map by kind and by household member names too.
 */
export function bucketServesValues(
  values: HouseholdValue[],
  b: { name: string; kind?: string | null },
  opts?: { personNames?: string[] },
): boolean {
  if (matchValue(values, b.name)) return true;
  const keys = values.filter((v) => v.key !== "other").map((v) => v.key);
  // Safety net / savings buckets serve "security"; investing buckets serve
  // "investing"; a bucket named after a household member serves "family".
  if ((b.kind === "emergency" || b.kind === "savings") && keys.includes("security")) return true;
  if (b.kind === "investment" && keys.includes("investing")) return true;
  if (keys.includes("family")) {
    // "Óscar Savings" belongs to "Oscar da Silva": compare accent-free first
    // names / tokens rather than the full stored name.
    const name = fold(b.name);
    for (const p of opts?.personNames ?? []) {
      for (const token of fold(p).split(/[^a-z0-9]+/)) {
        if (token.length >= 3 && name.includes(token)) return true;
      }
    }
  }
  return false;
}

function monthsToFill(remaining: number, pace: number): number | null {
  if (remaining <= 0) return 0;
  if (pace <= 0) return null;
  return Math.ceil(remaining / pace);
}

/**
 * Where would half the drifting money buy the most progress? We pick the
 * value-serving bucket that finishes soonest with the extra money, because a
 * dream that lands is far more motivating than one that inches forward.
 */
function bestRedirect(
  buckets: RatioBucket[],
  values: HouseholdValue[],
  drift: number,
  personNames?: string[],
): RedirectGain | null {
  const redirect = Math.floor(drift / 2);
  if (redirect <= 0) return null;
  const candidates = buckets.filter(
    (b) =>
      bucketServesValues(values, b, { personNames }) &&
      (b.target ?? 0) > 0 &&
      b.balance < (b.target ?? 0),
  );
  const pool = candidates.length > 0
    ? candidates
    : buckets.filter((b) => (b.target ?? 0) > 0 && b.balance < (b.target ?? 0));
  let best: RedirectGain | null = null;
  for (const b of pool) {
    const remaining = round2((b.target ?? 0) - b.balance);
    const pace = Math.max(0, b.monthlyPace ?? b.fundedThisCycle ?? 0);
    const monthsNow = monthsToFill(remaining, pace);
    const monthsAfter = monthsToFill(remaining, pace + redirect);
    // A dream that still takes a decade after the swap is not a motivating
    // suggestion, so only offer swaps that actually land within 10 years.
    if (monthsAfter == null || monthsAfter > 120) continue;
    const saved = monthsNow == null ? monthsAfter : monthsNow - monthsAfter;
    if (saved <= 0) continue;
    const gain: RedirectGain = {
      bucketId: b.id,
      bucketName: b.name,
      redirect,
      remaining,
      monthsNow,
      monthsAfter,
      monthsSaved: saved,
    };
    if (!best || gain.monthsAfter! < best.monthsAfter! ) best = gain;
  }
  return best;
}

export function valuesRatios(input: {
  expenses: Array<{
    amount: number | string;
    intent?: string | null;
    category?: string | null;
    kind?: string | null;
  }>;
  values: HouseholdValue[];
  /** Income for the cycle (actual when recorded, otherwise expected). */
  income: number;
  buckets: RatioBucket[];
  /** Alignment ratio from the previous cycle, for the trend arrow. */
  prevAlignmentPct?: number | null;
  /** Household member names, so buckets named after them count as family. */
  personNames?: string[];
}): ValuesRatios {
  const values = input.values ?? [];
  const align = alignmentSummary(input.expenses ?? [], values);
  const income = Math.max(0, Number(input.income) || 0);
  const buckets = input.buckets ?? [];
  const personNames = input.personNames ?? [];

  const savedTotal = round2(buckets.reduce((s, b) => s + (Number(b.fundedThisCycle) || 0), 0));
  const dreamFunded = round2(
    buckets
      .filter((b) => bucketServesValues(values, b, { personNames }))
      .reduce((s, b) => s + (Number(b.fundedThisCycle) || 0), 0),
  );

  const drift = align.offValues;
  const driftPct = income > 0 ? round1((drift / income) * 100) : 0;
  const dreamFundingPct = income > 0 ? round1((dreamFunded / income) * 100) : 0;
  const driftPerDreamEuro = dreamFunded > 0 ? round2(drift / dreamFunded) : null;

  const prev = input.prevAlignmentPct;
  const trendPts =
    typeof prev === "number" && align.flexible > 0 ? round1(align.alignedPct - prev) : null;

  let grade: ValuesGrade = "unset";
  if (!align.unset) {
    // Two things must be true to be "on course": most of the flexible money
    // serves the values, and the dreams are actually being funded.
    if (align.alignedPct >= 60 && dreamFundingPct >= 5) grade = "on_course";
    else if (align.alignedPct >= 35 || dreamFunded > 0) grade = "drifting";
    else grade = "off_course";
  }

  return {
    unset: align.unset,
    align,
    income: round2(income),
    alignmentPct: align.alignedPct,
    driftPct,
    drift,
    dreamFunded,
    dreamFundingPct,
    savedTotal,
    driftPerDreamEuro,
    redirect: align.unset ? null : bestRedirect(buckets, values, drift, personNames),
    trendPts,
    grade,
  };
}
