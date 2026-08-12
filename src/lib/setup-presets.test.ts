// Run with: bun test src/lib/setup-presets.test.ts
import { test, expect } from "bun:test";
import { buildSetupPresets, type SetupPreset } from "./setup-presets";

// The 14 benchmark category keys — every emitted row must use one of these so
// the app's intent/housing logic recognises it.
const KNOWN = new Set([
  "groceries",
  "dining",
  "transport",
  "fuel",
  "utilities",
  "housing",
  "subscriptions",
  "health",
  "kids",
  "shopping",
  "entertainment",
  "travel",
  "gifts",
  "other",
]);

const sum = (rows: Array<{ monthly_amount: number }>) => rows.reduce((s, r) => s + r.monthly_amount, 0);

/** The core guarantee: discretionary spend + margin never exceed what's left
 * after fixed costs, so day-one safe-to-spend can't be negative. */
function assertFitsIncome(p: SetupPreset, income: number) {
  const fixedTotal = sum(p.fixed);
  const varTotal = sum(p.variable);
  const marginAmt = Math.round((p.marginPct / 100) * income);
  const available = Math.max(0, income - fixedTotal);
  // Slack absorbs per-row rounding when variable spend is scaled to fit.
  expect(varTotal + marginAmt).toBeLessThanOrEqual(available + p.variable.length + 2);
}

test("PT mid-income household: estimated rows, known categories, sane margin", () => {
  const income = 3000;
  const p = buildSetupPresets({ country: "PT", adults: 2, children: 1, monthlyIncome: income });
  expect(p.estimated).toBe(true);
  expect(p.fixed.length).toBeGreaterThan(0);
  expect(p.variable.length).toBeGreaterThan(0);
  expect(p.fixed.some((r) => r.category === "housing")).toBe(true);
  for (const r of [...p.fixed, ...p.variable]) {
    expect(KNOWN.has(r.category)).toBe(true);
    expect(r.monthly_amount).toBeGreaterThan(0);
  }
  for (const r of p.fixed) expect(typeof r.intent).toBe("string");
  expect(p.marginPct).toBeGreaterThanOrEqual(0);
  expect(p.marginPct).toBeLessThanOrEqual(20);
  assertFitsIncome(p, income);
});

test("housing override replaces the benchmark estimate", () => {
  const p = buildSetupPresets({
    country: "PT",
    adults: 1,
    children: 0,
    monthlyIncome: 2500,
    housingMonthly: 700,
  });
  expect(p.fixed.find((r) => r.category === "housing")?.monthly_amount).toBe(700);
});

test("low income never overstates spend", () => {
  const income = 900;
  const p = buildSetupPresets({ country: "PT", adults: 2, children: 2, monthlyIncome: income });
  assertFitsIncome(p, income);
  for (const r of [...p.fixed, ...p.variable]) expect(r.monthly_amount).toBeGreaterThan(0);
  expect(p.marginPct).toBeGreaterThanOrEqual(0);
});

test("all supported countries produce fitting presets", () => {
  for (const country of ["PT", "ES", "DE", "FR", "IT", "NL", "IE"]) {
    const income = 2800;
    const p = buildSetupPresets({ country, adults: 2, children: 0, monthlyIncome: income });
    expect(p.estimated).toBe(true);
    for (const r of [...p.fixed, ...p.variable]) expect(KNOWN.has(r.category)).toBe(true);
    assertFitsIncome(p, income);
  }
});

test("tight budget still suggests a 3% savings floor and flags a gap", () => {
  const income = 2800; // typical benchmark spend for 2 adults exceeds this
  const p = buildSetupPresets({ country: "PT", adults: 2, children: 0, monthlyIncome: income });
  expect(p.gap).toBe(true);
  expect(p.marginPct).toBeGreaterThanOrEqual(3);
  assertFitsIncome(p, income);
});

test("comfortable budget keeps a healthy margin and no gap", () => {
  const income = 8000;
  const p = buildSetupPresets({ country: "PT", adults: 2, children: 0, monthlyIncome: income });
  expect(p.gap).toBe(false);
  expect(p.marginPct).toBeGreaterThanOrEqual(5);
  assertFitsIncome(p, income);
});

test("unknown country → empty preset", () => {
  const p = buildSetupPresets({ country: "BE", adults: 1, children: 0, monthlyIncome: 3000 });
  expect(p.estimated).toBe(false);
  expect(p.fixed).toHaveLength(0);
  expect(p.variable).toHaveLength(0);
  expect(p.marginPct).toBe(0);
});

test("business or zero income → empty preset", () => {
  const biz = buildSetupPresets({ country: "PT", adults: 1, children: 0, monthlyIncome: 3000, isBusiness: true });
  expect(biz.estimated).toBe(false);
  const zero = buildSetupPresets({ country: "PT", adults: 1, children: 0, monthlyIncome: 0 });
  expect(zero.estimated).toBe(false);
});
