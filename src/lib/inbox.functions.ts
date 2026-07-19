import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Inbox = unified review queue for auto-captured transactions
 * (bank sync + statement imports). Nothing hits `expenses` until the
 * user approves it here, so bank duplicates of already-recorded fixed
 * costs / manual cash entries can never silently double-count.
 */

const pendingItemInput = z.object({
  household_id: z.string().uuid(),
  source: z.enum(["bank_sync", "statement"]),
  bank_account_id: z.string().uuid().nullable().optional(),
  external_transaction_id: z.string().max(200).nullable().optional(),
  batch_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive().max(10_000_000),
  kind: z.enum(["expense", "income"]).default("expense"),
  currency: z.string().max(8).default("EUR"),
  occurred_at: z.string(),
  merchant: z.string().max(200).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  suggested_category: z.string().max(50).default("other"),
  suggested_labels: z.array(z.string().max(40)).default([]),
  raw: z.record(z.unknown()).default({}),
});

export const listInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        status: z.enum(["pending", "approved", "dismissed", "merged", "all"]).default("pending"),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("pending_transactions")
      .select("*")
      .eq("household_id", data.householdId)
      .order("occurred_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getInboxCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { count, error } = await context.supabase
      .from("pending_transactions")
      .select("*", { count: "exact", head: true })
      .eq("household_id", data.householdId)
      .eq("status", "pending");
    if (error) throw error;
    return { count: count ?? 0 };
  });

/**
 * Stage a batch of items into the inbox (used by statement import and any
 * future channel). Callers dedupe against existing pending rows and existing
 * expenses; this fn additionally enforces the DB-level unique constraint on
 * (bank_account_id, external_transaction_id).
 */
export const stageInboxItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        items: z.array(pendingItemInput).min(1).max(500),
        batchId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const batchId = data.batchId ?? crypto.randomUUID();
    const rows = data.items.map((it) => ({
      household_id: it.household_id,
      source: it.source,
      bank_account_id: it.bank_account_id ?? null,
      external_transaction_id: it.external_transaction_id ?? null,
      batch_id: it.batch_id ?? batchId,
      amount: it.amount,
      kind: it.kind,
      currency: it.currency,
      occurred_at: it.occurred_at,
      merchant: it.merchant ?? null,
      note: it.note ?? null,
      suggested_category: it.suggested_category,
      suggested_labels: it.suggested_labels,
      raw: it.raw as never,
      status: "pending" as const,
    }));
    // upsert by (bank_account_id, external_transaction_id) — DB will ignore dupes
    // for bank_sync rows. For statement rows without an external id we insert plain.
    const { data: inserted, error } = await context.supabase
      .from("pending_transactions")
      .upsert(rows, {
        onConflict: "bank_account_id,external_transaction_id",
        ignoreDuplicates: true,
      })
      .select();
    if (error) throw error;
    return { batchId, inserted: inserted?.length ?? 0, submitted: rows.length };
  });

const approvedEdit = z.object({
  id: z.string().uuid(),
  amount: z.number().positive().max(10_000_000).optional(),
  category: z.string().max(50).optional(),
  merchant: z.string().max(200).nullable().optional(),
  occurred_at: z.string().optional(),
  note: z.string().max(500).nullable().optional(),
  labels: z.array(z.string().max(40)).optional(),
  kind: z.enum(["expense", "income"]).optional(),
});

/**
 * Approve pending items → materialize them as `expenses` rows and mark the
 * pending row `approved`. Optional per-item edits let the user tweak before
 * approving. Bank-synced rows carry their `external_transaction_id` into the
 * expenses row so a resync can never re-import them.
 */
export const approveInboxItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        edits: z.array(approvedEdit).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    type EditPatch = z.infer<typeof approvedEdit>;
    const editById = new Map<string, EditPatch>(
      data.edits.map((e) => [e.id, e]),
    );
    const { data: pending, error: fetchErr } = await context.supabase
      .from("pending_transactions")
      .select("*")
      .eq("household_id", data.householdId)
      .in(
        "id",
        data.edits.map((e) => e.id),
      )
      .eq("status", "pending");
    if (fetchErr) throw fetchErr;

    const expenseRows: Array<{
      household_id: string;
      added_by_user_id: string;
      amount: number;
      category: string;
      merchant: string | null;
      occurred_at: string;
      note: string | null;
      source: "bank_sync" | "statement";
      source_meta: Record<string, string | null>;
      kind: "expense" | "income";
      is_salary: boolean;
      labels: string[];
      bank_transaction_id: string | null;
    }> = [];

    for (const p of pending ?? []) {
      const edit: EditPatch = editById.get(p.id) ?? { id: p.id };
      const kind = (edit.kind ?? p.kind) as "expense" | "income";
      expenseRows.push({
        household_id: p.household_id,
        added_by_user_id: context.userId,
        amount: edit.amount ?? Number(p.amount),
        category: edit.category ?? p.suggested_category,
        merchant: edit.merchant !== undefined ? edit.merchant : p.merchant,
        occurred_at: edit.occurred_at ?? p.occurred_at,
        note: edit.note !== undefined ? edit.note : p.note,
        source: p.source === "bank_sync" ? "bank_sync" : "statement",
        source_meta: {
          pending_transaction_id: p.id,
          bank_account_id: p.bank_account_id,
          external_transaction_id: p.external_transaction_id,
        },
        kind,
        is_salary: false,
        labels: edit.labels ?? p.suggested_labels ?? [],
        bank_transaction_id:
          p.source === "bank_sync" && p.external_transaction_id
            ? p.external_transaction_id
            : null,
      });
    }

    if (!expenseRows.length) return { approved: 0 };

    const { data: inserted, error: insErr } = await context.supabase
      .from("expenses")
      .insert(expenseRows)
      .select("id, source_meta");
    if (insErr) throw insErr;

    // Mark pending → approved with the resulting expense id.
    const updates = (inserted ?? []).map(async (row) => {
      const meta = row.source_meta as { pending_transaction_id?: string } | null;
      const pid = meta?.pending_transaction_id;
      if (!pid) return;
      await context.supabase
        .from("pending_transactions")
        .update({
          status: "approved",
          approved_expense_id: row.id,
          resolved_by_user_id: context.userId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", pid);
    });
    await Promise.all(updates);

    // Learn merchant → category rules from user approvals so future bank
    // syncs of the same merchant get auto-categorized without AI calls.
    const ruleRows = expenseRows
      .filter((r) => r.kind === "expense" && r.merchant && r.category)
      .map((r) => ({
        household_id: r.household_id,
        merchant_key: r.merchant!.toLowerCase().trim().slice(0, 120),
        category: r.category,
        source: "user_approval",
      }));
    // Deduplicate on merchant_key (last write wins for the batch).
    const uniqueRules = Array.from(
      new Map(ruleRows.map((r) => [`${r.household_id}:${r.merchant_key}`, r])).values(),
    );
    if (uniqueRules.length) {
      await context.supabase
        .from("merchant_rules")
        .upsert(uniqueRules, { onConflict: "household_id,merchant_key" });
    }
    return { approved: inserted?.length ?? 0 };
  });


export const dismissInboxItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("pending_transactions")
      .update({
        status: "dismissed",
        resolved_by_user_id: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("household_id", data.householdId)
      .in("id", data.ids)
      .eq("status", "pending");
    if (error) throw error;
    return { dismissed: data.ids.length };
  });

/**
 * Merge a pending item into an existing expense — the user is telling us
 * "this bank line IS the manual entry I already logged". We stamp the
 * expense with the bank transaction id so future syncs skip it, and mark
 * the pending row as merged.
 */
export const mergeInboxItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        pendingId: z.string().uuid(),
        expenseId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: pending, error: pErr } = await context.supabase
      .from("pending_transactions")
      .select("external_transaction_id, source")
      .eq("id", data.pendingId)
      .eq("household_id", data.householdId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!pending) throw new Error("Pending item not found");

    if (pending.source === "bank_sync" && pending.external_transaction_id) {
      const { error: eErr } = await context.supabase
        .from("expenses")
        .update({ bank_transaction_id: pending.external_transaction_id })
        .eq("id", data.expenseId)
        .eq("household_id", data.householdId);
      if (eErr) throw eErr;
    }
    const { error: uErr } = await context.supabase
      .from("pending_transactions")
      .update({
        status: "merged",
        matched_expense_id: data.expenseId,
        resolved_by_user_id: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.pendingId);
    if (uErr) throw uErr;
    return { ok: true };
  });

/**
 * Suggest existing expenses that likely correspond to a pending bank line
 * — same kind, within ±7 days, and within ±2% (or ±€1) of the amount.
 * The client can offer these as "merge" targets so users don't double-count
 * fixed costs they already logged manually.
 */
export const suggestInboxMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        pendingId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: p, error: pErr } = await context.supabase
      .from("pending_transactions")
      .select("amount, kind, occurred_at")
      .eq("id", data.pendingId)
      .eq("household_id", data.householdId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!p) return [];

    const amt = Number(p.amount);
    const tol = Math.max(1, amt * 0.02);
    const day = new Date(p.occurred_at);
    const from = new Date(day.getTime() - 7 * 86400_000).toISOString();
    const to = new Date(day.getTime() + 7 * 86400_000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("expenses")
      .select("id, amount, category, merchant, occurred_at, note, kind")
      .eq("household_id", data.householdId)
      .eq("kind", p.kind)
      .is("bank_transaction_id", null)
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .gte("amount", amt - tol)
      .lte("amount", amt + tol)
      .order("occurred_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return rows ?? [];
  });

/**
 * Suggest fixed_expenses rows that a pending bank line is likely a
 * recurring instance of (amount within ±5% of monthly_amount, and merchant
 * name shares a token with the fixed-expense label). These are already
 * baked into the household baseline, so approving would double-count —
 * the UI uses this to warn and offer a one-tap dismiss.
 */
export const suggestFixedMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        pendingId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: p, error: pErr } = await context.supabase
      .from("pending_transactions")
      .select("amount, kind, merchant")
      .eq("id", data.pendingId)
      .eq("household_id", data.householdId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!p || p.kind !== "expense") return [];

    const amt = Number(p.amount);
    const tol = Math.max(0.5, amt * 0.05);
    const { data: fx, error } = await context.supabase
      .from("fixed_expenses")
      .select("id, label, monthly_amount, category")
      .eq("household_id", data.householdId)
      .gte("monthly_amount", amt - tol)
      .lte("monthly_amount", amt + tol);
    if (error) throw error;

    const merchant = (p.merchant ?? "").toLowerCase();
    const tokens = merchant
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 3);
    const scored = (fx ?? []).map((row) => {
      const label = row.label.toLowerCase();
      const nameHit =
        tokens.some((t) => label.includes(t)) ||
        (merchant.length >= 3 && label.includes(merchant.slice(0, 4)));
      return { ...row, nameHit };
    });
    // Prefer name-matching rows; if none, still return amount matches (weaker).
    const withName = scored.filter((s) => s.nameHit);
    return (withName.length ? withName : scored).slice(0, 3);
  });

