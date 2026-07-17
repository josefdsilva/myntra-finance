import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AccountMovement = Database["public"]["Tables"]["account_movements"]["Row"];
export type MovementAccountType = Database["public"]["Enums"]["movement_account_type"];
export type RecomputeMode = "reduce_installment" | "shorten_term";

const toDateStr = (d: Date | string | undefined): string | undefined =>
  d == null ? undefined : format(new Date(d), "yyyy-MM-dd");

/** Add funds from cash into a bucket/project. Returns the new movement id. */
export async function depositToBucket(p: {
  householdId: string;
  bucketId: string;
  amount: number;
  reason?: string;
  note?: string;
  period?: Date | string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("fund_deposit", {
    p_household: p.householdId,
    p_bucket: p.bucketId,
    p_amount: p.amount,
    p_reason: p.reason,
    p_note: p.note,
    p_period: toDateStr(p.period),
  });
  if (error) throw error;
  return data as string;
}

/** Take funds out of a bucket back to cash. Validated against the bucket balance. */
export async function withdrawFromBucket(p: {
  householdId: string;
  bucketId: string;
  amount: number;
  reason?: string;
  note?: string;
  period?: Date | string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("fund_withdrawal", {
    p_household: p.householdId,
    p_bucket: p.bucketId,
    p_amount: p.amount,
    p_reason: p.reason,
    p_note: p.note,
    p_period: toDateStr(p.period),
  });
  if (error) throw error;
  return data as string;
}

/** Move funds from one bucket to another. Validated against the source balance. */
export async function transferBetweenBuckets(p: {
  householdId: string;
  fromBucketId: string;
  toBucketId: string;
  amount: number;
  reason?: string;
  note?: string;
  period?: Date | string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("fund_transfer", {
    p_household: p.householdId,
    p_from_bucket: p.fromBucketId,
    p_to_bucket: p.toBucketId,
    p_amount: p.amount,
    p_reason: p.reason,
    p_note: p.note,
    p_period: toDateStr(p.period),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Pay down a debt from cash or a bucket. The post-payment schedule
 * (`newPrincipal`, `newInstallment`, `newMaturity`) is computed by the
 * amortization engine (see debt-schedule.ts) and passed through so the server
 * persists it atomically.
 */
export async function serviceDebt(p: {
  householdId: string;
  debtId: string;
  amount: number;
  source: "cash" | "bucket";
  sourceBucketId?: string;
  newPrincipal?: number;
  newInstallment?: number;
  newMaturity?: Date | string;
  recomputeMode?: RecomputeMode;
  reason?: string;
  note?: string;
  period?: Date | string;
  asOf?: Date | string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("service_debt", {
    p_household: p.householdId,
    p_debt: p.debtId,
    p_amount: p.amount,
    p_source_type: p.source,
    p_source_bucket: p.sourceBucketId,
    p_new_principal: p.newPrincipal,
    p_new_installment: p.newInstallment,
    p_new_maturity: toDateStr(p.newMaturity),
    p_recompute_mode: p.recomputeMode,
    p_reason: p.reason,
    p_note: p.note,
    p_period: toDateStr(p.period),
    p_as_of: toDateStr(p.asOf),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Record the regular monthly payment for a debt as a ledger entry, dated the
 * first day of the cycle. Idempotent per (household, debt, period): calling it
 * again for the same period is a no-op and returns null. It does NOT change the
 * debt principal — the amortization projection stays authoritative — so this
 * only adds a visible payment history and never double-counts the balance.
 */
export async function logScheduledDebtPayment(p: {
  householdId: string;
  debtId: string;
  period: Date | string;
  amount: number;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("log_scheduled_debt_payment", {
    p_household: p.householdId,
    p_debt: p.debtId,
    p_period: toDateStr(p.period)!,
    p_amount: p.amount,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ---- Pure balance aggregation (bucket balance folds allocations + movements) ----

type AllocationLike = { bucket_id: string; amount: number | string };

/** Balance of one bucket: initial + confirmed allocations + movements in − out. */
export function bucketBalance(
  bucketId: string,
  initialBalance: number,
  allocations: AllocationLike[],
  movements: AccountMovement[],
): number {
  let bal = Number(initialBalance) || 0;
  for (const a of allocations) {
    if (a.bucket_id === bucketId) bal += Number(a.amount) || 0;
  }
  for (const m of movements) {
    if (m.to_type === "bucket" && m.to_id === bucketId) bal += Number(m.amount) || 0;
    if (m.from_type === "bucket" && m.from_id === bucketId) bal -= Number(m.amount) || 0;
  }
  return Math.round(bal * 100) / 100;
}

/** Balances for many buckets in one pass. */
export function bucketBalancesFor(
  buckets: Array<{ id: string; initial_balance: number | string }>,
  allocations: AllocationLike[],
  movements: AccountMovement[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of buckets) {
    out[b.id] = bucketBalance(b.id, Number(b.initial_balance) || 0, allocations, movements);
  }
  return out;
}

/** Fetch all movements for a household (newest first). */
export async function fetchMovements(householdId: string): Promise<AccountMovement[]> {
  const { data, error } = await supabase
    .from("account_movements")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountMovement[];
}
