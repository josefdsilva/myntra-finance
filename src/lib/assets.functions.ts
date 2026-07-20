import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSET_KINDS = [
  "property",
  "land",
  "vehicle",
  "stocks",
  "bonds",
  "fund",
  "business",
  "other",
] as const;

export const ASSET_LIQUIDITY = ["liquid", "semi_liquid", "illiquid"] as const;

/** Create or update an asset (a significant thing the household owns). */
export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        name: z.string().min(1).max(80),
        kind: z.enum(ASSET_KINDS).default("other"),
        acquired_value: z.number().min(0).max(1_000_000_000).nullable().optional(),
        acquired_on: z.string().date().nullable().optional(),
        current_value: z.number().min(0).max(1_000_000_000),
        liquidity: z.enum(ASSET_LIQUIDITY).default("semi_liquid"),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("assets")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("assets")
      .insert({ ...rest, created_by: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("assets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
