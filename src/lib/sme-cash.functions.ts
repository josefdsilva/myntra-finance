import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatherRunwayReceivables, type RunwayReceivables } from "@/lib/sme-cash.server";

export type { RunwayReceivables };

/** Everything the SME runway + receivables card needs, computed server-side. */
export const getRunwayReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(({ context, data }): Promise<RunwayReceivables> =>
    gatherRunwayReceivables(context.supabase, data.household_id),
  );

/** Set or clear the manual cash-on-hand override for a space. */
export const setCashOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        amount: z.number().min(0).max(1_000_000_000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("households")
      .update({
        cash_on_hand_override: data.amount,
        cash_on_hand_override_at: data.amount == null ? null : new Date().toISOString(),
      })
      .eq("id", data.household_id);
    if (error) throw error;
    return { ok: true };
  });
