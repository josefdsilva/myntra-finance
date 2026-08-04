import { createFileRoute } from "@tanstack/react-router";

// Daily SME early-warning pass: runway warnings (3 / 2 / 1 months) and overdue
// receivable nudges, emitted through the same coach inbox funnel as the
// household nudges. Idempotent via period-scoped dedupe keys, so an unresolved
// warning re-surfaces once a month rather than every day.
export const Route = createFileRoute("/api/public/hooks/coach-business-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { emitCoachMessage } = await import("@/lib/coach-messages.server");
        const { gatherRunwayReceivables } = await import("@/lib/sme-cash.server");
        const { smeSignals } = await import("@/lib/sme-signals");
        const { moneyFormatter } = await import("@/lib/coach-signals");

        const { data: households } = await supabaseAdmin
          .from("households")
          .select("id, kind, currency")
          .eq("kind", "business");
        const list =
          (households as Array<{ id: string; kind: string | null; currency: string | null }> | null) ??
          [];

        const periodKey = new Date().toISOString().slice(0, 7);
        let emitted = 0;

        for (const hh of list) {
          let picture;
          try {
            picture = await gatherRunwayReceivables(supabaseAdmin, hh.id);
          } catch (e) {
            console.error("coach-business-daily gather failed", hh.id, e);
            continue;
          }

          const signals = smeSignals({
            runway: picture.runway,
            receivables: picture.receivables,
            money: moneyFormatter(hh.currency),
            periodKey,
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
              data: s.data,
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
