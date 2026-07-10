import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const confirmBucketAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        bucket_id: z.string().uuid(),
        period: z.string().date(), // YYYY-MM-01
        amount: z.number().min(0),
        note: z.string().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("bucket_allocations")
      .upsert(
        {
          household_id: data.household_id,
          bucket_id: data.bucket_id,
          period: data.period,
          amount: data.amount,
          note: data.note ?? null,
          confirmed_by: context.userId,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: "household_id,bucket_id,period" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const undoBucketAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("bucket_allocations").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
