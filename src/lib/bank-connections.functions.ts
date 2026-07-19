import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickProvider, isGoCardlessConfigured } from "./bank/providers";

/**
 * Public callback URL that GoCardless redirects back to after the user
 * consents. Uses the stable published domain by default; can be overridden
 * with APP_BASE_URL (e.g. for staging / preview). The callback then bounces
 * the browser back to /settings?bank_linked=<connectionId>.
 */
function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "https://bynku.app";
}

/**
 * Bank connection CRUD + sync. Every sync writes into `pending_transactions`
 * — never directly into `expenses`. Approval is a separate, explicit step
 * in the Inbox (see inbox.functions.ts). Two guardrails prevent double-import:
 *
 *  1. `pending_transactions` has a unique index on
 *     (bank_account_id, external_transaction_id); upsert with ignoreDuplicates.
 *  2. If a matching row already exists in `expenses.bank_transaction_id`
 *     for this household (approved earlier or merged from a manual entry),
 *     the sync silently skips it.
 */

export const bankIntegrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    mockAvailable: true,
    gocardlessAvailable: isGoCardlessConfigured(),
  };
});

export const listBankConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: conns, error } = await context.supabase
      .from("bank_connections")
      .select("*, bank_accounts(*)")
      .eq("household_id", data.householdId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return conns ?? [];
  });

export const createBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        provider: z.enum(["mock", "gocardless"]).default("mock"),
        institution_id: z.string().max(120).nullable().optional(),
        institution_name: z.string().min(1).max(120),
        requisition_id: z.string().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    if (data.provider === "gocardless" && !isGoCardlessConfigured()) {
      throw new Error(
        "GoCardless is not configured on this instance. Use the mock connection to try the flow.",
      );
    }
    const { data: conn, error } = await context.supabase
      .from("bank_connections")
      .insert({
        household_id: data.householdId,
        provider: data.provider,
        institution_id: data.institution_id ?? null,
        institution_name: data.institution_name,
        requisition_id: data.requisition_id ?? null,
        created_by_user_id: context.userId,
        status: "active",
      })
      .select()
      .single();
    if (error) throw error;

    // Discover accounts under this connection.
    const provider = pickProvider(data.provider);
    const accounts = await provider.listAccounts({
      requisition_id: conn.requisition_id,
      institution_id: conn.institution_id,
    });
    if (accounts.length) {
      const { error: aErr } = await context.supabase.from("bank_accounts").upsert(
        accounts.map((a) => ({
          household_id: data.householdId,
          connection_id: conn.id,
          external_account_id: a.external_account_id,
          display_name: a.display_name,
          iban_last4: a.iban_last4,
          currency: a.currency,
          sync_enabled: true,
          last_balance: a.last_balance,
          last_balance_at: a.last_balance_at,
        })),
        { onConflict: "connection_id,external_account_id" },
      );
      if (aErr) throw aErr;
    }
    return { connection: conn, accountsAdded: accounts.length };
  });

export const deleteBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ householdId: z.string().uuid(), connectionId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("bank_connections")
      .delete()
      .eq("id", data.connectionId)
      .eq("household_id", data.householdId);
    if (error) throw error;
    return { ok: true };
  });

export const toggleBankAccountSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        accountId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("bank_accounts")
      .update({ sync_enabled: data.enabled })
      .eq("id", data.accountId)
      .eq("household_id", data.householdId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Sync all sync-enabled accounts under a connection: fetch transactions,
 * skip anything already approved (via expenses.bank_transaction_id), and
 * upsert the rest into `pending_transactions` for the user to review.
 */
export const syncBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ householdId: z.string().uuid(), connectionId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: conn, error: cErr } = await sb
      .from("bank_connections")
      .select("*")
      .eq("id", data.connectionId)
      .eq("household_id", data.householdId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!conn) throw new Error("Connection not found");

    const { data: accounts, error: aErr } = await sb
      .from("bank_accounts")
      .select("*")
      .eq("connection_id", conn.id)
      .eq("household_id", data.householdId)
      .eq("sync_enabled", true);
    if (aErr) throw aErr;

    const provider = pickProvider(conn.provider);
    const batchId = crypto.randomUUID();
    let staged = 0;
    let skipped = 0;

    for (const account of accounts ?? []) {
      const txs = await provider.fetchTransactions({
        external_account_id: account.external_account_id,
        since: conn.last_synced_at,
      });
      if (!txs.length) continue;

      // Skip anything already materialized into expenses.
      const externalIds = txs.map((t) => t.external_transaction_id);
      const { data: alreadyApproved } = await sb
        .from("expenses")
        .select("bank_transaction_id")
        .eq("household_id", data.householdId)
        .in("bank_transaction_id", externalIds);
      const approvedSet = new Set(
        (alreadyApproved ?? [])
          .map((r) => r.bank_transaction_id)
          .filter((v): v is string => !!v),
      );

      // Auto-categorize using the household's learned merchant_rules cache
      // (free — no AI). Unknown merchants fall back to "other" and the user
      // can correct on approval; saveMerchantRule learns the correction.
      const merchantKeys = Array.from(
        new Set(
          txs
            .map((t) => (t.merchant ?? "").trim())
            .filter((m): m is string => m.length > 0),
        ),
      );
      const catMap = new Map<string, string>();
      if (merchantKeys.length) {
        const { data: rules } = await sb
          .from("merchant_rules")
          .select("merchant_key, category")
          .eq("household_id", data.householdId)
          .in("merchant_key", merchantKeys);
        for (const r of rules ?? []) catMap.set(r.merchant_key, r.category);
      }

      const rows = txs
        .filter((t) => !approvedSet.has(t.external_transaction_id))
        .map((t) => {
          const key = (t.merchant ?? "").trim();
          const cat = catMap.get(key) ?? (t.kind === "income" ? "income" : "other");
          return {
            household_id: data.householdId,
            source: "bank_sync" as const,
            bank_account_id: account.id,
            external_transaction_id: t.external_transaction_id,
            batch_id: batchId,
            amount: t.amount,
            kind: t.kind,
            currency: t.currency,
            occurred_at: t.occurred_at,
            merchant: t.merchant,
            note: t.note,
            suggested_category: cat,
            suggested_labels: [] as string[],
            raw: t.raw as never,
            status: "pending" as const,
          };
        });

      skipped += txs.length - rows.length;
      if (!rows.length) continue;

      const { data: inserted, error: iErr } = await sb
        .from("pending_transactions")
        .upsert(rows, {
          onConflict: "bank_account_id,external_transaction_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (iErr) throw iErr;
      staged += inserted?.length ?? 0;
    }

    await sb
      .from("bank_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);
    return { staged, skipped };
  });
