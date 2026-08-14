import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KPI Targets — measured (not funded) goals. Stored/edited here; their current
// value and reached-state are computed live on the client from the shared metric
// registry (src/lib/metrics.ts). RLS enforces household membership.
// See docs/money-journey-plan.md (Addendum — Two objective families).

export type KpiTarget = {
  id: string;
  title: string;
  metric_key: string;
  op: "<=" | ">=";
  target_value: number;
  target_date: string | null;
  status: "active" | "reached";
  reached_at: string | null;
  sort_order: number;
  created_by: string;
};

const METRIC_KEYS = [
  "emergency_months",
  "dti_pct",
  "invested_months",
  "invested_years",
  "total_income",
  "income_concentration",
  "spending_vs_plan",
  "savings_rate",
  "essential_expenses_ratio",
  "housing_cost_ratio",
  "non_mortgage_debt_service",
  "net_worth",
  "debt_to_asset",
  "investment_assets_ratio",
  "non_essential_ratio",
] as const;

const SELECT =
  "id, title, metric_key, op, target_value, target_date, status, reached_at, sort_order, created_by";

/** All KPI targets for a household, in order. */
export const listKpiTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ household_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("kpi_targets")
      .select(SELECT)
      .eq("household_id", data.household_id)
      .order("sort_order", { ascending: true });
    return (rows as unknown as KpiTarget[] | null) ?? [];
  });

/** Create a KPI target. created_by lets the coach author one on the user's behalf. */
export const createKpiTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        title: z.string().min(1).max(80),
        metric_key: z.enum(METRIC_KEYS),
        op: z.enum(["<=", ">="]),
        target_value: z.number().finite(),
        target_date: z.string().nullable().optional(),
        created_by: z.enum(["user", "coach"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // Append after the current last target.
    const { data: last } = await context.supabase
      .from("kpi_targets")
      .select("sort_order")
      .eq("household_id", data.household_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (last?.sort_order ?? -1) + 1;

    const { data: row, error } = await context.supabase
      .from("kpi_targets")
      .insert({
        household_id: data.household_id,
        title: data.title,
        metric_key: data.metric_key,
        op: data.op,
        target_value: data.target_value,
        target_date: data.target_date ?? null,
        created_by: data.created_by ?? "user",
        sort_order,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return row as unknown as KpiTarget;
  });

/** Edit a KPI target (partial). */
export const updateKpiTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(80).optional(),
        metric_key: z.enum(METRIC_KEYS).optional(),
        op: z.enum(["<=", ">="]).optional(),
        target_value: z.number().finite().optional(),
        target_date: z.string().nullable().optional(),
        status: z.enum(["active", "reached"]).optional(),
        reached_at: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) fields[k] = v;
    const { data: row, error } = await context.supabase
      .from("kpi_targets")
      .update(fields as never)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return row as unknown as KpiTarget;
  });

/** Delete a KPI target. */
export const deleteKpiTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("kpi_targets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Persist a new order (drag-reorder). */
export const setKpiTargetOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid(), ids: z.array(z.string().uuid()) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await Promise.all(
      data.ids.map((id, i) =>
        context.supabase
          .from("kpi_targets")
          .update({ sort_order: i } as never)
          .eq("id", id)
          .eq("household_id", data.household_id),
      ),
    );
    return { ok: true };
  });
