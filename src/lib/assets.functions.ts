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

/**
 * Liquidity is a property of the asset type, not something the user judges per
 * item — tradable securities are liquid, a car sells in weeks, property and a
 * business take months. Derived here so it stays consistent everywhere.
 */
export function liquidityForKind(kind: string): (typeof ASSET_LIQUIDITY)[number] {
  switch (kind) {
    case "stocks":
    case "bonds":
    case "fund":
      return "liquid";
    case "vehicle":
      return "semi_liquid";
    case "property":
    case "land":
    case "business":
      return "illiquid";
    default:
      return "semi_liquid";
  }
}

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
        note: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    // Liquidity is always derived from the type — never trusted from the client.
    const payload = { ...rest, liquidity: liquidityForKind(rest.kind) };
    if (id) {
      const { data: row, error } = await context.supabase
        .from("assets")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("assets")
      .insert({ ...payload, created_by: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

/**
 * Set an asset's optional links: the rent income it generates, and/or the
 * investment project (bucket) that funds it. Passing null clears a link;
 * omitting a field leaves it unchanged. RLS ensures the caller owns the asset.
 */
export const setAssetLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        household_id: z.string().uuid(),
        income_id: z.string().uuid().nullable().optional(),
        bucket_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: { income_id?: string | null; bucket_id?: string | null } = {};
    if (data.income_id !== undefined) patch.income_id = data.income_id;
    if (data.bucket_id !== undefined) patch.bucket_id = data.bucket_id;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("assets")
      .update(patch)
      .eq("id", data.id)
      .eq("household_id", data.household_id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Link (or unlink) an investment project (bucket) to an asset. Linking only
 * connects them — it does NOT change the asset's value. You enter the asset's
 * value to represent the holding; from then on the DB triggers keep it in step
 * with every future contribution/withdrawal, and net worth stops counting the
 * linked project's balance separately (app layer) so nothing is double-counted.
 */
export const linkAssetBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        household_id: z.string().uuid(),
        bucket_id: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("assets")
      .update({ bucket_id: data.bucket_id })
      .eq("id", data.id)
      .eq("household_id", data.household_id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("assets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
