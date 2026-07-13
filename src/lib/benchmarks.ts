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
 * The lookup is by country + household composition (adults + children).
 * We normalise the household to an OECD-modified equivalence factor so we
 * can compare against equivalised income deciles without needing a decile
 * table per household size.
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

export type BenchmarkComparison = {
  country: string;
  countryName: string;
  currency: string;
  sourceYear: number;
  equivalenceFactor: number;
  /** User's monthly household income, echoed for reference. */
  monthlyIncome: number;
  /** Same income expressed as annual equivalised (for the decile comparison). */
  annualEquivalisedIncome: number;
  /** 1-99 percentile against the national equivalised income deciles. */
  incomePercentile: number;
  /** National average monthly household expenditure (raw, not equivalised). */
  nationalAvgMonthlyExpenditure: number;
  /** Household's total monthly spend (from user data). */
  monthlySpend: number;
  /** (income - spend) / income, in %. Null if income is 0. */
  savingsRatePct: number | null;
  /** National average household saving rate, %. */
  nationalSavingsRatePct: number;
  /** Per-category comparison, sorted by absolute deviation. */
  categories: Array<{
    category: string;
    userMonthly: number;
    userSharePct: number;
    benchmarkSharePct: number;
    benchmarkMonthly: number;
    deviationPct: number;
    /** true if |deviationPct| > 30 */
    flagged: boolean;
  }>;
};

/**
 * Compare a household's monthly spend & income snapshot to a country benchmark.
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

  const savingsRatePct =
    params.monthlyIncome > 0
      ? Math.round(((params.monthlyIncome - params.monthlySpend) / params.monthlyIncome) * 1000) /
        10
      : null;

  const totalSpend = Object.values(params.spendByCategory).reduce((s, n) => s + Number(n || 0), 0);
  const shares = bench.categoryShares as Record<string, number>;
  const catKeys = new Set([...Object.keys(shares), ...Object.keys(params.spendByCategory)]);

  const categories = Array.from(catKeys)
    .map((cat) => {
      const userMonthly = Number(params.spendByCategory[cat] ?? 0);
      const userSharePct = totalSpend > 0 ? (userMonthly / totalSpend) * 100 : 0;
      const benchmarkSharePct = shares[cat] ?? 0;
      const benchmarkMonthly = (benchmarkSharePct / 100) * bench.avgMonthlyHouseholdExpenditure;
      const deviationPct =
        benchmarkSharePct > 0
          ? Math.round(((userSharePct - benchmarkSharePct) / benchmarkSharePct) * 1000) / 10
          : userSharePct > 0
            ? 999
            : 0;
      return {
        category: cat,
        userMonthly: Math.round(userMonthly * 100) / 100,
        userSharePct: Math.round(userSharePct * 10) / 10,
        benchmarkSharePct,
        benchmarkMonthly: Math.round(benchmarkMonthly * 100) / 100,
        deviationPct,
        flagged: Math.abs(deviationPct) > 30 && (userMonthly > 20 || benchmarkMonthly > 20),
      };
    })
    // Drop categories that are ~0 both sides — noise.
    .filter((c) => c.userMonthly > 0 || c.benchmarkSharePct > 0)
    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));

  return {
    country: bench.country,
    countryName: bench.countryName,
    currency: bench.currency,
    sourceYear: bench.sourceYear,
    equivalenceFactor: factor,
    monthlyIncome: params.monthlyIncome,
    annualEquivalisedIncome: Math.round(annualEq),
    incomePercentile,
    nationalAvgMonthlyExpenditure: bench.avgMonthlyHouseholdExpenditure,
    monthlySpend: params.monthlySpend,
    savingsRatePct,
    nationalSavingsRatePct: bench.householdSavingRatePct,
    categories,
  };
}
