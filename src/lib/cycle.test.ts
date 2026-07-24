// Run with: bun test src/lib/cycle.test.ts
import { test, expect } from "bun:test";
import {
  computeCycle,
  buildCyclesFromSalaries,
  computeTimeCycle,
  cycleFor,
} from "./cycle";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("computeCycle with no salaries falls back to the calendar month", () => {
  const now = new Date(2026, 2, 15); // 15 Mar 2026 (local)
  const c = computeCycle([], now);
  expect(c.source).toBe("calendar");
  expect(c.start.getTime()).toBe(new Date(2026, 2, 1).getTime());
  expect(c.end.getTime()).toBe(new Date(2026, 3, 1).getTime());
  expect(c.daysLeft).toBeGreaterThan(0);
});

test("computeCycle with a single salary predicts the next one a month later", () => {
  const now = new Date("2026-01-20T00:00:00.000Z");
  const c = computeCycle(["2026-01-05T00:00:00.000Z"], now);
  expect(c.source).toBe("salary");
  expect(c.predicted).toBe(true); // no second salary yet to confirm cadence
  expect(c.start.toISOString().slice(0, 10)).toBe("2026-01-05");
  expect(c.end.toISOString().slice(0, 10)).toBe("2026-02-05");
});

test("computeCycle uses the observed cadence when two salaries are ~monthly apart", () => {
  const c = computeCycle(
    ["2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
    new Date("2026-02-10T00:00:00.000Z"),
  );
  expect(c.predicted).toBe(false); // 31-day interval is in [20,45], so it's trusted
  expect(c.end.toISOString().slice(0, 10)).toBe("2026-03-04"); // last + 31 days
});

test("computeCycle ignores an implausible interval and defaults to monthly", () => {
  const c = computeCycle(
    ["2026-06-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"], // 151 days apart
    new Date("2026-06-05T00:00:00.000Z"),
  );
  expect(c.predicted).toBe(true);
  expect(c.end.toISOString().slice(0, 10)).toBe("2026-07-01");
});

test("buildCyclesFromSalaries closes every cycle except the last", () => {
  const spans = buildCyclesFromSalaries([
    "2026-01-01T00:00:00.000Z",
    "2026-02-01T00:00:00.000Z",
    "2026-03-01T00:00:00.000Z",
  ]);
  expect(spans.length).toBe(3);
  expect(spans[0].predicted).toBe(false);
  expect(spans[1].predicted).toBe(false);
  expect(spans[2].predicted).toBe(true);
  // A closed cycle ends exactly where the next one starts.
  expect(spans[0].end.getTime()).toBe(spans[1].start.getTime());
  expect(spans[1].end.getTime()).toBe(spans[2].start.getTime());
});

test("buildCyclesFromSalaries returns nothing without salaries", () => {
  expect(buildCyclesFromSalaries([]).length).toBe(0);
});

// --- time-driven cycles -----------------------------------------------------

test("time monthly on the plain calendar spans the current month", () => {
  const c = computeTimeCycle("monthly", null, new Date(2026, 2, 15)); // 15 Mar
  expect(c.source).toBe("time");
  expect(c.predicted).toBe(false);
  expect(ymd(c.start)).toBe("2026-03-01");
  expect(ymd(c.end)).toBe("2026-04-01");
});

test("time quarterly on the plain calendar uses calendar quarters", () => {
  const c = computeTimeCycle("quarterly", null, new Date(2026, 4, 10)); // 10 May
  expect(ymd(c.start)).toBe("2026-04-01"); // Apr–Jun
  expect(ymd(c.end)).toBe("2026-07-01");
});

test("time quarterly with an April fiscal start shifts the quarter boundaries", () => {
  // Fiscal year starts 1 Apr → quarters Apr–Jun / Jul–Sep / Oct–Dec / Jan–Mar.
  const q4 = computeTimeCycle("quarterly", "2024-04-01", new Date(2026, 0, 10)); // 10 Jan
  expect(ymd(q4.start)).toBe("2026-01-01"); // Jan–Mar is the fiscal Q4
  expect(ymd(q4.end)).toBe("2026-04-01");

  const q1 = computeTimeCycle("quarterly", "2024-04-01", new Date(2026, 4, 10)); // 10 May
  expect(ymd(q1.start)).toBe("2026-04-01"); // Apr–Jun is fiscal Q1
  expect(ymd(q1.end)).toBe("2026-07-01");
});

test("time yearly with an April fiscal start runs Apr–Mar", () => {
  const c = computeTimeCycle("yearly", "2024-04-01", new Date(2026, 1, 10)); // 10 Feb 2026
  expect(ymd(c.start)).toBe("2025-04-01");
  expect(ymd(c.end)).toBe("2026-04-01");
});

test("time monthly with a mid-month anchor day rolls on that day", () => {
  // Anchor day 15: a period runs the 15th → the 15th.
  const before = computeTimeCycle("monthly", "2024-01-15", new Date(2026, 2, 10)); // 10 Mar
  expect(ymd(before.start)).toBe("2026-02-15");
  expect(ymd(before.end)).toBe("2026-03-15");

  const after = computeTimeCycle("monthly", "2024-01-15", new Date(2026, 2, 20)); // 20 Mar
  expect(ymd(after.start)).toBe("2026-03-15");
  expect(ymd(after.end)).toBe("2026-04-15");
});

test("time weekly anchors on the anchor's weekday (default Monday)", () => {
  // Default anchor 2024-01-01 is a Monday. 2026-03-18 is a Wednesday.
  const c = computeTimeCycle("weekly", null, new Date(2026, 2, 18));
  expect(c.start.getDay()).toBe(1); // Monday
  expect(ymd(c.start)).toBe("2026-03-16");
  expect(ymd(c.end)).toBe("2026-03-23");
  expect(c.daysTotal).toBe(7);
});

test("cycleFor routes by mode", () => {
  const now = new Date(2026, 2, 15);
  const timed = cycleFor({ mode: "time", length: "monthly" }, [], now);
  expect(timed.source).toBe("time");

  const evented = cycleFor(
    { mode: "event", length: "monthly" },
    ["2026-03-05T00:00:00.000Z"],
    now,
  );
  expect(evented.source).toBe("salary");
});
