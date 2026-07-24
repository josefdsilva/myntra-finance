// Run with: bun test src/lib/cadence.test.ts
import { test, expect } from "bun:test";
import { reconcileOccurrences, stepCadence } from "./cadence";

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
