import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Money Journey stages — user- and coach-authored roadmap milestones. Objectives
// are evaluated live on the client against numbers the app already computes; this
// module just stores/edits the stages. See docs/money-journey-plan.md.

export type JourneyStage = {
  id: string;
  template_key: string | null;
  title: string | null;
  objective: string | null;
  objective_type: "metric" | "project" | "custom";
  objective_config: Record<string, unknown>;
  optional: boolean;
  status: "active" | "done";
  reached_at: string | null;
  sort_order: number;
  created_by: string;
};

// The default spine — the classic order of operations. Seeded once per household;
// fully editable afterwards. Titles/objectives render from i18n via template_key.
const DEFAULT_STAGES: Array<Pick<JourneyStage, "template_key" | "objective_type"> & {
  objective_config: Record<string, unknown>;
}> = [
  { template_key: "starter", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 1 } },
  { template_key: "debt", objective_type: "metric", objective_config: { key: "dti_pct", op: "<=", value: 15 } },
  { template_key: "net3", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 3 } },
  { template_key: "net6", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 6 } },
  { template_key: "invest", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 3 } },
];

const SELECT =
  "id, template_key, title, objective, objective_type, objective_config, optional, status, reached_at, sort_order, created_by";

/** All stages for a household, in order. */
export const listStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("journey_stages")
      .select(SELECT)
      .eq("household_id", data.household_id)
      .order("sort_order", { ascending: true });
    return (rows as unknown as JourneyStage[] | null) ?? [];
  });

/** Seed the default spine the first time — idempotent (no-op if any stage exists). */
export const ensureJourneySeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { count } = await context.supabase
      .from("journey_stages")
      .select("id", { count: "exact", head: true })
      .eq("household_id", data.household_id);
    if ((count ?? 0) > 0) return { seeded: false };
    const rows = DEFAULT_STAGES.map((d, i) => ({
      household_id: data.household_id,
      template_key: d.template_key,
      objective_type: d.objective_type,
      objective_config: d.objective_config as never,
      sort_order: i,
      created_by: "seed",
    }));
    await context.supabase.from("journey_stages").insert(rows as never);
    return { seeded: true };
  });

/** Add a custom stage (or side-quest) at the end. */
export const createStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        title: z.string().min(1).max(120),
        objective: z.string().max(240).nullable().optional(),
        optional: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: maxRow } = await context.supabase
      .from("journey_stages")
      .select("sort_order")
      .eq("household_id", data.household_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? -1) + 1;
    const { data: inserted } = await context.supabase
      .from("journey_stages")
      .insert({
        household_id: data.household_id,
        title: data.title,
        objective: data.objective ?? null,
        objective_type: "custom",
        optional: data.optional ?? false,
        sort_order: nextOrder,
        created_by: "user",
      } as never)
      .select("id");
    return { id: (inserted as Array<{ id: string }> | null)?.[0]?.id ?? null };
  });

/** Edit a stage's editable fields. */
export const updateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(120).nullable().optional(),
        objective: z.string().max(240).nullable().optional(),
        optional: z.boolean().optional(),
        status: z.enum(["active", "done"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.objective !== undefined) patch.objective = data.objective;
    if (data.optional !== undefined) patch.optional = data.optional;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.reached_at = data.status === "done" ? new Date().toISOString() : null;
    }
    await context.supabase
      .from("journey_stages")
      .update(patch as never)
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await context.supabase.from("journey_stages").delete().eq("id", data.id);
    return { ok: true };
  });

/** Persist a new order — client sends the full ordered id list. */
export const setStageOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid(), ids: z.array(z.string().uuid()) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await Promise.all(
      data.ids.map((id, i) =>
        context.supabase
          .from("journey_stages")
          .update({ sort_order: i } as never)
          .eq("id", id)
          .eq("household_id", data.household_id),
      ),
    );
    return { ok: true };
  });
