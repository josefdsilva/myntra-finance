// Run with: bun test src/lib/amortization.test.ts
/// <reference types="@types/bun" />
import { test, expect } from "bun:test";
import {
  monthlyRateFromTaeg,
  monthlyRateFromNominalTan,
  installmentFor,
  termMonthsFor,
  balanceAfter,
  scheduleSummary,
  applyOverpayment,
  reconcileDebtInputs,
} from "./amortization";

const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol;

// Reference loan: 10,000 @ 6% TAEG over 24 months.
const r6 = monthlyRateFromTaeg(6); // ≈ 0.00486755
const M6 = installmentFor(10000, r6, 24); // ≈ 442.49

test("monthlyRateFromTaeg converts effective annual → effective monthly", () => {
  expect(near(r6, 0.00486755, 1e-6)).toBe(true);
  // (1 + monthly)^12 should return the annual effective factor.
  expect(near(Math.pow(1 + r6, 12), 1.06, 1e-6)).toBe(true);
});

test("monthlyRateFromNominalTan divides by 12", () => {
  expect(near(monthlyRateFromNominalTan(6), 0.005, 1e-9)).toBe(true);
});

test("installmentFor matches the classic annuity value", () => {
  expect(near(M6, 442.49, 1)).toBe(true);
});

test("balanceAfter reaches ~0 at the final scheduled payment", () => {
  expect(balanceAfter(10000, r6, M6, 24)).toBeLessThan(1);
});

test("termMonthsFor inverts installmentFor", () => {
  const n = termMonthsFor(10000, r6, M6);
  expect(n).not.toBeNull();
  expect(near(n as number, 24, 0.1)).toBe(true);
});

test("termMonthsFor returns null when the installment never amortizes", () => {
  // Installment below monthly interest (10000 * 0.00487 ≈ 48.7).
  expect(termMonthsFor(10000, r6, 40)).toBeNull();
});

test("zero-interest loan amortizes linearly", () => {
  expect(installmentFor(1200, 0, 12)).toBe(100);
  expect(balanceAfter(1200, 0, 100, 6)).toBe(600);
  expect(termMonthsFor(1200, 0, 100)).toBe(12);
});

test("scheduleSummary reports progress halfway through", () => {
  const s = scheduleSummary({
    principal: 10000,
    startingPrincipal: 10000,
    monthlyRate: r6,
    installment: M6,
    anchorDate: new Date("2024-01-01"),
    today: new Date("2025-01-01"), // 12 months in
  });
  expect(s.monthsElapsed).toBe(12);
  expect(near(s.remaining, 5145, 5)).toBe(true);
  expect(s.progressPct).toBeGreaterThan(45);
  expect(s.progressPct).toBeLessThan(52);
  expect(s.payoffDate).not.toBeNull();
});

test("overpayment reduces the installment while keeping the term", () => {
  const res = applyOverpayment(
    { principal: 10000, monthlyRate: r6, installment: M6, maturityDate: new Date("2026-01-01") },
    2000,
    "reduce_installment",
    new Date("2024-01-01"),
  );
  expect(res.principal).toBe(8000);
  expect(res.installment).toBeLessThan(M6);
  expect(near(res.installment, 354, 2)).toBe(true);
  expect(res.maturityDate.getFullYear()).toBe(2026); // unchanged
});

test("overpayment shortens the term while keeping the installment", () => {
  const asOf = new Date("2024-01-01");
  const res = applyOverpayment(
    { principal: 10000, monthlyRate: r6, installment: M6, maturityDate: new Date("2026-01-01") },
    2000,
    "shorten_term",
    asOf,
  );
  expect(res.principal).toBe(8000);
  expect(near(res.installment, M6, 0.01)).toBe(true);
  const months = (res.maturityDate.getFullYear() - 2024) * 12 + res.maturityDate.getMonth();
  expect(months).toBeLessThan(24); // pays off sooner than the original 24
  expect(months).toBeGreaterThan(16);
});

test("overpaying the full balance clears the debt", () => {
  const res = applyOverpayment(
    { principal: 8000, monthlyRate: r6, installment: M6, maturityDate: new Date("2026-01-01") },
    8000,
    "shorten_term",
    new Date("2024-06-01"),
  );
  expect(res.paidOff).toBe(true);
  expect(res.principal).toBe(0);
  expect(res.installment).toBe(0);
});

test("reconcileDebtInputs derives the missing field both ways", () => {
  const fromTerm = reconcileDebtInputs({ principal: 10000, monthlyRate: r6, termMonths: 24 });
  expect(fromTerm).not.toBeNull();
  expect(near(fromTerm!.installment, 442.49, 1)).toBe(true);

  const fromInstallment = reconcileDebtInputs({ principal: 10000, monthlyRate: r6, installment: M6 });
  expect(fromInstallment).not.toBeNull();
  expect(fromInstallment!.termMonths).toBe(24);
});
