import { describe, it, expect } from "bun:test";
import { computeRunway, resolveCashOnHand, type RunwayResult } from "./runway";
import { ageReceivables, dueDateFor, type ReceivablePlan, type ReceivablesResult } from "./receivables";
import { smeSignals } from "./sme-signals";
import { moneyFormatter } from "./coach-signals";

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

describe("smeSignals", () => {
  const M = moneyFormatter("EUR");

  function runwayR(months: number | null, burn = 3000): RunwayResult {
    if (months == null) {
      return { cashOnHand: 10000, monthlyBurn: 0, cashFlowPositive: true, months: null, severity: "ok" };
    }
    return {
      cashOnHand: months * burn,
      monthlyBurn: burn,
      cashFlowPositive: false,
      months,
      severity: months < 1 ? "critical" : months < 3 ? "warn" : "ok",
    };
  }

  function recv(overdueTotal: number): ReceivablesResult {
    const items =
      overdueTotal > 0
        ? [
            {
              id: "1",
              label: "Acme invoice",
              amount: overdueTotal,
              dueDate: "2026-06-30",
              daysOverdue: 46,
              bucket: "d31_60" as const,
            },
          ]
        : [];
    return { items, total: overdueTotal, overdueTotal, buckets: {} as ReceivablesResult["buckets"] };
  }

  it("is critical under 1 month of runway", () => {
    const s = smeSignals({ runway: runwayR(0.5), receivables: recv(0), money: M, periodKey: "2026-08" });
    const r = s.find((x) => x.kind === "runway_warning");
    expect(r?.severity).toBe("critical");
    expect(r?.dedupeKey).toContain("runway_warning:1:");
  });

  it("warns under 3 months of runway", () => {
    const s = smeSignals({ runway: runwayR(2.5), receivables: recv(0), money: M, periodKey: "2026-08" });
    const r = s.find((x) => x.kind === "runway_warning");
    expect(r?.severity).toBe("warn");
    expect(r?.dedupeKey).toContain("runway_warning:3:");
  });

  it("stays quiet when cash-flow positive", () => {
    const s = smeSignals({ runway: runwayR(null), receivables: recv(0), money: M, periodKey: "2026-08" });
    expect(s.find((x) => x.kind === "runway_warning")).toBeUndefined();
  });

  it("nudges on overdue receivables with a drafted follow-up", () => {
    const s = smeSignals({ runway: runwayR(null), receivables: recv(900), money: M, periodKey: "2026-08" });
    const r = s.find((x) => x.kind === "receivables_overdue");
    expect(r).toBeTruthy();
    expect((r?.data as { draft?: string })?.draft).toContain("Acme invoice");
  });

  it("no receivables nudge when nothing is overdue", () => {
    const s = smeSignals({ runway: runwayR(null), receivables: recv(0), money: M, periodKey: "2026-08" });
    expect(s.find((x) => x.kind === "receivables_overdue")).toBeUndefined();
  });
});
