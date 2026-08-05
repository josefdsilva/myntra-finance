import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CoachHousehold } from "@/lib/coach-runner.server";

/**
 * Runs the daily coach pass for one space, "at 8am in the user's timezone",
 * driven by the client on app open instead of an external cron. The client
 * passes its local date and hour; we only run at/after 08:00 local and only
 * once per local day per space (guarded by households.coach_run_on).
 */
export const runDailyCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        local_hour: z.number().int().min(0).max(23),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    if (data.local_hour < 8) return { ran: false, reason: "before-8am" as const };

    // Authorisation + read in one step: RLS only returns the space to a member.
    const { data: hhRow } = await context.supabase
      .from("households")
      .select("*")
      .eq("id", data.household_id)
      .maybeSingle();
    if (!hhRow) return { ran: false, reason: "not-a-member" as const };
    const h = hhRow as unknown as Record<string, unknown>;

    if ((h.coach_run_on as string | null) === data.local_date) {
      return { ran: false, reason: "already-today" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCoachForHousehold } = await import("@/lib/coach-runner.server");

    // Stamp first so concurrent opens (other devices/members) do not double-run.
    await supabaseAdmin
      .from("households")
      .update({ coach_run_on: data.local_date })
      .eq("id", data.household_id);

    const hh: CoachHousehold = {
      id: String(h.id),
      kind: (h.kind as string | null) ?? null,
      currency: (h.currency as string | null) ?? null,
      baseline_budget: (h.baseline_budget as number | string | null) ?? null,
      cycle: (h.cycle as string | null) ?? null,
      cycle_mode: (h.cycle_mode as string | null) ?? null,
      cycle_anchor_date: (h.cycle_anchor_date as string | null) ?? null,
    };
    const emitted = await runCoachForHousehold(supabaseAdmin, hh, new Date());
    return { ran: true as const, emitted };
  });
