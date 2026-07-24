// Run with: bun test src/lib/cadence.test.ts
import { test, expect } from "bun:test";
import {
  reconcileOccurrences,
  stepCadence,
  monthlyEquivalent,
  perCycleFromMonthly,
  cycleForSpace,
  defaultCycleForKind,
} from "./cadence";

test("monthlyEquivalent normalises native amounts to a monthly figure", () => {
  expect(monthlyEquivalent(1000, "monthly")).toBe(1000);
  expect(monthlyEquivalent(1200, "yearly")).toBe(100);
  expect(monthlyEquivalent(300, "quarterly")).toBe(100);
  expect(monthlyEquivalent(100, "weekly")).toBe(433.33); // 100 * 52/12
  expect(monthlyEquivalent(100, "fortnightly")).toBe(216.67); // 100 * 26/12
});

test("perCycleFromMonthly expresses a monthly figure in the cycle period", () => {
  expect(perCycleFromMonthly(100, "monthly")).toBe(100);
  expect(perCycleFromMonthly(100, "quarterly")).toBe(300);
  expect(perCycleFromMonthly(100, "yearly")).toBe(1200);
  expect(perCycleFromMonthly(100, "weekly")).toBe(23.08); // 100 / (52/12)
});

test("monthlyEquivalent and perCycleFromMonthly round-trip for the same period", () => {
  // weekly native -> monthly -> weekly should return close to the native amount.
  const back = perCycleFromMonthly(monthlyEquivalent(100, "weekly"), "weekly");
  expect(Math.abs(back - 100)).toBeLessThan(0.01);
});

test("cycle defaults by space kind", () => {
  expect(defaultCycleForKind("business")).toBe("quarterly");
  expect(defaultCycleForKind("personal")).toBe("monthly");
  expect(cycleForSpace({ cycle: "yearly", kind: "business" })).toBe("yearly");
  expect(cycleForSpace({ kind: "business" })).toBe("quarterly"); // falls back to kind default
  expect(cycleForSpace({ cycle: "nonsense", kind: "personal" })).toBe("monthly"); // invalid -> default
  expect(cycleForSpace(null)).toBe("monthly");
});

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("monthly line in a quarterly cycle expands to three pay runs at the native amount", () => {
  const occ = reconcileOccurrences(
    "monthly",
    5650,
    5650,
    "quarterly",
    new Date(2026, 0, 1),
    new Date(2026, 3, 1),
  );
  expect(occ.length).toBe(3);
  expect(occ.map((o) => ymd(o.start))).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  expect(occ.every((o) => o.expected === 5650)).toBe(true);
});

test("a line whose cadence equals the cycle is a single occurrence at the native amount", () => {
  const occ = reconcileOccurrences(
    "quarterly",
    49200,
    16400,
    "quarterly",
    new Date(2026, 0, 1),
    new Date(2026, 3, 1),
  );
  expect(occ.length).toBe(1);
  expect(occ[0].expected).toBe(49200);
});

test("a yearly line in a quarterly cycle falls back to one accrued per-cycle amount", () => {
  // monthly-equivalent of a €1,200/yr fee is €100/mo -> €300/qtr accrued.
  const occ = reconcileOccurrences(
    "yearly",
    1200,
    100,
    "quarterly",
    new Date(2026, 0, 1),
    new Date(2026, 3, 1),
  );
  expect(occ.length).toBe(1);
  expect(occ[0].expected).toBe(300);
});

test("a weekly line enumerates every week inside the cycle", () => {
  const occ = reconcileOccurrences(
    "weekly",
    100,
    433.33,
    "monthly",
    new Date(2026, 2, 1),
    new Date(2026, 3, 1),
  );
  // Mar 1, 8, 15, 22, 29 (next is Apr 5, past the end).
  expect(occ.length).toBe(5);
  expect(occ.every((o) => o.expected === 100)).toBe(true);
});

test("monthly line in a monthly cycle is a single flat occurrence", () => {
  const occ = reconcileOccurrences(
    "monthly",
    800,
    800,
    "monthly",
    new Date(2026, 5, 1),
    new Date(2026, 6, 1),
  );
  expect(occ.length).toBe(1);
  expect(occ[0].expected).toBe(800);
});

test("stepCadence advances by the right period", () => {
  expect(ymd(stepCadence(new Date(2026, 0, 1), "weekly"))).toBe("2026-01-08");
  expect(ymd(stepCadence(new Date(2026, 0, 1), "fortnightly"))).toBe("2026-01-15");
  expect(ymd(stepCadence(new Date(2026, 0, 31), "monthly"))).toBe("2026-03-03"); // JS month rollover
  expect(ymd(stepCadence(new Date(2026, 0, 1), "quarterly"))).toBe("2026-04-01");
  expect(ymd(stepCadence(new Date(2026, 0, 1), "yearly"))).toBe("2027-01-01");
});
