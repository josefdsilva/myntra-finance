import { createFileRoute } from "@tanstack/react-router";

// Optional server-side daily pass. The primary trigger is on app-open at 8am in
// the user's timezone (see runDailyCoach); this endpoint exists as a backup so a
// scheduler can run the coach for every space if desired. Both paths call the
// same shared runner, and every emit is idempotent.
export const Route = createFileRoute("/api/public/hooks/coach-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCoachForHousehold } = await import("@/lib/coach-runner.server");

        const { data: households } = await supabaseAdmin
          .from("households")
          .select("id, kind, currency, baseline_budget, cycle, cycle_mode, cycle_anchor_date");
        const list = (households as Array<Record<string, unknown>> | null) ?? [];

        const now = new Date();
        let emitted = 0;
        for (const h of list) {
          try {
            emitted += await runCoachForHousehold(
              supabaseAdmin,
              {
                id: String(h.id),
                kind: (h.kind as string | null) ?? null,
                currency: (h.currency as string | null) ?? null,
                baseline_budget: (h.baseline_budget as number | string | null) ?? null,
                cycle: (h.cycle as string | null) ?? null,
                cycle_mode: (h.cycle_mode as string | null) ?? null,
                cycle_anchor_date: (h.cycle_anchor_date as string | null) ?? null,
              },
              now,
            );
          } catch (e) {
            console.error("coach-daily failed for", h.id, e);
          }
        }
        return Response.json({ emitted });
      },
    },
  },
});
