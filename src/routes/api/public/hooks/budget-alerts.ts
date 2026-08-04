import { createFileRoute } from "@tanstack/react-router";
import { fetchCycleBounds } from "@/lib/cycle-bounds";
import { sumMonthly } from "@/lib/finance-helpers";

// Mid-cycle drift alerts. Runs often; every emit is idempotent via the coach
// inbox dedupe key, so re-runs never double-post. The inbox is the default home
// (household-wide message); web push / email amplify per each member's prefs.
export const Route = createFileRoute("/api/public/hooks/budget-alerts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { emitCoachMessage } = await import("@/lib/coach-messages.server");
        const { driftSignals, moneyFormatter } = await import("@/lib/coach-signals");

        const { data: households } = await supabaseAdmin
          .from("households")
          .select("id, baseline_budget, kind, currency, cycle, cycle_mode, cycle_anchor_date");
        const list =
          (households as Array<{
            id: string;
            baseline_budget: number | string | null;
            kind: string | null;
            currency: string | null;
            cycle: string | null;
            cycle_mode: string | null;
            cycle_anchor_date: string | null;
          }> | null) ?? [];

        let emitted = 0;
        for (const hh of list) {
          // Households only here; businesses get runway/receivable warnings.
          if (hh.kind === "business") continue;
          const baseline = Number(hh.baseline_budget ?? 0);
          if (baseline <= 0) continue;

          const cycle = await fetchCycleBounds(supabaseAdmin, hh.id, hh);

          const [{ data: fixed }, { data: debts }] = await Promise.all([
            supabaseAdmin.from("fixed_expenses").select("monthly_amount").eq("household_id", hh.id),
            supabaseAdmin.from("debts").select("monthly_amount").eq("household_id", hh.id),
          ]);
          const fixedTotal = sumMonthly(fixed) + sumMonthly(debts);
          const variablePool = Math.max(0, baseline - fixedTotal);

          const { data: cycleExp } = await supabaseAdmin
            .from("expenses")
            .select("amount, kind, is_salary")
            .eq("household_id", hh.id)
            .gte("occurred_at", cycle.start.toISOString())
            .lt("occurred_at", cycle.end.toISOString());
          type Row = { amount: number | string; kind: string; is_salary: boolean };
          const rows = (cycleExp as Row[] | null) ?? [];
          const spent = rows
            .filter((r) => r.kind !== "income")
            .reduce((s, r) => s + Number(r.amount), 0);
          const received = rows
            .filter((r) => r.kind === "income" && !r.is_salary)
            .reduce((s, r) => s + Number(r.amount), 0);
          const netSpent = Math.max(0, spent - received);
          const baselineRatio =
            variablePool > 0 ? netSpent / variablePool : netSpent > 0 ? 1 : 0;

          const { data: incomes } = await supabaseAdmin
            .from("incomes")
            .select("monthly_amount")
            .eq("household_id", hh.id);
          const income = (
            (incomes as Array<{ monthly_amount: number | string }> | null) ?? []
          ).reduce((s, r) => s + Number(r.monthly_amount), 0);
          const surplus = Math.max(0, income - baseline);
          const overspend = Math.max(0, netSpent - variablePool);
          const emergencyRatio = surplus > 0 ? overspend / surplus : overspend > 0 ? 1 : 0;

          const cycleKey = cycle.start.toISOString().slice(0, 10);
          const signals = driftSignals({
            cycleKey,
            netSpent,
            variablePool,
            baselineRatio,
            surplus,
            overspend,
            emergencyRatio,
            money: moneyFormatter(hh.currency),
          });

          for (const s of signals) {
            const r = await emitCoachMessage(supabaseAdmin, {
              householdId: hh.id,
              userId: null,
              kind: s.kind,
              severity: s.severity,
              title: s.title,
              body: s.body,
              actionLabel: s.actionLabel,
              actionUrl: s.actionUrl,
              cycleStart: cycleKey,
              dedupeKey: s.dedupeKey,
            });
            if (r.created) emitted++;
          }
        }

        return Response.json({ emitted });
      },
    },
  },
});
