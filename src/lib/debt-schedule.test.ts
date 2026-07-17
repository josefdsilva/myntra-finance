// Run with: bun test src/lib/debt-schedule.test.ts
import { test, expect } from "bun:test";
import { debtMonthlyRate, computeDeducedRate } from "./debt-schedule";
import { monthlyRateFromTaeg } from "./amortization";

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

test("debtMonthlyRate prefers the deduced rate, then TAN, then TAEG", () => {
  // Deduced present wins over everything.
  expect(
    near(debtMonthlyRate({ deduced_rate_pct: 6, tan_pct: 3, taeg_pct: 9 }), monthlyRateFromTaeg(6)),
  ).toBe(true);
  // No deduced: nominal TAN divided by 12.
  expect(near(debtMonthlyRate({ deduced_rate_pct: null, tan_pct: 6, taeg_pct: 9 }), 0.005)).toBe(
    true,
  );
  // Only TAEG left.
  expect(
    near(debtMonthlyRate({ deduced_rate_pct: null, tan_pct: null, taeg_pct: 6 }), monthlyRateFromTaeg(6)),
  ).toBe(true);
});

test("computeDeducedRate returns null without a maturity or with non-amortizing inputs", () => {
  expect(
    computeDeducedRate({
      principal_remaining: 1000,
      starting_principal: null,
      monthly_amount: 50,
      maturity_date: null,
    }),
  ).toBe(null);
  expect(
    computeDeducedRate({
      principal_remaining: 0,
      starting_principal: null,
      monthly_amount: 50,
      maturity_date: "2030-01-01",
    }),
  ).toBe(null);
});

test("computeDeducedRate solves a plausible annual rate", () => {
  const anchor = new Date("2026-01-01T00:00:00.000Z");
  // 10,000 owed, 200/mo, cleared by Dec 2030 (59 months, 11,800 paid) implies a positive rate.
  const rate = computeDeducedRate(
    {
      principal_remaining: 10000,
      starting_principal: null,
      monthly_amount: 200,
      maturity_date: "2030-12-01",
    },
    anchor,
  );
  expect(rate).not.toBe(null);
  expect(rate! > 0 && rate! < 20).toBe(true);
});
