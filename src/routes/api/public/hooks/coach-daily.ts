import { createFileRoute } from "@tanstack/react-router";
import type { PlanRow } from "@/lib/coach-signals";

// Daily coach pass for household nudges that are not tied to overspending:
// upcoming cost reminders (from Plans) today, with cycle recaps and milestones
// to follow. Idempotent via the inbox dedupe key, so the exact firing time does
// not matter — a plan is reminded once per occurrence month.
export const Route = createFileRoute("/api/public/hooks/coach-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { emitCoachMessage } = await import("@/lib/coach-messages.server");
        const { costReminderSignals, moneyFormatter } = await import("@/lib/coach-signals");

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

          const { data: plans } = await supabaseAdmin
            .from("plans")
            .select("id, label, amount, month, direction, recurrence, done, bucket_id")
            .eq("household_id", hh.id)
            .eq("done", false);

          const signals = costReminderSignals({
            plans: ((plans as PlanRow[] | null) ?? []),
            now,
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
