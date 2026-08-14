import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { JsonObject } from "@/lib/json";
import { priciestClearableDebt, debtBalance } from "@/lib/debt-apr";

// Money Journey stages — user- and coach-authored roadmap milestones. Objectives
// are evaluated live on the client against numbers the app already computes; this
// module just stores/edits the stages. See docs/money-journey-plan.md.

export type JourneyStage = {
  id: string;
  template_key: string | null;
  title: string | null;
  objective: string | null;
  objective_type: "metric" | "project" | "custom";
  objective_config: JsonObject;
  optional: boolean;
  status: "active" | "done";
  reached_at: string | null;
  sort_order: number;
  created_by: string;
};

// The default spine — the classic order of operations. Seeded once per household;
// fully editable afterwards. Titles/objectives render from i18n via template_key.
const DEFAULT_STAGES: Array<Pick<JourneyStage, "template_key" | "objective_type"> & {
  objective_config: JsonObject;
}> = [
  { template_key: "starter", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 1 } },
  { template_key: "debt", objective_type: "metric", objective_config: { key: "dti_pct", op: "<=", value: 15 } },
  { template_key: "net3", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 3 } },
  { template_key: "net6", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 6 } },
  { template_key: "invest", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 1 } },
  { template_key: "investDeep", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 6 } },
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
        objective_type: z.enum(["metric", "project", "custom"]).optional(),
        objective_config: z.record(z.unknown()).optional(),
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
        objective_type: data.objective_type ?? "custom",
        objective_config: (data.objective_config ?? {}) as never,
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

type DraftSpec = {
  template_key?: string | null;
  title?: string | null;
  objective_type: string;
  objective_config: JsonObject;
  optional?: boolean;
};

/**
 * Coach drafts a personalized roadmap, grounded and deterministic (no model
 * call). It reads the household's real position and tailors the spine: drops the
 * debt stage when there's no debt, extends the horizon with advanced rungs once
 * the safety net is built (so a well-off household's journey keeps going instead
 * of looking finished), and turns goal-by-date projects into real milestones.
 * The user's own stages are kept, appended after.
 */
export const draftJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const hid = data.household_id;
    const [hh, buckets, allocs, moves, debts, fixed, incomes] = await Promise.all([
      context.supabase.from("households").select("baseline_budget").eq("id", hid).maybeSingle(),
      context.supabase
        .from("buckets")
        .select("id, name, kind, target_type, target_value, initial_balance")
        .eq("household_id", hid)
        .order("sort_order"),
      context.supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      context.supabase
        .from("account_movements")
        .select("amount, to_type, from_type, to_id, from_id")
        .eq("household_id", hid),
      context.supabase
        .from("debts")
        .select(
          "id, label, monthly_amount, taeg_pct, tan_pct, deduced_rate_pct, principal_remaining, starting_principal",
        )
        .eq("household_id", hid),
      context.supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      context.supabase.from("incomes").select("monthly_amount").eq("household_id", hid),
    ]);

    const baseline = Number(hh.data?.baseline_budget ?? 0);
    const income = (incomes.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const debtMonthly = (debts.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const fixedMonthly = (fixed.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const essentials = Math.max(1, baseline || fixedMonthly + debtMonthly);

    const bs = (buckets.data ?? []) as Array<{
      id: string;
      name: string;
      kind: string | null;
      target_type: string;
      target_value: number | string;
      initial_balance: number | string;
    }>;
    // Project balance = initial + confirmed allocations + net bucket movements.
    const bal: Record<string, number> = {};
    for (const b of bs) bal[b.id] = Number(b.initial_balance ?? 0);
    for (const a of (allocs.data ?? []) as Array<{ bucket_id: string; amount: number | string }>)
      bal[a.bucket_id] = (bal[a.bucket_id] ?? 0) + Number(a.amount);
    for (const m of (moves.data ?? []) as Array<{
      amount: number | string;
      to_type: string | null;
      from_type: string | null;
      to_id: string | null;
      from_id: string | null;
    }>) {
      if (m.to_type === "bucket" && m.to_id) bal[m.to_id] = (bal[m.to_id] ?? 0) + Number(m.amount);
      if (m.from_type === "bucket" && m.from_id) bal[m.from_id] = (bal[m.from_id] ?? 0) - Number(m.amount);
    }
    let emergencyBal = 0;
    let savingsBal = 0;
    for (const b of bs) {
      const v = bal[b.id] ?? 0;
      if (b.kind === "emergency") emergencyBal += v;
      else if (b.kind !== "investment") savingsBal += v;
    }
    const hasEmergency = bs.some((b) => b.kind === "emergency");
    const emergencyMonths = (hasEmergency ? emergencyBal : emergencyBal + savingsBal) / essentials;
    const hasDebt = debtMonthly > 0;
    // When one loan is genuinely expensive (high APR, real balance), the debt
    // rung names it and tracks it to zero — "Clear your credit card" instead of
    // the abstract "get debt-to-income under 15%". Shared threshold/ranking with
    // the dashboard's expensive-debt tip so the two never disagree.
    const debtRows = (debts.data ?? []) as Array<{
      id: string;
      label: string | null;
      taeg_pct: number | string | null;
      tan_pct: number | string | null;
      deduced_rate_pct: number | string | null;
      principal_remaining: number | string | null;
      starting_principal: number | string | null;
    }>;
    const pricey = priciestClearableDebt(debtRows);
    // A household that can barely save should first free up room by trimming
    // non-essential spending — asking it to build a safety net it can't fund is
    // demoralizing. This becomes the very first rung when money is tight.
    const tight = income > 0 && income - essentials < income * 0.1;

    const specs: DraftSpec[] = [];
    if (tight) {
      specs.push({ template_key: "freeUp", objective_type: "metric", objective_config: { key: "non_essential_ratio", op: "<=", value: 25 } });
    }
    specs.push({ template_key: "starter", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 1 } });
    if (pricey) {
      specs.push({
        template_key: "clearDebt",
        title: pricey.debt.label ?? null,
        objective_type: "project",
        objective_config: { debt_id: pricey.debt.id },
      });
    } else if (hasDebt) {
      specs.push({ template_key: "debt", objective_type: "metric", objective_config: { key: "dti_pct", op: "<=", value: 15 } });
    }
    specs.push(
      { template_key: "net3", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 3 } },
      { template_key: "net6", objective_type: "metric", objective_config: { key: "emergency_months", op: ">=", value: 6 } },
      { template_key: "invest", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 1 } },
      { template_key: "investDeep", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 6 } },
    );
    // Advanced rungs appear once the safety net is built — keeps the horizon open
    // for households that are already well past the basics.
    if (emergencyMonths >= 6) {
      specs.push(
        { template_key: "invest12", objective_type: "metric", objective_config: { key: "invested_months", op: ">=", value: 12 } },
        { template_key: "fi", objective_type: "metric", objective_config: { key: "invested_years", op: ">=", value: 25 } },
      );
    }
    // Goal-by-date projects become their own milestones (house, property, a big
    // goal). The emergency fund is skipped — it already drives the safety net.
    for (const b of bs) {
      if (b.target_type === "goal_by_date" && Number(b.target_value) > 0 && b.kind !== "emergency") {
        specs.push({ title: b.name, objective_type: "project", objective_config: { bucket_id: b.id }, optional: true });
      }
    }

    // Replace the previous suggested spine (seed + earlier coach drafts); keep the
    // user's own stages, re-numbered to follow the fresh spine.
    await context.supabase
      .from("journey_stages")
      .delete()
      .eq("household_id", hid)
      .in("created_by", ["seed", "coach"]);
    const { data: userStages } = await context.supabase
      .from("journey_stages")
      .select("id")
      .eq("household_id", hid)
      .order("sort_order", { ascending: true });
    const coachRows = specs.map((d, i) => ({
      household_id: hid,
      template_key: d.template_key ?? null,
      title: d.title ?? null,
      objective_type: d.objective_type,
      objective_config: d.objective_config as never,
      optional: d.optional ?? false,
      sort_order: i,
      created_by: "coach",
    }));
    await context.supabase.from("journey_stages").insert(coachRows as never);
    await Promise.all(
      (userStages ?? []).map((u, i) =>
        context.supabase
          .from("journey_stages")
          .update({ sort_order: specs.length + i } as never)
          .eq("id", u.id),
      ),
    );
    return { ok: true, stages: specs.length };
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

/** Compact roadmap summary for the dashboard card: level, active stage, progress. */
export const journeySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const hid = data.household_id;
    const [hh, buckets, allocs, moves, incomes, debts, fixed, stagesR] = await Promise.all([
      context.supabase.from("households").select("baseline_budget").eq("id", hid).maybeSingle(),
      context.supabase
        .from("buckets")
        .select("id, kind, target_type, target_value, initial_balance")
        .eq("household_id", hid),
      context.supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      context.supabase
        .from("account_movements")
        .select("amount, to_type, from_type, to_id, from_id")
        .eq("household_id", hid),
      context.supabase.from("incomes").select("monthly_amount").eq("household_id", hid),
      context.supabase
        .from("debts")
        .select("id, monthly_amount, principal_remaining, starting_principal")
        .eq("household_id", hid),
      context.supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      context.supabase
        .from("journey_stages")
        .select("template_key, title, objective_type, objective_config, optional, status")
        .eq("household_id", hid)
        .order("sort_order", { ascending: true }),
    ]);

    type Active = { template_key: string | null; title: string | null; progress: number } | null;
    const stages = (stagesR.data ?? []) as Array<{
      template_key: string | null;
      title: string | null;
      objective_type: string;
      objective_config: Record<string, unknown>;
      optional: boolean;
      status: string;
    }>;
    if (!stages.length) return { hasStages: false, level: 0, total: 0, active: null as Active };

    const baseline = Number(hh.data?.baseline_budget ?? 0);
    const income = (incomes.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const debtMonthly = (debts.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const fixedMonthly = (fixed.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const essentials = Math.max(1, baseline || fixedMonthly + debtMonthly);
    // Remaining/starting principal per debt, for any "clear this loan" stage.
    const debtById: Record<string, { remaining: number; starting: number }> = {};
    for (const d of (debts.data ?? []) as Array<{
      id: string;
      principal_remaining: number | string | null;
      starting_principal: number | string | null;
    }>) {
      debtById[d.id] = {
        remaining: debtBalance(d),
        starting: Number(d.starting_principal ?? d.principal_remaining ?? 0),
      };
    }

    const bs = (buckets.data ?? []) as Array<{
      id: string;
      kind: string | null;
      target_type: string;
      target_value: number | string;
      initial_balance: number | string;
    }>;
    const bal: Record<string, number> = {};
    for (const b of bs) bal[b.id] = Number(b.initial_balance ?? 0);
    for (const a of (allocs.data ?? []) as Array<{ bucket_id: string; amount: number | string }>)
      bal[a.bucket_id] = (bal[a.bucket_id] ?? 0) + Number(a.amount);
    for (const m of (moves.data ?? []) as Array<{
      amount: number | string;
      to_type: string | null;
      from_type: string | null;
      to_id: string | null;
      from_id: string | null;
    }>) {
      if (m.to_type === "bucket" && m.to_id) bal[m.to_id] = (bal[m.to_id] ?? 0) + Number(m.amount);
      if (m.from_type === "bucket" && m.from_id) bal[m.from_id] = (bal[m.from_id] ?? 0) - Number(m.amount);
    }
    let emergencyBal = 0;
    let savingsBal = 0;
    let investBal = 0;
    for (const b of bs) {
      const v = bal[b.id] ?? 0;
      if (b.kind === "investment") investBal += v;
      else if (b.kind === "emergency") emergencyBal += v;
      else savingsBal += v;
    }
    const hasEmergency = bs.some((b) => b.kind === "emergency");
    const liquidReserve = hasEmergency ? emergencyBal : emergencyBal + savingsBal;
    const metrics: Record<string, number> = {
      emergency_months: liquidReserve / essentials,
      dti_pct: income > 0 ? (debtMonthly / income) * 100 : 0,
      invested_months: investBal / essentials,
      invested_years: investBal / (12 * essentials),
    };
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const evalStage = (s: (typeof stages)[number]): { complete: boolean; progress: number } => {
      if (s.objective_type === "custom")
        return { complete: s.status === "done", progress: s.status === "done" ? 1 : 0 };
      if (s.objective_type === "project") {
        const cfg = s.objective_config as { bucket_id?: string; debt_id?: string };
        // "Clear this loan" — progress by principal paid down; complete at zero.
        if (cfg.debt_id) {
          const d = debtById[String(cfg.debt_id)];
          if (!d || d.starting <= 0) return { complete: false, progress: 0 };
          return { complete: d.remaining <= 0.01, progress: clamp01((d.starting - d.remaining) / d.starting) };
        }
        const id = String(cfg.bucket_id ?? "");
        const b = bs.find((x) => x.id === id);
        const cur = bal[id] ?? 0;
        const target = Number(b?.target_value ?? 0);
        if (!b || target <= 0) return { complete: false, progress: 0 };
        return { complete: cur >= target - 0.01, progress: clamp01(cur / target) };
      }
      const cfg = s.objective_config as { key?: string; op?: string; value?: number };
      const cur = metrics[String(cfg.key ?? "")] ?? 0;
      const target = Number(cfg.value ?? 0);
      const op = cfg.op === "<=" ? "<=" : ">=";
      const complete = op === "<=" ? cur <= target : cur >= target;
      const progress =
        op === "<=" ? (complete ? 1 : clamp01(target / Math.max(cur, 0.0001))) : clamp01(cur / Math.max(target, 0.0001));
      return { complete, progress };
    };

    const spine = stages.filter((s) => !s.optional);
    let level = 0;
    let active: Active = null;
    for (const s of spine) {
      const e = evalStage(s);
      if (e.complete) level++;
      else if (!active) active = { template_key: s.template_key, title: s.title, progress: e.progress };
    }
    return { hasStages: true, level, total: spine.length, active };
  });
