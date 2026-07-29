// Run with: bun test src/lib/intent.test.ts
import { test, expect } from "bun:test";
import {
  defaultIntentForCategory,
  resolveIntent,
  isDiscretionary,
  summariseIntent,
} from "./intent";

test("category defaults: necessities essential, discretionary slides down, unknown is neutral", () => {
  expect(defaultIntentForCategory("groceries")).toBe("essential");
  expect(defaultIntentForCategory("Utilities")).toBe("essential"); // case-insensitive
  expect(defaultIntentForCategory("  Health  ")).toBe("essential"); // trimmed
  expect(defaultIntentForCategory("insurance")).toBe("important");
  expect(defaultIntentForCategory("subscriptions")).toBe("nice_to_have");
  expect(defaultIntentForCategory("travel")).toBe("treat");
  expect(defaultIntentForCategory("mystery")).toBe("nice_to_have"); // unknown -> neutral middle
  expect(defaultIntentForCategory(null)).toBe("nice_to_have");
  expect(defaultIntentForCategory(undefined)).toBe("nice_to_have");
});

test("resolveIntent prefers an explicit tag; invalid tags fall back to the category default", () => {
  expect(resolveIntent({ intent: "treat", category: "groceries" })).toBe("treat");
  expect(resolveIntent({ category: "groceries" })).toBe("essential");
  expect(resolveIntent({ intent: "bogus", category: "travel" })).toBe("treat"); // invalid -> default
  expect(resolveIntent({ intent: null, category: null })).toBe("nice_to_have");
});

test("isDiscretionary is nice_to_have + treat only", () => {
  expect(isDiscretionary("nice_to_have")).toBe(true);
  expect(isDiscretionary("treat")).toBe(true);
  expect(isDiscretionary("essential")).toBe(false);
  expect(isDiscretionary("important")).toBe(false);
});

test("summariseIntent aggregates by level, counts treats, and computes discretionary share", () => {
  const s = summariseIntent([
    { amount: 100, category: "groceries" }, // essential 100
    { amount: 50, category: "dining" }, // nice_to_have 50
    { amount: 50, intent: "treat", category: "groceries" }, // treat 50 (tag overrides category)
    { amount: 0, category: "travel" }, // ignored (amount <= 0)
    { amount: "20", category: "travel" }, // treat 20 (string amount coerced)
  ]);
  expect(s.total).toBe(220);
  expect(s.byLevel.essential).toBe(100);
  expect(s.byLevel.nice_to_have).toBe(50);
  expect(s.byLevel.treat).toBe(70);
  expect(s.discretionary).toBe(120);
  expect(s.treat).toBe(70);
  expect(s.discretionaryCount).toBe(3);
  expect(s.treatCount).toBe(2);
  expect(s.discretionarySharePct).toBe(54.5); // 120/220
});

test("summariseIntent handles empty input without dividing by zero", () => {
  const s = summariseIntent([]);
  expect(s.total).toBe(0);
  expect(s.discretionary).toBe(0);
  expect(s.discretionarySharePct).toBe(0);
  expect(s.treatCount).toBe(0);
});
