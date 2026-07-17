import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** First day of the month a date falls in, as "yyyy-mm-01". */
function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Create or update a planned money event. */
export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        label: z.string().min(1).max(80),
        amount: z.number().positive().max(10_000_000),
        direction: z.enum(["spend", "income"]).default("spend"),
        month: z.string().date(),
        recurrence: z.enum(["one_off", "annual", "ongoing"]).default("one_off"),
        category: z.string().max(50).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
        done: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const payload = { ...rest, month: firstOfMonth(rest.month) };
    if (id) {
      const { data: row, error } = await context.supabase
        .from("plans")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("plans")
      .insert({ ...payload, created_by: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("plans").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Resolve a plan against reality: mark it done and record what it actually cost
 * (0 when it did not happen). Resolved plans leave the forward forecast and move
 * to the history, where estimate vs actual is shown. The payment itself is not
 * created here — that flows through a project withdrawal or a normal expense.
 */
export const resolvePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        household_id: z.string().uuid(),
        actual_amount: z.number().min(0).max(10_000_000),
        // When set, the payment is taken out of this project (a withdrawal);
        // otherwise it is drawn from the month's unallocated leftover.
        source_bucket_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    // Pay from a project: withdraw the actual amount from it (validates balance).
    if (data.source_bucket_id && data.actual_amount > 0) {
      const { error: wErr } = await sb.rpc("fund_withdrawal", {
        p_household: data.household_id,
        p_bucket: data.source_bucket_id,
        p_amount: data.actual_amount,
        p_reason: "plan_payment",
      });
      if (wErr) throw wErr;
    }
    const patch: { done: boolean; actual_amount: number; bucket_id?: string } = {
      done: true,
      actual_amount: data.actual_amount,
    };
    if (data.source_bucket_id) patch.bucket_id = data.source_bucket_id;
    const { error } = await sb.from("plans").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Reopen a resolved plan (clears the actual amount and puts it back in the forecast). */
export const reopenPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("plans")
      .update({ done: false, actual_amount: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Turn a spend plan into a sinking fund: create a goal_by_date project that
 * targets the plan's amount by its month, and link it back to the plan. From
 * then on the plan is "funded" and stops hitting its month as a lump; the user
 * saves for it gradually through the normal allocations flow.
 */
export const fundPlanAsProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: plan, error: pErr } = await sb
      .from("plans")
      .select("id, label, amount, month, direction, bucket_id")
      .eq("id", data.id)
      .eq("household_id", data.household_id)
      .single();
    if (pErr) throw pErr;
    if (!plan) throw new Error("plan not found");
    if (plan.direction !== "spend") throw new Error("only spend plans can be funded");
    if (plan.bucket_id) return { bucketId: plan.bucket_id as string };

    const { data: bucket, error: bErr } = await sb
      .from("buckets")
      .insert({
        household_id: data.household_id,
        name: String(plan.label).slice(0, 60),
        target_type: "goal_by_date",
        target_value: Number(plan.amount),
        target_deadline: String(plan.month).slice(0, 10),
        kind: "savings",
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    const { error: uErr } = await sb
      .from("plans")
      .update({ bucket_id: bucket.id })
      .eq("id", plan.id);
    if (uErr) throw uErr;

    return { bucketId: bucket.id as string };
  });
