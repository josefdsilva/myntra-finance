import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHouseholdMember, type Supa } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { enqueueTemplateEmail } from "@/lib/email/send.server";

// Signed-invoice links need to stay valid long enough for an accountant to
// download them after the email lands — 14 days.
const INVOICE_LINK_TTL_SECONDS = 14 * 24 * 60 * 60;

export type HandoffEntry = {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Money in (received) or out (paid). */
  direction: "in" | "out";
  amount: number;
  description: string;
  category: string | null;
  invoices: Array<{ name: string; url: string }>;
};

export type HandoffPackage = {
  companyName: string;
  currency: string;
  periodLabel: string;
  startIso: string;
  endIso: string;
  generatedAt: string;
  totals: { received: number; spent: number; net: number; count: number; missingCount: number };
  entries: HandoffEntry[];
  /** Entries with no invoice attached — the warning list. */
  missing: Array<{ date: string; direction: "in" | "out"; amount: number; description: string }>;
};

function quarterBounds(year: number, q: number) {
  const startMonth = (q - 1) * 3;
  return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Assemble the accountant handoff for a quarter: every logged cost and income
 * receipt in the period, each with links to its attached invoices (signed), the
 * running totals, and the list of entries that are missing an invoice.
 *
 * Uses the caller's Supabase client so storage RLS scopes signing to invoices
 * this household actually owns.
 */
async function assembleHandoff(
  supabase: Supa,
  householdId: string,
  household: { name?: string | null; currency?: string | null },
  year: number,
  q: number,
): Promise<HandoffPackage> {
  const { start, end } = quarterBounds(year, q);

  const { data: expData } = await supabase
    .from("expenses")
    .select("id, amount, kind, category, merchant, note, occurred_at")
    .eq("household_id", householdId)
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: true });
  const expenses = rowsOrEmpty<{
    id: string;
    amount: number | string;
    kind: string;
    category: string | null;
    merchant: string | null;
    note: string | null;
    occurred_at: string;
  }>(expData);

  const ids = expenses.map((e) => e.id);
  // Invoices attached to those expenses.
  const { data: invData } = ids.length
    ? await supabase
        .from("invoices")
        .select("expense_id, path, file_name")
        .eq("household_id", householdId)
        .in("expense_id", ids)
    : { data: [] };
  const invoices = rowsOrEmpty<{
    expense_id: string | null;
    path: string;
    file_name: string | null;
  }>(invData);

  // Group + sign. Sign each path once.
  const byExpense = new Map<string, Array<{ name: string; url: string }>>();
  const signedCache = new Map<string, string | null>();
  for (const inv of invoices) {
    if (!inv.expense_id) continue;
    let url = signedCache.get(inv.path);
    if (url === undefined) {
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(inv.path, INVOICE_LINK_TTL_SECONDS);
      url = signed?.signedUrl ?? null;
      signedCache.set(inv.path, url);
    }
    if (!url) continue;
    const list = byExpense.get(inv.expense_id) ?? [];
    list.push({ name: inv.file_name ?? "invoice", url });
    byExpense.set(inv.expense_id, list);
  }

  let received = 0;
  let spent = 0;
  let missingCount = 0;
  const entries: HandoffEntry[] = [];
  const missing: HandoffPackage["missing"] = [];

  for (const e of expenses) {
    const amount = round2(Number(e.amount) || 0);
    const direction: "in" | "out" = e.kind === "income" ? "in" : "out";
    if (direction === "in") received += amount;
    else spent += amount;
    const description =
      (e.merchant && e.merchant.trim()) ||
      (e.note && e.note.trim()) ||
      (e.category && e.category.trim()) ||
      "—";
    const invs = byExpense.get(e.id) ?? [];
    if (invs.length === 0) {
      missingCount += 1;
      missing.push({
        date: e.occurred_at.slice(0, 10),
        direction,
        amount,
        description,
      });
    }
    entries.push({
      id: e.id,
      date: e.occurred_at.slice(0, 10),
      direction,
      amount,
      description,
      category: e.category,
      invoices: invs,
    });
  }

  return {
    companyName: household.name ?? "Company",
    currency: household.currency ?? "EUR",
    periodLabel: `Q${q} ${year}`,
    startIso: start.toISOString().slice(0, 10),
    endIso: new Date(end.getTime() - 1).toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    totals: {
      received: round2(received),
      spent: round2(spent),
      net: round2(received - spent),
      count: entries.length,
      missingCount,
    },
    entries,
    missing,
  };
}

const inputSchema = z.object({
  householdId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
});

/** Preview the handoff package in-app (no email sent). */
export const getHandoffPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);
    const { data: hh } = await supabase
      .from("households")
      .select("name, currency, kind")
      .eq("id", data.householdId)
      .maybeSingle();
    if (hh?.kind !== "business") throw new Error("Handoff is available for business spaces only.");
    return assembleHandoff(supabase, data.householdId, hh ?? {}, data.year, data.quarter);
  });

/** Assemble the handoff and email it to the household's advisor. */
export const sendHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);
    const { data: hh } = await supabase
      .from("households")
      .select("name, currency, kind, advisor_email")
      .eq("id", data.householdId)
      .maybeSingle();
    if (hh?.kind !== "business") throw new Error("Handoff is available for business spaces only.");
    const advisor = (hh?.advisor_email ?? "").trim();
    if (!advisor) throw new Error("No accountant email is set. Add one in Settings first.");

    const pkg = await assembleHandoff(supabase, data.householdId, hh ?? {}, data.year, data.quarter);

    const appUrl =
      typeof process !== "undefined" && process.env?.APP_URL ? process.env.APP_URL : "https://bynku.app";

    const res = await enqueueTemplateEmail({
      templateName: "handoff-ledger",
      recipientEmail: advisor,
      // Idempotent per household+period+day so a double-click doesn't double-send.
      idempotencyKey: `handoff-${data.householdId}-${data.year}Q${data.quarter}-${pkg.generatedAt.slice(0, 10)}`,
      templateData: {
        appUrl,
        companyName: pkg.companyName,
        currency: pkg.currency,
        periodLabel: pkg.periodLabel,
        startIso: pkg.startIso,
        endIso: pkg.endIso,
        totals: pkg.totals,
        entries: pkg.entries.map((e) => ({
          date: e.date,
          direction: e.direction,
          amount: e.amount,
          description: e.description,
          category: e.category,
          invoices: e.invoices,
        })),
        missing: pkg.missing,
      },
    });

    return {
      ok: res.ok,
      reason: res.reason ?? null,
      advisor,
      total: pkg.totals.count,
      missingCount: pkg.totals.missingCount,
    };
  });
