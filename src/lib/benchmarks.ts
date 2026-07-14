import ptBenchmark from "./benchmarks/pt.json";
import esBenchmark from "./benchmarks/es.json";
import deBenchmark from "./benchmarks/de.json";
import frBenchmark from "./benchmarks/fr.json";
import itBenchmark from "./benchmarks/it.json";
import nlBenchmark from "./benchmarks/nl.json";
import ieBenchmark from "./benchmarks/ie.json";

/**
 * Static national benchmarks. Sourced from public statistics (Eurostat / INE)
 * and refreshed manually. See each JSON file's `sources` field.
 *
 * Comparison is by country + income band + household composition:
 *  - Income percentile comes from the country's equivalised income deciles.
 *  - That percentile picks the household's income *quintile* (fifth).
 *  - Spending is compared against that quintile's per-adult-equivalent
 *    expenditure, scaled back up by the household's own equivalence factor,
 *    so both sides of every comparison are consistently size-adjusted.
 *  - Category comparisons are made in absolute EUR (not share-of-total), so an
 *    untracked category no longer distorts every other category.
 */

export type CountryBenchmark = typeof ptBenchmark;

const BENCHMARKS: Record<string, CountryBenchmark> = {
  PT: ptBenchmark,
  ES: esBenchmark,
  DE: deBenchmark,
  FR: frBenchmark,
  IT: itBenchmark,
  NL: nlBenchmark,
  IE: ieBenchmark,
};

/**
 * Categories the national consumption benchmarks do NOT cover. Eurostat's
 * household budget survey measures *consumption expenditure*, which by
 * definition excludes debt repayment, saving, and investment transfers. We
 * exclude these from the comparison entirely rather than inventing a benchmark
 * (the old code stamped a fake "999%" on them).
 */
export const NON_CONSUMPTION_CATEGORIES = new Set([
  "debt",
  "savings",
  "saving",
  "investment",
  "investments",
  "loan",
  "loans",
  "transfer",
  "transfers",
]);

/**
 * How a category's share of spending shifts across income quintiles (Engel's
 * law). Values are multipliers applied to the national-average share for
 * quintiles 1..5; ~1.0 in the middle. Grounded in the direction/magnitude of
 * Eurostat hbs_str_t223 structure-by-quintile: necessities (food at home,
 * utilities, housing) fall as a share of the budget as income rises, while
 * restaurants, transport, recreation and travel rise. Applied to each
 * country's shares, then renormalised to 100%.
 */
const CATEGORY_INCOME_GRADIENT: Record<string, [number, number, number, number, number]> = {
  groceries: [1.45, 1.2, 1.02, 0.86, 0.7],
  dining: [0.55, 0.78, 0.98, 1.18, 1.4],
  transport: [0.55, 0.78, 0.98, 1.18, 1.38],
  fuel: [0.7, 0.88, 1.0, 1.1, 1.18],
  utilities: [1.35, 1.15, 1.02, 0.88, 0.74],
  housing: [1.28, 1.12, 1.02, 0.9, 0.8],
  subscriptions: [1.1, 1.05, 1.0, 0.97, 0.92],
  health: [0.95, 0.98, 1.0, 1.03, 1.08],
  kids: [0.7, 0.86, 1.0, 1.12, 1.24],
  shopping: [0.72, 0.86, 0.99, 1.15, 1.3],
  entertainment: [0.75, 0.88, 1.0, 1.13, 1.26],
  travel: [0.45, 0.7, 0.95, 1.25, 1.6],
  gifts: [0.85, 0.93, 1.0, 1.07, 1.15],
  other: [0.9, 0.96, 1.0, 1.05, 1.12],
};

export function hasBenchmark(country: string | null | undefined): boolean {
  const code = (country ?? "").toUpperCase();
  return !!BENCHMARKS[code];
}

export function getCountryBenchmark(country: string | null | undefined): CountryBenchmark | null {
  const code = (country ?? "").toUpperCase();
  return BENCHMARKS[code] ?? null;
}

export function supportedBenchmarkCountries(): Array<{ code: string; name: string }> {
  return Object.values(BENCHMARKS).map((b) => ({ code: b.country, name: b.countryName }));
}

/** Latest bundled sourceYear per country. Used by the version-check endpoint. */
export function benchmarkVersions(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of Object.values(BENCHMARKS)) out[b.country] = b.sourceYear;
  return out;
}

/** OECD-modified equivalence scale: 1 first adult + 0.5 per extra adult + 0.3 per child. */
export function equivalenceFactor(adults: number, children: number): number {
  const a = Math.max(1, Math.round(adults));
  const c = Math.max(0, Math.round(children));
  return 1 + 0.5 * (a - 1) + 0.3 * c;
}

type Deciles = Record<`d${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`, number>;

/**
 * Return the approximate percentile (0-100) of an annual equivalised income
 * against a country's decile boundaries. Linear interpolation inside each
 * decile; clamped to [1, 99].
 */
export function percentileFromDeciles(annualEquivalisedIncome: number, deciles: Deciles): number {
  const bounds = [
    deciles.d1,
    deciles.d2,
    deciles.d3,
    deciles.d4,
    deciles.d5,
    deciles.d6,
    deciles.d7,
    deciles.d8,
    deciles.d9,
  ];
  if (annualEquivalisedIncome <= 0) return 1;
  if (annualEquivalisedIncome <= bounds[0]) {
    return Math.max(1, Math.round((annualEquivalisedIncome / bounds[0]) * 10));
  }
  for (let i = 0; i < bounds.length - 1; i++) {
    if (annualEquivalisedIncome <= bounds[i + 1]) {
      const frac = (annualEquivalisedIncome - bounds[i]) / (bounds[i + 1] - bounds[i]);
      return Math.round((i + 1) * 10 + frac * 10);
    }
  }
  // Above d9: extrapolate up to 99.
  const above = (annualEquivalisedIncome - bounds[bounds.length - 1]) / bounds[bounds.length - 1];
  return Math.min(99, Math.round(90 + above * 10));
}

/** Map an income percentile (1-99) to its income quintile (1..5). */
export function quintileFromPercentile(percentile: number): 1 | 2 | 3 | 4 | 5 {
  const q = Math.ceil(Math.min(99, Math.max(1, percentile)) / 20);
  return Math.min(5, Math.max(1, q)) as 1 | 2 | 3 | 4 | 5;
}

/** i18n key suffix describing each income band, e.g. `benchmarks.bandMid`. */
export function bandKeyForQuintile(q: number): string {
  return (
    ["benchmarks.bandBottom", "benchmarks.bandLowerMid", "benchmarks.bandMid", "benchmarks.bandUpperMid", "benchmarks.bandTop"][
      q - 1
    ] ?? "benchmarks.bandMid"
  );
}

/** Per-quintile category shares (%), derived from national shares + gradient, renormalised to 100. */
function quintileCategoryShares(
  nationalShares: Record<string, number>,
  quintile: number,
): Record<string, number> {
  const idx = quintile - 1;
  const raw: Record<string, number> = {};
  let total = 0;
  for (const [cat, share] of Object.entries(nationalShares)) {
    const g = CATEGORY_INCOME_GRADIENT[cat]?.[idx] ?? 1;
    const v = Number(share) * g;
    raw[cat] = v;
    total += v;
  }
  const out: Record<string, number> = {};
  if (total > 0) {
    for (const [cat, v] of Object.entries(raw)) out[cat] = (v / total) * 100;
  }
  return out;
}

export type BenchmarkCategory = {
  category: string;
  userMonthly: number;
  /** Expected monthly spend for a same-band, same-size household (EUR). */
  benchmarkMonthly: number;
  /** (user - benchmark) in EUR. */
  diffEur: number;
  /** (user - benchmark) / benchmark, in %. Null when benchmark is 0. */
  deviationPct: number | null;
  /** true if the gap is materially large in both EUR and relative terms. */
  flagged: boolean;
};

export type BenchmarkComparison = {
  country: string;
  countryName: string;
  currency: string;
  sourceYear: number;
  equivalenceFactor: number;
  monthlyIncome: number;
  annualEquivalisedIncome: number;
  /** 1-99 percentile against the national equivalised income deciles. */
  incomePercentile: number;
  /** Household's income quintile (1..5) — the band it's compared against. */
  incomeQuintile: 1 | 2 | 3 | 4 | 5;
  /** i18n key naming the income band (bottom / lower-mid / mid / upper-mid / top). */
  bandKey: string;
  /** Household's total monthly spend (from user data). */
  monthlySpend: number;
  /**
   * Expected total monthly spend for a same-income-band, same-size household.
   * Replaces the old flat national average and is size-consistent with income.
   */
  expectedMonthlySpend: number;
  /** (income - spend) / income, in %. Null if income is 0. */
  savingsRatePct: number | null;
  /** National average household saving rate, % (macro figure, rough guide). */
  nationalSavingsRatePct: number;
  /** Share of the user's tracked spend that maps to a benchmarked category, %. */
  coveragePct: number;
  /** Sum of user spend that mapped to benchmarked categories (EUR/month). */
  matchedMonthlySpend: number;
  /** Categories tracked by the user that the benchmark does not cover (debt, savings…). */
  excludedCategories: Array<{ category: string; userMonthly: number }>;
  /** Per-category comparison in absolute EUR, sorted by absolute deviation. */
  categories: BenchmarkCategory[];
};

/**
 * Compare a household's monthly spend & income snapshot to a country benchmark,
 * matched to the household's income band and size.
 * `spendByCategory` uses the app's category keys.
 */
export function computeBenchmarkComparison(params: {
  country: string;
  adults: number;
  children: number;
  monthlyIncome: number;
  monthlySpend: number;
  spendByCategory: Record<string, number>;
}): BenchmarkComparison | null {
  const bench = getCountryBenchmark(params.country);
  if (!bench) return null;

  const factor = equivalenceFactor(params.adults, params.children);
  const annualEq = (params.monthlyIncome / factor) * 12;
  const incomePercentile = percentileFromDeciles(
    annualEq,
    bench.incomeDecilesAnnualEquivalised as Deciles,
  );
  const quintile = quintileFromPercentile(incomePercentile);

  // Expected spend for a household in this income band, adjusted to THIS
  // household's size. Both figures are per-adult-equivalent internally, then
  // scaled by the household's own equivalence factor.
  const meanPerAE = bench.avgMonthlyHouseholdExpenditure / bench.avgHouseholdEquivFactor;
  const qMult =
    (bench.quintileExpenditureMultipliers as Record<string, number>)[`q${quintile}`] ?? 1;
  const expectedMonthlySpend = Math.round(meanPerAE * qMult * factor);

  const savingsRatePct =
    params.monthlyIncome > 0
      ? Math.round(((params.monthlyIncome - params.monthlySpend) / params.monthlyIncome) * 1000) /
        10
      : null;

  const shares = quintileCategoryShares(
    bench.categoryShares as Record<string, number>,
    quintile,
  );

  // Split the user's spend into benchmarkable vs excluded (non-consumption).
  const excludedCategories: Array<{ category: string; userMonthly: number }> = [];
  let totalUserSpend = 0;
  let matchedMonthlySpend = 0;
  for (const [cat, amt] of Object.entries(params.spendByCategory)) {
    const v = Number(amt || 0);
    if (v <= 0) continue;
    totalUserSpend += v;
    if (NON_CONSUMPTION_CATEGORIES.has(cat)) {
      excludedCategories.push({ category: cat, userMonthly: Math.round(v * 100) / 100 });
      continue;
    }
    if (shares[cat] != null) matchedMonthlySpend += v;
  }

  // Build per-category comparison in absolute EUR over the benchmarked categories.
  const categories: BenchmarkCategory[] = Object.keys(shares)
    .map((cat) => {
      const userMonthly = Number(params.spendByCategory[cat] ?? 0);
      const benchmarkMonthly =
        Math.round(((shares[cat] / 100) * expectedMonthlySpend) * 100) / 100;
      const diffEur = Math.round((userMonthly - benchmarkMonthly) * 100) / 100;
      const deviationPct =
        benchmarkMonthly > 0
          ? Math.round((diffEur / benchmarkMonthly) * 1000) / 10
          : null;
      const material =
        (userMonthly > 20 || benchmarkMonthly > 20) &&
        Math.abs(diffEur) >= Math.max(25, 0.3 * benchmarkMonthly);
      return {
        category: cat,
        userMonthly: Math.round(userMonthly * 100) / 100,
        benchmarkMonthly,
        diffEur,
        deviationPct,
        flagged: material,
      };
    })
    .filter((c) => c.userMonthly > 0 || c.benchmarkMonthly > 0)
    .sort((a, b) => Math.abs(b.diffEur) - Math.abs(a.diffEur));

  const coveragePct =
    totalUserSpend > 0 ? Math.round((matchedMonthlySpend / totalUserSpend) * 100) : 0;

  return {
    country: bench.country,
    countryName: bench.countryName,
    currency: bench.currency,
    sourceYear: bench.sourceYear,
    equivalenceFactor: factor,
    monthlyIncome: params.monthlyIncome,
    annualEquivalisedIncome: Math.round(annualEq),
    incomePercentile,
    incomeQuintile: quintile,
    bandKey: bandKeyForQuintile(quintile),
    monthlySpend: params.monthlySpend,
    expectedMonthlySpend,
    savingsRatePct,
    nationalSavingsRatePct: bench.householdSavingRatePct,
    coveragePct,
    matchedMonthlySpend: Math.round(matchedMonthlySpend * 100) / 100,
    excludedCategories,
    categories,
  };
}
