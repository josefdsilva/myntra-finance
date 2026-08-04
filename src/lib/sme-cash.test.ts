import { describe, it, expect } from "vitest";
import { computeRunway, resolveCashOnHand } from "./runway";
import { ageReceivables, dueDateFor, type ReceivablePlan } from "./receivables";

describe("resolveCashOnHand", () => {
  it("prefers the manual override when set", () => {
    expect(resolveCashOnHand({ override: 5000, computed: 1200 })).toBe(5000);
    expect(resolveCashOnHand({ override: 0, computed: 1200 })).toBe(0); // 0 is a valid override
    expect(resolveCashOnHand({ override: null, computed: 1200 })).toBe(1200);
  });
});

describe("computeRunway", () => {
  it("is cash-flow positive when income covers outgoings", () => {
    const r = computeRunway({ cashOnHand: 10000, monthlyOutgoings: 4000, monthlyIncome: 5000 });
    expect(r.cashFlowPositive).toBe(true);
    expect(r.months).toBeNull();
    expect(r.severity).toBe("ok");
  });

  it("computes months of runway when burning", () => {
    const r = computeRunway({ cashOnHand: 12000, monthlyOutgoings: 5000, monthlyIncome: 2000 });
    expect(r.monthlyBurn).toBe(3000);
    expect(r.months).toBe(4);
    expect(r.severity).toBe("ok");
  });

  it("warns under 3 months", () => {
    const r = computeRunway({ cashOnHand: 5000, monthlyOutgoings: 5000, monthlyIncome: 3000 });
    expect(r.months).toBe(2.5);
    expect(r.severity).toBe("warn");
  });

  it("is critical under 1 month", () => {
    const r = computeRunway({ cashOnHand: 1500, monthlyOutgoings: 5000, monthlyIncome: 3000 });
    expect(r.severity).toBe("critical");
  });
});

describe("ageReceivables", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("marks a future payment as not due", () => {
    const r = ageReceivables([rp({ month: "2026-10-01" })], now);
    expect(r.items[0].bucket).toBe("not_due");
    expect(r.items[0].daysOverdue).toBe(0);
    expect(r.overdueTotal).toBe(0);
  });

  it("ages an overdue one-off into the right bucket", () => {
    // Due end of June (2026-06-30); ~46 days overdue on 2026-08-15.
    const r = ageReceivables([rp({ month: "2026-06-01", amount: 900 })], now);
    expect(r.items[0].bucket).toBe("d31_60");
    expect(r.overdueTotal).toBe(900);
  });

  it("skips received and ongoing plans", () => {
    const r = ageReceivables(
      [rp({ month: "2026-06-01", done: true }), rp({ month: "2026-06-01", recurrence: "ongoing" })],
      now,
    );
    expect(r.items).toHaveLength(0);
  });

  it("totals outstanding and overdue separately", () => {
    const r = ageReceivables(
      [rp({ month: "2026-10-01", amount: 500 }), rp({ month: "2026-05-01", amount: 300 })],
      now,
    );
    expect(r.total).toBe(800);
    expect(r.overdueTotal).toBe(300);
  });

  it("rolls an annual receivable to its next occurrence (always upcoming)", () => {
    const due = dueDateFor(rp({ month: "2026-03-01", recurrence: "annual" }), now);
    expect(due!.toISOString().slice(0, 7)).toBe("2027-03");
  });
});

function rp(overrides: Partial<ReceivablePlan>): ReceivablePlan {
  return {
    id: Math.random().toString(36).slice(2),
    label: "Client payment",
    amount: 1000,
    month: "2026-09-01",
    recurrence: "one_off",
    done: false,
    ...overrides,
  };
}
