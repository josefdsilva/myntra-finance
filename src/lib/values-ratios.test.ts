import { describe, expect, it } from "vitest";
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
