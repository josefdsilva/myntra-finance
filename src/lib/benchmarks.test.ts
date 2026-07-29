// Run with: bun test src/lib/benchmarks.test.ts
import { test, expect } from "bun:test";
import {
  hasBenchmark,
  getCountryBenchmark,
  getEurozoneMacro,
  equivalenceFactor,
  percentileFromDeciles,
  quintileFromPercentile,
  computeBenchmarkComparison,
  computeWealthComparison,
  computeDebtServiceComparison,
} from "./benchmarks";

test("hasBenchmark is true only for curated countries (hide-otherwise)", () => {
  expect(hasBenchmark("PT")).toBe(true);
  expect(hasBenchmark("pt")).toBe(true); // case-insensitive
  expect(hasBenchmark("XX")).toBe(false);
  expect(hasBenchmark(null)).toBe(false);
  expect(hasBenchmark(undefined)).toBe(false);
  expect(hasBenchmark("")).toBe(false);
});

test("equivalenceFactor follows the OECD-modified scale", () => {
  expect(equivalenceFactor(1, 0)).toBe(1);
  expect(equivalenceFactor(2, 0)).toBe(1.5);
  expect(equivalenceFactor(2, 2)).toBeCloseTo(2.1, 5); // 1 + 0.5 + 0.6
});

test("quintileFromPercentile buckets 1..5", () => {
  expect(quintileFromPercentile(1)).toBe(1);
  expect(quintileFromPercentile(20)).toBe(1);
  expect(quintileFromPercentile(21)).toBe(2);
  expect(quintileFromPercentile(50)).toBe(3);
  expect(quintileFromPercentile(99)).toBe(5);
});

test("percentileFromDeciles interpolates against the country deciles", () => {
  const deciles = getCountryBenchmark("PT")!.incomeDecilesAnnualEquivalised;
  // The median decile boundary (d5) sits exactly at the 50th percentile.
  expect(percentileFromDeciles(deciles.d5, deciles)).toBe(50);
  expect(percentileFromDeciles(0, deciles)).toBe(1);
});

test("computeBenchmarkComparison: uplift, macro, coverage over consumption only", () => {
  const comp = computeBenchmarkComparison({
    country: "PT",
    adults: 2,
    children: 0,
    monthlyIncome: 2000,
    monthlySpend: 1500,
    spendByCategory: { groceries: 400, dining: 100, debt: 500, savings: 200 },
  })!;
  expect(comp).not.toBeNull();
  expect(comp.country).toBe("PT");
  expect(comp.incomeQuintile).toBe(3);
  // HICP uplift + macro come straight from the curated data / eurozone constant.
  expect(comp.priceUplift).toBe(1.22);
  expect(comp.macro.inflationRatePct).toBe(3.1);
  expect(comp.macro.euribor3mPct).toBe(2.32);
  expect(comp.macro.euroAreaInflationPct).toBe(2.8);
  // Debt & savings are non-consumption: excluded from the comparison AND from the
  // coverage denominator, so everyday coverage is 100% here (regression guard).
  expect(comp.excludedCategories.map((e) => e.category).sort()).toEqual(["debt", "savings"]);
  expect(comp.coveragePct).toBe(100);
  // Savings rate is income vs spend.
  expect(comp.savingsRatePct).toBe(25);
});

test("computeWealthComparison applies income + age gradients", () => {
  const w = computeWealthComparison({
    country: "PT",
    userNetWorth: 50000,
    incomeQuintile: 3,
    ageBand: "under35",
  })!;
  expect(w.countryMedian).toBe(90000);
  expect(w.peerMedian).toBe(26190); // 90000 * 0.97 (Q3) * 0.30 (under 35)
  expect(w.ratio).toBeCloseTo(50000 / 26190, 4);
  expect(w.sourceYear).toBe(2021);

  // No income/age adjustment -> compares to the country overall median.
  const flat = computeWealthComparison({ country: "PT", userNetWorth: 100000 })!;
  expect(flat.peerMedian).toBe(90000);
});

test("computeDebtServiceComparison returns the income share vs the country median", () => {
  const d = computeDebtServiceComparison({
    country: "PT",
    monthlyDebtService: 300,
    monthlyIncome: 2000,
  })!;
  expect(d.userPct).toBe(15);
  expect(d.medianPct).toBe(17);
  expect(d.sourceYear).toBe(2021);
  // No income -> can't form a ratio.
  expect(
    computeDebtServiceComparison({ country: "PT", monthlyDebtService: 300, monthlyIncome: 0 }),
  ).toBeNull();
});

test("unsupported country returns null everywhere (never fabricates a comparison)", () => {
  expect(
    computeBenchmarkComparison({
      country: "XX",
      adults: 2,
      children: 0,
      monthlyIncome: 2000,
      monthlySpend: 1500,
      spendByCategory: {},
    }),
  ).toBeNull();
  expect(computeWealthComparison({ country: "XX", userNetWorth: 50000 })).toBeNull();
  expect(
    computeDebtServiceComparison({ country: "XX", monthlyDebtService: 300, monthlyIncome: 2000 }),
  ).toBeNull();
});

test("eurozone macro constant is exposed", () => {
  expect(getEurozoneMacro().euribor3mPct).toBe(2.32);
  expect(getEurozoneMacro().euroAreaUnemploymentPct).toBe(6.2);
});
