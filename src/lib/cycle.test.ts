// Run with: bun test src/lib/cycle.test.ts
import { test, expect } from "bun:test";
import { computeCycle, buildCyclesFromSalaries } from "./cycle";

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
