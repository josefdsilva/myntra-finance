import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { JsonObject } from "@/lib/json";

// Durable achievements — the immutable record of milestones a household has
// earned. Written once, idempotently, at the moment a milestone is first hit, so
// recognition survives later edits (raising a goal, changing a number). This is
// the foundation of the Money Journey / roadmap (docs/money-journey-plan.md).

export type Achievement = {
  id: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  title: string;
  detail: string | null;
  meta: JsonObject;
  earned_at: string;
};

/** Every achievement a household has earned, newest first. */
export const listAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("achievements")
      .select("id, kind, ref_type, ref_id, title, detail, meta, earned_at")
      .eq("household_id", data.household_id)
      .order("earned_at", { ascending: false })
      .limit(100);
    return (rows as unknown as Achievement[] | null) ?? [];
  });

/**
 * Record an achievement idempotently. `dedupe_key` is the identity of the
 * milestone (e.g. "goal_reached:<bucket_id>"), so re-detecting a reached goal on
 * every render never double-posts. Returns `{ created }` — true only the first
 * time, so the caller can celebrate exactly once.
 */
export const recordAchievement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        kind: z.string().min(1),
        dedupe_key: z.string().min(1),
        title: z.string().min(1),
        detail: z.string().nullable().optional(),
        ref_type: z.string().nullable().optional(),
        ref_id: z.string().uuid().nullable().optional(),
        meta: z.record(z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: inserted } = await context.supabase
      .from("achievements")
      .upsert(
        {
          household_id: data.household_id,
          kind: data.kind,
          dedupe_key: data.dedupe_key,
          title: data.title,
          detail: data.detail ?? null,
          ref_type: data.ref_type ?? null,
          ref_id: data.ref_id ?? null,
          meta: (data.meta ?? {}) as never,
        },
        { onConflict: "household_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    return { created: (inserted?.length ?? 0) > 0 };
  });
