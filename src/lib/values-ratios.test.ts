// Run with: bun test src/lib/values-ratios.test.ts
import { describe, expect, it } from "bun:test";
import { valuesRatios, bucketServesValues } from "./values-ratios";
import type { HouseholdValue } from "./values";

const family: HouseholdValue[] = [{ key: "family" }, { key: "travel" }];

describe("valuesRatios", () => {
  it("is unset without values", () => {
    const r = valuesRatios({ expenses: [], values: [], income: 1000, buckets: [] });
    expect(r.unset).toBe(true);
    expect(r.grade).toBe("unset");
  });

  it("splits flexible spend into aligned and drifting", () => {
    const r = valuesRatios({
      expenses: [
        { amount: 100, category: "travel", kind: "expense" },
        { amount: 300, category: "shopping", kind: "expense" },
        { amount: 800, category: "rent", kind: "expense" },
      ],
      values: family,
      income: 2000,
      buckets: [],
    });
    expect(r.align.aligned).toBe(100);
    expect(r.drift).toBe(300);
    expect(r.alignmentPct).toBe(25);
    expect(r.driftPct).toBe(15);
    expect(r.grade).toBe("off_course");
  });

  it("counts funding of value-serving buckets and grades on course", () => {
    const r = valuesRatios({
      expenses: [
        { amount: 300, category: "travel", kind: "expense" },
        { amount: 100, category: "shopping", kind: "expense" },
      ],
      values: family,
      income: 2000,
      buckets: [
        { id: "b1", name: "Family holiday", balance: 500, fundedThisCycle: 200, target: 2000 },
        { id: "b2", name: "Random", balance: 0, fundedThisCycle: 50 },
      ],
    });
    expect(r.dreamFunded).toBe(200);
    expect(r.savedTotal).toBe(250);
    expect(r.dreamFundingPct).toBe(10);
    expect(r.driftPerDreamEuro).toBe(0.5);
    expect(r.grade).toBe("on_course");
  });

  it("suggests redirecting half the drift to the dream that lands soonest", () => {
    const r = valuesRatios({
      expenses: [{ amount: 400, category: "shopping", kind: "expense" }],
      values: family,
      income: 2000,
      buckets: [
        {
          id: "b1",
          name: "Family holiday",
          balance: 400,
          fundedThisCycle: 100,
          monthlyPace: 100,
          target: 1000,
        },
      ],
    });
    expect(r.redirect?.redirect).toBe(200);
    expect(r.redirect?.monthsNow).toBe(6);
    expect(r.redirect?.monthsAfter).toBe(2);
    expect(r.redirect?.monthsSaved).toBe(4);
  });

  it("maps emergency and investment buckets by kind", () => {
    expect(bucketServesValues([{ key: "security" }], { name: "Buffer", kind: "emergency" })).toBe(true);
    expect(bucketServesValues([{ key: "investing" }], { name: "ETF", kind: "investment" })).toBe(true);
    expect(bucketServesValues([{ key: "family" }], { name: "ETF", kind: "investment" })).toBe(false);
  });
});

describe("essentials and commitments", () => {
  const values: HouseholdValue[] = [{ key: "family" }, { key: "security" }];

  it("counts a dinner labelled with a child's name as family time", () => {
    const r = valuesRatios({
      expenses: [
        { amount: 60, category: "dining", labels: ["Óscar birthday"] },
        { amount: 40, category: "dining" },
      ],
      values,
      income: 1000,
      buckets: [],
      personNames: ["Oscar da Silva"],
    });
    expect(r.align.aligned).toBe(60);
    expect(r.align.offValues).toBe(40);
  });

  it("shows kindergarten as family money without double counting it", () => {
    const r = valuesRatios({
      expenses: [{ amount: 300, category: "childcare" }],
      values,
      income: 2000,
      buckets: [],
      recurring: [{ label: "Kindergarten", category: "childcare", monthly_amount: 400 }],
    });
    // Essentials never drift.
    expect(r.drift).toBe(0);
    expect(r.commitments.total).toBe(400);
    // max(recorded 300, committed 400) — not 700.
    expect(r.valueSpend).toBe(400);
    expect(r.valueTotals[0]).toEqual({ key: "family", amount: 400 });
  });

  it("flags essentials above plan instead of calling them drift", () => {
    const r = valuesRatios({
      expenses: [
        { amount: 620, category: "groceries" },
        { amount: 100, category: "utilities" },
      ],
      values,
      income: 2000,
      buckets: [],
      plannedByCategory: [
        { category: "Groceries", amount: 450 },
        { category: "utilities", amount: 120 },
      ],
    });
    expect(r.drift).toBe(0);
    expect(r.room.total).toBe(170);
    expect(r.room.items).toEqual([
      { category: "groceries", actual: 620, planned: 450, over: 170 },
    ]);
  });

  it("says nothing about essentials with no plan to compare against", () => {
    const r = valuesRatios({
      expenses: [{ amount: 300, category: "groceries" }],
      values,
      income: 1000,
      buckets: [],
    });
    expect(r.room.total).toBe(0);
    expect(r.room.items).toEqual([]);
  });
});
