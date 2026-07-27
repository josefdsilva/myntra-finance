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
        period: z.string().date(), // cycle-start date (YYYY-MM-DD) or YYYY-MM-01
        amount: z.number().min(0),
        note: z.string().max(300).optional().nullable(),
        // Kept for compatibility. Funding is ALWAYS additive now: confirming can
        // never reduce or replace money already set aside for a period — a second
        // funding that lands on the same period key stacks on top rather than
        // overwriting it. (Previously "set" did a destructive upsert, so a prior
        // cycle's contribution sharing a period key was silently wiped.)
        mode: z.enum(["set", "add"]).optional().default("set"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // If a row already exists for this (household, bucket, period), add to it so
    // no previously-confirmed amount is ever lost; otherwise insert a fresh row.
    const { data: existing, error: exErr } = await context.supabase
      .from("bucket_allocations")
      .select("id, amount, note")
      .eq("household_id", data.household_id)
      .eq("bucket_id", data.bucket_id)
      .eq("period", data.period)
      .maybeSingle();
    if (exErr) throw exErr;

    if (existing) {
      const newAmount = Number(existing.amount) + Number(data.amount);
      const combinedNote = [existing.note, data.note].filter(Boolean).join(" · ") || null;
      const { data: row, error } = await context.supabase
        .from("bucket_allocations")
        .update({
          amount: newAmount,
          note: combinedNote,
          confirmed_by: context.userId,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }

    const { data: row, error } = await context.supabase
      .from("bucket_allocations")
      .insert({
        household_id: data.household_id,
        bucket_id: data.bucket_id,
        period: data.period,
        amount: data.amount,
        note: data.note ?? null,
        confirmed_by: context.userId,
        confirmed_at: new Date().toISOString(),
      })
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
