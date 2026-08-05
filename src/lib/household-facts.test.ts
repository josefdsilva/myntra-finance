import { describe, it, expect } from "bun:test";
import { deriveCycleFacts } from "./household-facts";

describe("deriveCycleFacts", () => {
  it("computes the everyday pool as baseline minus fixed commitments", () => {
    const f = deriveCycleFacts({ baseline: 2000, fixedTotal: 1200, monthlyIncome: 3000, netSpent: 0 });
    expect(f.variablePool).toBe(800);
  });

  it("floors the pool at zero when fixed exceeds baseline", () => {
    const f = deriveCycleFacts({ baseline: 1000, fixedTotal: 1500, monthlyIncome: 2000, netSpent: 0 });
    expect(f.variablePool).toBe(0);
  });

  it("derives the baseline ratio from net spend", () => {
    const f = deriveCycleFacts({ baseline: 2000, fixedTotal: 1000, monthlyIncome: 3000, netSpent: 500 });
    expect(f.variablePool).toBe(1000);
    expect(f.baselineRatio).toBe(0.5);
    expect(f.overspend).toBe(0);
    expect(f.emergencyRatio).toBe(0);
  });

  it("computes surplus, overspend and emergency erosion when overspending", () => {
    const f = deriveCycleFacts({ baseline: 2000, fixedTotal: 1000, monthlyIncome: 3000, netSpent: 1200 });
    expect(f.surplus).toBe(1000); // 3000 - 2000
    expect(f.overspend).toBe(200); // 1200 - 1000 pool
    expect(f.emergencyRatio).toBe(0.2); // 200 / 1000 surplus
    expect(f.baselineRatio).toBe(1.2);
  });

  it("treats any spend as fully over budget when there is no pool", () => {
    const f = deriveCycleFacts({ baseline: 0, fixedTotal: 0, monthlyIncome: 2000, netSpent: 300 });
    expect(f.variablePool).toBe(0);
    expect(f.baselineRatio).toBe(1);
  });

  it("has no surplus when income does not exceed the baseline", () => {
    const f = deriveCycleFacts({ baseline: 2500, fixedTotal: 1000, monthlyIncome: 2000, netSpent: 0 });
    expect(f.surplus).toBe(0);
  });
});
