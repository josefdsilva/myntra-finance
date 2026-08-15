// Run with: bun test src/lib/savings-finder.test.ts
import { test, expect } from "bun:test";
import { findSavings } from "./savings-finder";

test("Rui: tight budget surfaces trims and (under-55, low income) an income option", () => {
  const r = findSavings({
    income: 2000,
    surplus: 0,
    marginPct: 10,
    ageBand: "35_44",
    incomeQuintile: 1,
    nonEssentialMonthly: 120,
  });
  expect(r.surface).toBe(true);
  expect(r.gapEur).toBe(200); // 10% of 2000, none saved
  // Non-essential trim = a third of 120 = 40 — literally "which €40 to cut".
  expect(r.spending.some((s) => s.kind === "non_essential" && s.monthlyEur === 40)).toBe(true);
  expect(r.income.some((i) => i.kind === "income_role")).toBe(true);
});

test("underwater (baseline > income) surfaces break-even framing with the real overspend", () => {
  // Rui: income €2030, baseline €2440 → €410/mo over. This is exactly the family
  // that most needs "where to cut", and must not be hidden.
  const r = findSavings({
    income: 2030,
    surplus: 0,
    marginPct: 3,
    ageBand: "35_44",
    incomeQuintile: 1,
    nonEssentialMonthly: 150,
    deficit: 410,
  });
  expect(r.surface).toBe(true);
  expect(r.mode).toBe("breakeven");
  expect(r.deficitEur).toBe(410);
  // Total to free up = ~3% cushion (61) + 410 overspend ≈ 471.
  expect(r.gapEur).toBe(471);
});

test("comfortable surplus never surfaces the finder", () => {
  const r = findSavings({
    income: 4000,
    surplus: 900, // >10% of income
    marginPct: 10,
    ageBand: "35_44",
    incomeQuintile: 1,
    nonEssentialMonthly: 300,
  });
  expect(r.surface).toBe(false);
});

test("discretionary categories suggest a third, ranked by size", () => {
  const r = findSavings({
    income: 2000,
    surplus: 0,
    marginPct: 10,
    // Caller passes only discretionary categories (never essentials).
    categoryCuts: [
      { category: "shopping", monthly: 117 },
      { category: "subscriptions", monthly: 86 },
    ],
    nonEssentialMonthly: 0,
  });
  expect(r.spending[0]).toEqual({ kind: "category", category: "shopping", monthlyEur: 39 });
  expect(r.spending.some((s) => s.kind === "category" && s.category === "subscriptions")).toBe(true);
});

test("income option is gated by age and income position", () => {
  const base = { income: 2000, surplus: 0, marginPct: 10, incomeQuintile: 1, nonEssentialMonthly: 60 };
  // 55+ → no earning nudge
  expect(findSavings({ ...base, ageBand: "55_64" }).income).toHaveLength(0);
  // under 55 but comfortable income position → no earning nudge
  expect(findSavings({ ...base, ageBand: "35_44", incomeQuintile: 4 }).income).toHaveLength(0);
  // unknown age → no earning nudge
  expect(findSavings({ ...base, ageBand: null }).income).toHaveLength(0);
});
