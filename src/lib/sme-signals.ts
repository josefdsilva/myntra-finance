import type { Signal, Money } from "./coach-signals";
import type { RunwayResult } from "./runway";
import type { ReceivablesResult } from "./receivables";

// Pure SME early-warning rules: runway warnings and overdue-receivable nudges.
// Period-scoped dedupe keys (YYYY-MM) so an unresolved warning re-surfaces once
// a month rather than every day or never again.

export function smeSignals(p: {
  runway: RunwayResult;
  receivables: ReceivablesResult;
  money: Money;
  periodKey: string; // YYYY-MM
}): Signal[] {
  const { runway, receivables, money, periodKey } = p;
  const out: Signal[] = [];

  // --- Runway warning at 3 / 2 / 1 months ---
  if (!runway.cashFlowPositive && runway.months != null) {
    const m = runway.months;
    const level = m < 1 ? 1 : m < 2 ? 2 : m < 3 ? 3 : null;
    if (level != null) {
      let body = `About ${m.toFixed(1)} months of cash at ${money(
        runway.monthlyBurn,
      )} net burn per month.`;
      if (receivables.overdueTotal > 0 && runway.monthlyBurn > 0) {
        const extend = receivables.overdueTotal / runway.monthlyBurn;
        body += ` Collecting the ${money(receivables.overdueTotal)} you are owed would add about ${extend.toFixed(
          1,
        )} months.`;
      }
      out.push({
        kind: "runway_warning",
        severity: m < 1 ? "critical" : "warn",
        title: level === 1 ? "Runway under 1 month" : `Runway under ${level} months`,
        body,
        actionLabel: "Open cashflow",
        actionUrl: "/cashflow",
        dedupeKey: `runway_warning:${level}:${periodKey}`,
      });
    }
  }

  // --- Overdue receivables (consolidated, once per month) ---
  if (receivables.overdueTotal > 0) {
    const overdue = receivables.items.filter((i) => i.daysOverdue > 0);
    const oldest = overdue[0]; // items are sorted most-overdue first
    const draft = oldest
      ? `Hi, a friendly reminder that ${oldest.label} for ${money(
          oldest.amount,
        )} was due on ${oldest.dueDate} and appears outstanding. Could you share the expected payment date? Thank you.`
      : undefined;
    out.push({
      kind: "receivables_overdue",
      severity: "warn",
      title: `${money(receivables.overdueTotal)} in overdue receivables`,
      body:
        overdue.length === 1 && oldest
          ? `${oldest.label} is ${oldest.daysOverdue} days overdue. A quick nudge often gets it paid.`
          : `${overdue.length} payments are overdue${
              oldest ? `, the oldest by ${oldest.daysOverdue} days` : ""
            }. A quick nudge often gets them paid.`,
      actionLabel: "Review receivables",
      actionUrl: "/cashflow",
      data: draft ? { draft } : undefined,
      dedupeKey: `receivables_overdue:${periodKey}`,
    });
  }

  return out;
}
