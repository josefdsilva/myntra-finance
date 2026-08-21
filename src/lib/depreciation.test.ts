// Run with: bun test src/lib/depreciation.test.ts
import { test, expect } from "bun:test";
import { computeDepreciation, assetBookValue, deriveUsefulLifeMonths } from "./depreciation";

test("non-straight-line or missing inputs return null", () => {
  expect(
    computeDepreciation({
      method: "none",
      acquiredValue: 1000,
      salvageValue: 0,
      usefulLifeMonths: 60,
      start: "2020-01-01",
    }),
  ).toBeNull();
  expect(
    computeDepreciation({
      method: "straight_line",
      acquiredValue: null,
      salvageValue: 0,
      usefulLifeMonths: 60,
      start: "2020-01-01",
    }),
  ).toBeNull();
  expect(
    computeDepreciation({
      method: "straight_line",
      acquiredValue: 1000,
      salvageValue: 0,
      usefulLifeMonths: null,
      start: "2020-01-01",
    }),
  ).toBeNull();
  expect(
    computeDepreciation({
      method: "straight_line",
      acquiredValue: 1000,
      salvageValue: 0,
      usefulLifeMonths: 60,
      start: null,
    }),
  ).toBeNull();
});

test("straight-line: monthly/annual charge and book value at the halfway point", () => {
  // €12,000 cost, no salvage, 5-year (60-month) life -> €200/mo, €2,400/yr.
  // 30 months in => half depreciated.
  const asOf = new Date("2022-07-01T00:00:00"); // ~30 months after 2020-01-01
  const r = computeDepreciation(
    {
      method: "straight_line",
      acquiredValue: 12000,
      salvageValue: 0,
      usefulLifeMonths: 60,
      start: "2020-01-01",
    },
    asOf,
  )!;
  expect(r.monthly).toBe(200);
  expect(r.annual).toBe(2400);
  // ~30 months elapsed (fractional due to uniform-month model).
  expect(r.monthsElapsed).toBeCloseTo(30, 0);
  expect(Math.abs(r.accumulated - 6000)).toBeLessThan(20); // uniform-month model drift
  expect(Math.abs(r.bookValue - 6000)).toBeLessThan(20);
  expect(r.pctDepreciated).toBeGreaterThan(48);
  expect(r.pctDepreciated).toBeLessThan(52);
  expect(r.fullyDepreciated).toBe(false);
});

test("salvage value caps accumulated depreciation; book value never dips below salvage", () => {
  // €10,000 cost, €2,000 salvage, 40-month life, far in the future -> fully
  // depreciated, book value floored at salvage.
  const r = computeDepreciation(
    {
      method: "straight_line",
      acquiredValue: 10000,
      salvageValue: 2000,
      usefulLifeMonths: 40,
      start: "2010-01-01",
    },
    new Date("2030-01-01T00:00:00"),
  )!;
  expect(r.accumulated).toBe(8000); // depreciable base = 10000 - 2000
  expect(r.bookValue).toBe(2000);
  expect(r.pctDepreciated).toBe(100);
  expect(r.fullyDepreciated).toBe(true);
  expect(r.remainingMonths).toBe(0);
});

test("already-partially-depreciated: a past start yields a reduced book value today", () => {
  // Bought 2 years (24 months) before asOf, 8-year life, €8,000, no salvage.
  const asOf = new Date("2024-01-01T00:00:00");
  const bv = assetBookValue(
    {
      method: "straight_line",
      acquiredValue: 8000,
      salvageValue: 0,
      usefulLifeMonths: 96,
      start: "2022-01-01",
    },
    asOf,
  )!;
  // 24/96 = 25% depreciated => ~€6,000 book value.
  expect(bv).toBeCloseTo(6000, -1);
});

test("deriveUsefulLifeMonths back-calculates the life from cost + current value", () => {
  // €12,000 cost, worth €9,000 after 12 months, no salvage.
  // Lost €3,000 in 12 months => €250/mo => 48-month total life.
  const life = deriveUsefulLifeMonths(
    { acquiredValue: 12000, currentValue: 9000, salvageValue: 0, start: "2023-01-01" },
    new Date("2024-01-01T00:00:00"),
  );
  expect(life).toBeCloseTo(48, 0);
});

test("deriveUsefulLifeMonths returns null when it can't form an estimate", () => {
  // No loss yet.
  expect(
    deriveUsefulLifeMonths(
      { acquiredValue: 10000, currentValue: 10000, start: "2023-01-01" },
      new Date("2024-01-01T00:00:00"),
    ),
  ).toBeNull();
  // Current above cost (appreciated) — not depreciation.
  expect(
    deriveUsefulLifeMonths(
      { acquiredValue: 10000, currentValue: 11000, start: "2023-01-01" },
      new Date("2024-01-01T00:00:00"),
    ),
  ).toBeNull();
  // No start date.
  expect(
    deriveUsefulLifeMonths({ acquiredValue: 10000, currentValue: 8000, start: null }),
  ).toBeNull();
});
