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
  /** Where the entry came from: a logged expense, a paid fixed cost, or a loan payment. */
  source: "expense" | "settlement" | "debt";
  /** Loan repayments have no invoice by nature — don't flag them as missing. */
  invoiceExempt: boolean;
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

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // Pull the three cash sources for the period in parallel, plus the reference
  // labels for fixed costs and debts.
  const [
    { data: expData },
    { data: setData },
    { data: mvData },
    { data: fxData },
    { data: debtData },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount, kind, category, merchant, note, occurred_at")
      .eq("household_id", householdId)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso),
    supabase
      .from("fixed_expense_settlements")
      .select("id, amount, occurred_at, fixed_expense_id")
      .eq("household_id", householdId)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso),
    supabase
      .from("account_movements")
      .select("id, amount, created_at, to_id, note")
      .eq("household_id", householdId)
      .eq("kind", "debt_payment")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase.from("fixed_expenses").select("id, label, category").eq("household_id", householdId),
    supabase.from("debts").select("id, label").eq("household_id", householdId),
  ]);

  const expenses = rowsOrEmpty<{
    id: string;
    amount: number | string;
    kind: string;
    category: string | null;
    merchant: string | null;
    note: string | null;
    occurred_at: string;
  }>(expData);
  const settlements = rowsOrEmpty<{
    id: string;
    amount: number | string;
    occurred_at: string;
    fixed_expense_id: string;
  }>(setData);
  const debtPayments = rowsOrEmpty<{
    id: string;
    amount: number | string;
    created_at: string;
    to_id: string | null;
    note: string | null;
  }>(mvData);
  const fixedLabels = new Map(
    rowsOrEmpty<{ id: string; label: string | null; category: string | null }>(fxData).map((f) => [
      f.id,
      { label: f.label, category: f.category },
    ]),
  );
  const debtLabels = new Map(
    rowsOrEmpty<{ id: string; label: string | null }>(debtData).map((d) => [d.id, d.label]),
  );

  // Invoices attached to those expenses AND to those settlements.
  const expIds = expenses.map((e) => e.id);
  const setIds = settlements.map((s) => s.id);
  const [{ data: invExpData }, { data: invSetData }] = await Promise.all([
    expIds.length
      ? supabase
          .from("invoices")
          .select("expense_id, settlement_id, path, file_name")
          .eq("household_id", householdId)
          .in("expense_id", expIds)
      : Promise.resolve({ data: [] as never[] }),
    setIds.length
      ? supabase
          .from("invoices")
          .select("expense_id, settlement_id, path, file_name")
          .eq("household_id", householdId)
          .in("settlement_id", setIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const invoices = [
    ...rowsOrEmpty<{
      expense_id: string | null;
      settlement_id: string | null;
      path: string;
      file_name: string | null;
    }>(invExpData),
    ...rowsOrEmpty<{
      expense_id: string | null;
      settlement_id: string | null;
      path: string;
      file_name: string | null;
    }>(invSetData),
  ];

  // Sign each unique path once, then group by expense id and by settlement id.
  const signedCache = new Map<string, string | null>();
  const sign = async (path: string): Promise<string | null> => {
    if (signedCache.has(path)) return signedCache.get(path)!;
    const { data: signed } = await supabase.storage
      .from("invoices")
      .createSignedUrl(path, INVOICE_LINK_TTL_SECONDS);
    const url = signed?.signedUrl ?? null;
    signedCache.set(path, url);
    return url;
  };
  const byExpense = new Map<string, Array<{ name: string; url: string }>>();
  const bySettlement = new Map<string, Array<{ name: string; url: string }>>();
  for (const inv of invoices) {
    const url = await sign(inv.path);
    if (!url) continue;
    const item = { name: inv.file_name ?? "invoice", url };
    if (inv.expense_id) {
      const l = byExpense.get(inv.expense_id) ?? [];
      l.push(item);
      byExpense.set(inv.expense_id, l);
    } else if (inv.settlement_id) {
      const l = bySettlement.get(inv.settlement_id) ?? [];
      l.push(item);
      bySettlement.set(inv.settlement_id, l);
    }
  }

  let received = 0;
  let spent = 0;
  let missingCount = 0;
  const entries: HandoffEntry[] = [];
  const missing: HandoffPackage["missing"] = [];

  const pushEntry = (e: HandoffEntry) => {
    if (e.direction === "in") received += e.amount;
    else spent += e.amount;
    if (!e.invoiceExempt && e.invoices.length === 0) {
      missingCount += 1;
      missing.push({
        date: e.date,
        direction: e.direction,
        amount: e.amount,
        description: e.description,
      });
    }
    entries.push(e);
  };

  // 1) Logged expenses & income receipts.
  for (const e of expenses) {
    const amount = round2(Number(e.amount) || 0);
    const direction: "in" | "out" = e.kind === "income" ? "in" : "out";
    const description =
      (e.merchant && e.merchant.trim()) ||
      (e.note && e.note.trim()) ||
      (e.category && e.category.trim()) ||
      "—";
    pushEntry({
      id: e.id,
      date: e.occurred_at.slice(0, 10),
      direction,
      amount,
      description,
      category: e.category,
      source: "expense",
      invoiceExempt: false,
      invoices: byExpense.get(e.id) ?? [],
    });
  }

  // 2) Paid fixed costs (settlements) — invoiced like any cost.
  for (const s of settlements) {
    const meta = fixedLabels.get(s.fixed_expense_id);
    pushEntry({
      id: s.id,
      date: s.occurred_at.slice(0, 10),
      direction: "out",
      amount: round2(Number(s.amount) || 0),
      description: meta?.label?.trim() || "Fixed cost",
      category: meta?.category ?? null,
      source: "settlement",
      invoiceExempt: false,
      invoices: bySettlement.get(s.id) ?? [],
    });
  }

  // 3) Loan payments — a cash outflow, but no invoice is expected.
  for (const p of debtPayments) {
    const label = (p.to_id && debtLabels.get(p.to_id)) || p.note?.trim() || "Loan";
    pushEntry({
      id: p.id,
      date: p.created_at.slice(0, 10),
      direction: "out",
      amount: round2(Number(p.amount) || 0),
      description: `Loan payment · ${label}`,
      category: "debt",
      source: "debt",
      invoiceExempt: true,
      invoices: [],
    });
  }

  // Chronological across all sources.
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  missing.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

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
          invoiceExempt: e.invoiceExempt,
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
