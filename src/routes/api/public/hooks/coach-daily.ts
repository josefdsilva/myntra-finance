import { createFileRoute } from "@tanstack/react-router";
import type { PlanRow, CycleMetric, Signal } from "@/lib/coach-signals";

// Daily coach pass for household nudges that are not tied to overspending:
// end-of-cycle recap, milestone wins, and upcoming cost reminders. Idempotent
// via the inbox dedupe key, so the exact firing time does not matter.
export const Route = createFileRoute("/api/public/hooks/coach-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { emitCoachMessage } = await import("@/lib/coach-messages.server");
        const { costReminderSignals, recapSignal, milestoneSignals, moneyFormatter } = await import(
          "@/lib/coach-signals"
        );

        const { data: households } = await supabaseAdmin
          .from("households")
          .select("id, kind, currency");
        const list =
          (households as Array<{ id: string; kind: string | null; currency: string | null }> | null) ??
          [];

        const now = new Date();
        let emitted = 0;

        for (const hh of list) {
          // Household reminders here; business runway/receivables are a separate pass.
          if (hh.kind === "business") continue;
          const money = moneyFormatter(hh.currency);

          const emit = async (s: Signal, cycleStart?: string) => {
            const r = await emitCoachMessage(supabaseAdmin, {
              householdId: hh.id,
              userId: null,
              kind: s.kind,
              severity: s.severity,
              title: s.title,
              body: s.body,
              actionLabel: s.actionLabel,
              actionUrl: s.actionUrl,
              cycleStart: cycleStart ?? null,
              dedupeKey: s.dedupeKey,
            });
            if (r.created) emitted++;
          };

          // --- Upcoming cost reminders (from Plans) ---
          const { data: plans } = await supabaseAdmin
            .from("plans")
            .select("id, label, amount, month, direction, recurrence, done, bucket_id")
            .eq("household_id", hh.id)
            .eq("done", false);
          for (const s of costReminderSignals({
            plans: ((plans as PlanRow[] | null) ?? []),
            now,
            money,
          })) {
            await emit(s);
          }

          // --- Recap + milestones (from per-cycle history) ---
          const { data: cmRows } = await supabaseAdmin
            .from("cycle_metrics" as never)
            .select(
              "cycle_start, cycle_end, income_actual, spend_actual, surplus_actual, everyday_pool, everyday_spent, score_overall",
            )
            .eq("household_id", hh.id)
            .order("cycle_start", { ascending: false })
            .limit(12);
          const series: CycleMetric[] = (
            (cmRows as Array<Record<string, unknown>> | null) ?? []
          )
            .map((r) => ({
              cycle_start: String(r.cycle_start),
              cycle_end: String(r.cycle_end),
              income_actual: Number(r.income_actual) || 0,
              spend_actual: Number(r.spend_actual) || 0,
              surplus_actual: Number(r.surplus_actual) || 0,
              everyday_pool: Number(r.everyday_pool) || 0,
              everyday_spent: Number(r.everyday_spent) || 0,
              score_overall: r.score_overall == null ? null : Number(r.score_overall),
            }))
            .reverse(); // now ascending, latest last

          if (series.length > 0) {
            const latest = series[series.length - 1];
            const prev = series.length >= 2 ? series[series.length - 2] : null;
            // Only recap a cycle that closed recently, so a fresh install does
            // not surface a recap for ancient history.
            const closedDaysAgo =
              (now.getTime() - new Date(latest.cycle_end).getTime()) / 86_400_000;
            if (closedDaysAgo >= 0 && closedDaysAgo <= 12) {
              await emit(recapSignal({ latest, prev, money }), latest.cycle_start);
            }
            for (const s of milestoneSignals({ series })) {
              await emit(s, latest.cycle_start);
            }
          }
        }

        return Response.json({ emitted });
      },
    },
  },
});
