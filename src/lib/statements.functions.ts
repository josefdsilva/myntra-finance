import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHouseholdMember } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { debtLiveSchedule, debtMonthlyRate, type Debt } from "@/lib/debt-schedule";
import { computeDepreciation } from "@/lib/depreciation";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";

/**
 * Indicative, cash-basis management statements for a business space — NOT
 * statutory accounts. Assembled from the money the business actually recorded so
 * the owner can sanity-check the official statements their tax advisor prepares.
 *
 * Three statements:
 *  - Income Statement (P&L): revenue − operating costs − depreciation − interest.
 *  - Balance Sheet: assets = liabilities + equity, as a point-in-time snapshot.
 *  - Cash Flow: operating / investing / financing over the period.
 */

const LIQUID_ASSET_KINDS = new Set(["stocks", "bonds", "fund"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

function periodBounds(year: number, quarter: number | null) {
  if (quarter == null) {
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), months: 12 };
  }
  const m = (quarter - 1) * 3;
  return { start: new Date(year, m, 1), end: new Date(year, m + 3, 1), months: 3 };
}

export type IncomeStatement = {
  revenue: number;
  operatingCosts: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  profitBeforeTax: number;
  costLines: Array<{ label: string; amount: number }>;
};

export type BalanceSheet = {
  fixedAssets: number;
  investments: number;
  cash: number;
  totalAssets: number;
  liabilities: number;
  equity: number;
  asOfIso: string;
};

export type CashFlowStatement = {
  operating: number;
  investing: number;
  financing: number;
  net: number;
  detail: {
    revenue: number;
    operatingCosts: number;
    capex: number;
    newLoans: number;
    debtPayments: number;
  };
};

export type FinancialStatements = {
  companyName: string;
  currency: string;
  periodLabel: string;
  startIso: string;
  endIso: string;
  generatedAt: string;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlowStatement;
};

export const getFinancialStatements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
        // null = full year.
        quarter: z.number().int().min(1).max(4).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FinancialStatements> => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);
    const hid = data.householdId;

    const { data: hh } = await supabase
      .from("households")
      .select("name, currency, kind")
      .eq("id", hid)
      .maybeSingle();
    if (hh?.kind !== "business")
      throw new Error("Finance statements are available for business spaces only.");

    const { start, end, months } = periodBounds(data.year, data.quarter);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const [
      { data: expData },
      { data: setData },
      { data: mvData },
      { data: assetData },
      { data: debtData },
      { data: bucketData },
      { data: allocData },
      { data: moveData },
    ] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount, kind, category")
        .eq("household_id", hid)
        .gte("occurred_at", startIso)
        .lt("occurred_at", endIso),
      supabase
        .from("fixed_expense_settlements")
        .select("amount, fixed_expense_id")
        .eq("household_id", hid)
        .gte("occurred_at", startIso)
        .lt("occurred_at", endIso),
      supabase
        .from("account_movements")
        .select("amount, created_at")
        .eq("household_id", hid)
        .eq("kind", "debt_payment")
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      supabase
        .from("assets")
        .select(
          "current_value, kind, acquired_value, acquired_on, depreciation_method, useful_life_months, salvage_value, depreciation_start, bucket_id",
        )
        .eq("household_id", hid),
      supabase.from("debts").select("*").eq("household_id", hid),
      supabase
        .from("buckets")
        .select("id, initial_balance")
        .eq("household_id", hid),
      supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      supabase.from("account_movements").select("*").eq("household_id", hid),
    ]);

    const expenses = rowsOrEmpty<{ amount: number | string; kind: string; category: string | null }>(
      expData,
    );
    const settlements = rowsOrEmpty<{ amount: number | string }>(setData);
    const debtPaymentRows = rowsOrEmpty<{ amount: number | string }>(mvData);
    const assets = rowsOrEmpty<{
      current_value: number | string;
      kind: string;
      acquired_value: number | string | null;
      acquired_on: string | null;
      depreciation_method: string | null;
      useful_life_months: number | null;
      salvage_value: number | string | null;
      depreciation_start: string | null;
      bucket_id: string | null;
    }>(assetData);
    const debts = rowsOrEmpty<Debt>(debtData);

    // ---- Income Statement (P&L) --------------------------------------------
    let revenue = 0;
    let loggedCosts = 0;
    const costByCat: Record<string, number> = {};
    for (const e of expenses) {
      const a = Number(e.amount) || 0;
      if (e.kind === "income") revenue += a;
      else {
        loggedCosts += a;
        const cat = (e.category?.trim() || "other").toLowerCase();
        costByCat[cat] = (costByCat[cat] ?? 0) + a;
      }
    }
    const fixedPaid = settlements.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (fixedPaid > 0) costByCat["fixed costs"] = (costByCat["fixed costs"] ?? 0) + fixedPaid;
    const operatingCosts = loggedCosts + fixedPaid;

    // Depreciation for the period = accumulated at end − accumulated at start.
    let depreciation = 0;
    for (const a of assets) {
      if (a.depreciation_method !== "straight_line") continue;
      const input = {
        method: "straight_line" as const,
        acquiredValue: a.acquired_value != null ? Number(a.acquired_value) : null,
        salvageValue: Number(a.salvage_value ?? 0),
        usefulLifeMonths: a.useful_life_months,
        start: a.depreciation_start ?? a.acquired_on,
      };
      const atEnd = computeDepreciation(input, new Date(end.getTime() - 1))?.accumulated ?? 0;
      const atStart = computeDepreciation(input, start)?.accumulated ?? 0;
      depreciation += Math.max(0, atEnd - atStart);
    }

    // Interest for the period ≈ current live balance × monthly rate × months.
    let interest = 0;
    for (const d of debts) {
      const remaining = debtLiveSchedule(d).remaining;
      interest += remaining * debtMonthlyRate(d) * months;
    }

    const ebitda = revenue - operatingCosts;
    const ebit = ebitda - depreciation;
    const profitBeforeTax = ebit - interest;

    const costLines = Object.entries(costByCat)
      .map(([label, amount]) => ({ label, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);

    const incomeStatement: IncomeStatement = {
      revenue: round2(revenue),
      operatingCosts: round2(operatingCosts),
      ebitda: round2(ebitda),
      depreciation: round2(depreciation),
      ebit: round2(ebit),
      interest: round2(interest),
      profitBeforeTax: round2(profitBeforeTax),
      costLines,
    };

    // ---- Balance Sheet (point-in-time snapshot, as of today) ---------------
    const balances = bucketBalancesFor(
      rowsOrEmpty<{ id: string; initial_balance: number | string }>(bucketData),
      rowsOrEmpty<{ bucket_id: string; amount: number | string }>(allocData),
      rowsOrEmpty<AccountMovement>(moveData),
    );
    // A project linked to an asset is already represented by that asset.
    const linkedBucketIds = new Set(
      assets.map((a) => a.bucket_id).filter((x): x is string => !!x),
    );
    let cash = 0;
    for (const [id, v] of Object.entries(balances)) {
      if (!linkedBucketIds.has(id)) cash += v;
    }
    let fixedAssets = 0;
    let investments = 0;
    for (const a of assets) {
      const v = Number(a.current_value) || 0;
      if (LIQUID_ASSET_KINDS.has(a.kind)) investments += v;
      else fixedAssets += v;
    }
    const liabilities = debts.reduce((s, d) => s + debtLiveSchedule(d).remaining, 0);
    const totalAssets = fixedAssets + investments + cash;
    const balanceSheet: BalanceSheet = {
      fixedAssets: round2(fixedAssets),
      investments: round2(investments),
      cash: round2(cash),
      totalAssets: round2(totalAssets),
      liabilities: round2(liabilities),
      equity: round2(totalAssets - liabilities),
      asOfIso: new Date().toISOString().slice(0, 10),
    };

    // ---- Cash Flow Statement (period) --------------------------------------
    const operating = revenue - operatingCosts;
    // Investing: capex = asset purchases whose acquisition date falls in period.
    let capex = 0;
    for (const a of assets) {
      if (!a.acquired_on) continue;
      const d = new Date(`${a.acquired_on.slice(0, 10)}T00:00:00`);
      if (d >= start && d < end) capex += Number(a.acquired_value ?? a.current_value) || 0;
    }
    // Financing: new loans drawn in period (inflow) − loan payments (outflow).
    let newLoans = 0;
    for (const d of debts) {
      const opened = d.opened_at ? new Date(`${String(d.opened_at).slice(0, 10)}T00:00:00`) : null;
      if (opened && opened >= start && opened < end) newLoans += Number(d.starting_principal ?? 0) || 0;
    }
    const debtPayments = debtPaymentRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const investing = -capex;
    const financing = newLoans - debtPayments;
    const cashFlow: CashFlowStatement = {
      operating: round2(operating),
      investing: round2(investing),
      financing: round2(financing),
      net: round2(operating + investing + financing),
      detail: {
        revenue: round2(revenue),
        operatingCosts: round2(operatingCosts),
        capex: round2(capex),
        newLoans: round2(newLoans),
        debtPayments: round2(debtPayments),
      },
    };

    return {
      companyName: hh?.name ?? "Company",
      currency: hh?.currency ?? "EUR",
      periodLabel: data.quarter == null ? `${data.year}` : `Q${data.quarter} ${data.year}`,
      startIso: start.toISOString().slice(0, 10),
      endIso: new Date(end.getTime() - 1).toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      incomeStatement,
      balanceSheet,
      cashFlow,
    };
  });
