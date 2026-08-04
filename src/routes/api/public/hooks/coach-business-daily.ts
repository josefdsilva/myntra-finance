import { createFileRoute } from "@tanstack/react-router";

// Optional server-side daily pass for business spaces only. The primary trigger
// is on app-open (runDailyCoach); coach-daily also covers business spaces. This
// endpoint is a scoped backup and shares the same runner (idempotent emits).
export const Route = createFileRoute("/api/public/hooks/coach-business-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCoachForHousehold } = await import("@/lib/coach-runner.server");

        const { data: households } = await supabaseAdmin
          .from("households")
          .select("id, kind, currency, baseline_budget, cycle, cycle_mode, cycle_anchor_date")
          .eq("kind", "business");
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
            console.error("coach-business-daily failed for", h.id, e);
          }
        }
        return Response.json({ emitted });
      },
    },
  },
});
