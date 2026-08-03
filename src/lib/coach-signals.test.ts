import { describe, it, expect } from "vitest";
import {
  driftSignals,
  costReminderSignals,
  nextOccurrence,
  recapSignal,
  milestoneSignals,
  moneyFormatter,
  type PlanRow,
  type CycleMetric,
} from "./coach-signals";

const money = moneyFormatter("EUR");

describe("driftSignals", () => {
  const base = {
    cycleKey: "2026-08-01",
    netSpent: 0,
    variablePool: 1000,
    baselineRatio: 0,
    surplus: 500,
    overspend: 0,
    emergencyRatio: 0,
    money,
  };

  it("stays quiet below 80%", () => {
    expect(driftSignals({ ...base, netSpent: 700, baselineRatio: 0.7 })).toHaveLength(0);
  });

  it("warns at 80% of the everyday budget", () => {
    const s = driftSignals({ ...base, netSpent: 850, baselineRatio: 0.85 });
    expect(s.map((x) => x.kind)).toContain("baseline_warn");
    expect(s[0].severity).toBe("warn");
  });

  it("escalates to critical when the pool is spent", () => {
    const s = driftSignals({ ...base, netSpent: 1000, baselineRatio: 1 });
    expect(s.map((x) => x.kind)).toContain("baseline_reached");
    expect(s.find((x) => x.kind === "baseline_reached")!.severity).toBe("critical");
  });

  it("stays quiet on surplus until 80% eroded", () => {
    const s = driftSignals({
      ...base,
      netSpent: 1200,
      baselineRatio: 1.2,
      overspend: 200,
      surplus: 500,
      emergencyRatio: 0.4,
    });
    expect(s.map((x) => x.kind)).not.toContain("emergency_warn");
  });

  it("warns when overspend erodes 80%+ of surplus", () => {
    const s = driftSignals({
      ...base,
      netSpent: 1450,
      baselineRatio: 1.45,
      overspend: 450,
      surplus: 500,
      emergencyRatio: 0.9,
    });
    expect(s.map((x) => x.kind)).toContain("emergency_warn");
  });

  it("does not flag surplus erosion when there is no surplus", () => {
    const s = driftSignals({ ...base, surplus: 0, overspend: 300, emergencyRatio: 1 });
    expect(s.map((x) => x.kind)).not.toContain("emergency_depleted");
  });
});

describe("nextOccurrence", () => {
  const now = new Date("2026-08-15T00:00:00Z");
  it("returns the plan month for a one-off", () => {
    const p = plan({ month: "2026-09-01", recurrence: "one_off" });
    expect(nextOccurrence(p, now)!.toISOString().slice(0, 7)).toBe("2026-09");
  });
  it("rolls an annual plan to next year when this year's month has passed", () => {
    const p = plan({ month: "2026-03-01", recurrence: "annual" });
    expect(nextOccurrence(p, now)!.toISOString().slice(0, 7)).toBe("2027-03");
  });
  it("keeps an annual plan this year when its month is still ahead", () => {
    const p = plan({ month: "2026-12-01", recurrence: "annual" });
    expect(nextOccurrence(p, now)!.toISOString().slice(0, 7)).toBe("2026-12");
  });
  it("does not remind for ongoing plans", () => {
    expect(nextOccurrence(plan({ recurrence: "ongoing" }), now)).toBeNull();
  });
});

describe("costReminderSignals", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("reminds for an unfunded upcoming spend within the horizon", () => {
    const s = costReminderSignals({
      plans: [plan({ label: "Car service", amount: 600, month: "2026-09-01" })],
      now,
      money,
    });
    expect(s).toHaveLength(1);
    expect(s[0].kind).toBe("cost_reminder");
    expect(s[0].title).toContain("Car service");
  });

  it("skips plans that already have a funding project", () => {
    const s = costReminderSignals({
      plans: [plan({ month: "2026-09-01", bucket_id: "b1" })],
      now,
      money,
    });
    expect(s).toHaveLength(0);
  });

  it("skips done and income plans", () => {
    const s = costReminderSignals({
      plans: [
        plan({ month: "2026-09-01", done: true }),
        plan({ month: "2026-09-01", direction: "income" }),
      ],
      now,
      money,
    });
    expect(s).toHaveLength(0);
  });

  it("skips events beyond the horizon", () => {
    const s = costReminderSignals({
      plans: [plan({ month: "2027-01-01" })],
      now,
      money,
    });
    expect(s).toHaveLength(0);
  });
});

describe("recapSignal", () => {
  it("nudges to deploy a positive surplus", () => {
    const s = recapSignal({
      latest: cm({ surplus_actual: 300, everyday_spent: 800, everyday_pool: 1000 }),
      prev: null,
      money,
    });
    expect(s.kind).toBe("cycle_recap");
    expect(s.severity).toBe("success");
    expect(s.body).toContain("ahead");
  });

  it("warns when the everyday budget was overspent", () => {
    const s = recapSignal({
      latest: cm({ surplus_actual: 0, everyday_spent: 1100, everyday_pool: 1000 }),
      prev: null,
      money,
    });
    expect(s.severity).toBe("warn");
    expect(s.body).toContain("over your everyday budget");
  });

  it("includes a score delta when both cycles have a score", () => {
    const s = recapSignal({
      latest: cm({ score_overall: 74 }),
      prev: cm({ score_overall: 70 }),
      money,
    });
    expect(s.body).toContain("74");
    expect(s.body).toContain("+4");
  });
});

describe("milestoneSignals", () => {
  it("celebrates a score jump of 4+", () => {
    const out = milestoneSignals({
      series: [cm({ score_overall: 68 }), cm({ score_overall: 73 })],
    });
    expect(out.map((s) => s.kind)).toContain("milestone_score");
  });

  it("celebrates a 3+ cycle positive-surplus streak", () => {
    const out = milestoneSignals({
      series: [
        cm({ surplus_actual: 10 }),
        cm({ surplus_actual: 20 }),
        cm({ surplus_actual: 5 }),
      ],
    });
    expect(out.map((s) => s.kind)).toContain("milestone_streak");
  });

  it("breaks the streak on a negative cycle", () => {
    const out = milestoneSignals({
      series: [
        cm({ surplus_actual: 10 }),
        cm({ surplus_actual: 0 }),
        cm({ surplus_actual: 5 }),
      ],
    });
    expect(out.map((s) => s.kind)).not.toContain("milestone_streak");
  });
});

function cm(overrides: Partial<CycleMetric>): CycleMetric {
  return {
    cycle_start: "2026-08-01",
    cycle_end: "2026-08-31",
    income_actual: 3000,
    spend_actual: 2000,
    surplus_actual: 0,
    everyday_pool: 1000,
    everyday_spent: 900,
    score_overall: 70,
    ...overrides,
  };
}

function plan(overrides: Partial<PlanRow>): PlanRow {
  return {
    id: Math.random().toString(36).slice(2),
    label: "Something",
    amount: 100,
    month: "2026-09-01",
    direction: "spend",
    recurrence: "one_off",
    done: false,
    bucket_id: null,
    ...overrides,
  };
}
