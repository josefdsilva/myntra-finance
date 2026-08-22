// Run with: bun test src/lib/values.test.ts
import { test, expect } from "bun:test";
import {
  alignmentSummary,
  lifeStageOf,
  parseValues,
  resolveIntentWithValues,
  suggestProjects,
} from "./values";

test("parseValues keeps at most three, drops junk, keeps free text", () => {
  const v = parseValues([
    "travel",
    { key: "family" },
    { key: "other", text: "my band" },
    "nonsense",
    "health",
  ]);
  expect(v.map((x) => x.key)).toEqual(["travel", "family", "other"]);
  expect(v[2].text).toBe("my band");
});

test("a chosen value promotes its categories, the top value promotes twice", () => {
  const values = parseValues(["travel", "learning"]);
  // travel defaults to "treat"; as the #1 value it becomes essential
  expect(resolveIntentWithValues({ category: "travel" }, values)).toBe("essential");
  // learning is #2: education (essential already) stays essential
  expect(resolveIntentWithValues({ category: "courses" }, values)).toBe("important");
  // untouched category keeps its default
  expect(resolveIntentWithValues({ category: "dining" }, values)).toBe("nice_to_have");
  // a manual tag always wins
  expect(resolveIntentWithValues({ category: "travel", intent: "treat" }, values)).toBe("treat");
});

test("alignment counts only flexible spend and splits aligned vs off-values", () => {
  const values = parseValues(["family"]);
  const s = alignmentSummary(
    [
      { amount: 100, category: "groceries" }, // essential, ignored
      { amount: 60, category: "kids" }, // family → aligned
      { amount: 40, category: "dining" }, // off-values
      { amount: 500, category: "salary", kind: "income" }, // income, ignored
    ],
    values,
  );
  expect(s.flexible).toBe(100);
  expect(s.aligned).toBe(60);
  expect(s.offValues).toBe(40);
  expect(s.alignedPct).toBe(60);
  expect(s.leaks[0]).toEqual({ category: "dining", amount: 40 });
});

test("no values chosen means unset, never a bad score", () => {
  const s = alignmentSummary([{ amount: 40, category: "dining" }], []);
  expect(s.unset).toBe(true);
  expect(s.aligned).toBe(0);
});

test("life stage derives kids, dependants and years to retirement", () => {
  const stage = lifeStageOf([
    { age: 52, role: "employed" },
    { age: 49, role: "self_employed" },
    { age: 8, role: "child" },
    { age: 3, role: "child" },
  ]);
  expect(stage.dependants).toBe(2);
  expect(stage.youngestChildAge).toBe(3);
  expect(stage.yearsToRetirement).toBe(13);
  expect(stage.hasRetired).toBe(false);
});

test("suggestions follow the values, scale with surplus and skip existing names", () => {
  const values = parseValues(["travel", "family"]);
  const out = suggestProjects(values, { monthlySurplus: 400 });
  expect(out.length).toBeGreaterThan(1);
  expect(out.some((s) => s.nameKey === "values.project.travel")).toBe(true);
  const again = suggestProjects(values, {
    monthlySurplus: 400,
    existingNames: ["Next trip"],
  });
  expect(again.some((s) => s.nameKey === "values.project.travel")).toBe(false);
});
