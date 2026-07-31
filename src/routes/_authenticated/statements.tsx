import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Download, Info, Loader2, FileSpreadsheet } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { getFinancialStatements, type FinancialStatements } from "@/lib/statements.functions";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/statements")({
  head: () =>
    pageMeta({
      path: "/statements",
      title: "Finance statements · bynku",
      description:
        "Review imported bank statements and the transactions bynku matched to your cycle.",
      noindex: true,
    }),
  component: StatementsPage,
});

type Tab = "pl" | "bs" | "cf";

function StatementsPage() {
  const t = useT();
  const activeId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const stmtFn = useServerFn(getFinancialStatements);
  const { data: hh } = useQuery({
    queryKey: ["household", activeId],
    queryFn: () => fetchHh({ data: activeId ? { household_id: activeId } : {} }),
  });
  const household = hh?.household;
  const householdId = household?.id;
  const isBusiness = household?.kind === "business";

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  // "full" = whole year, or "1".."4" for a quarter.
  const [period, setPeriod] = useState("full");
  const [tab, setTab] = useState<Tab>("pl");

  const quarter = period === "full" ? null : Number(period);

  const { data: st, isLoading } = useQuery({
    enabled: !!householdId && isBusiness,
    queryKey: ["statements", householdId, year, period],
    queryFn: () => stmtFn({ data: { householdId: householdId!, year: Number(year), quarter } }),
  });

  function download() {
    if (!st) return;
    const html = buildStatementsHtml(st, t);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bynku-statements-${st.periodLabel.replace(/\s+/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const years = [thisYear, thisYear - 1, thisYear - 2].map(String);
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "pl", label: t("statements.tab.pl") },
    { key: "bs", label: t("statements.tab.bs") },
    { key: "cf", label: t("statements.tab.cf") },
  ];

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("statements.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("statements.subtitle")}</p>
      </header>

      {!isBusiness ? (
        <EmptyState
          icon={Building2}
          title={t("statements.businessOnly")}
          description={t("statements.businessOnlyBody")}
        />
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">{t("statements.indicative")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-5" /> {t("statements.periodTitle")}
              </CardTitle>
              <CardDescription>{t("statements.periodDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("statements.year")}</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("statements.period")}</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">{t("statements.fullYear")}</SelectItem>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>{`Q${n}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Statement switcher */}
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
                {tabs.map((tb) => (
                  <button
                    key={tb.key}
                    type="button"
                    onClick={() => setTab(tb.key)}
                    aria-pressed={tab === tb.key}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                      tab === tb.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {isLoading || !st ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="rounded-lg border p-4">
                    {tab === "pl" && <IncomeStatementView st={st} t={t} />}
                    {tab === "bs" && <BalanceSheetView st={st} t={t} />}
                    {tab === "cf" && <CashFlowView st={st} t={t} />}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={download}>
                      <Download className="size-4" /> {t("statements.download")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

type T = ReturnType<typeof useT>;

function Line({
  label,
  value,
  bold,
  muted,
  indent,
  rule,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  indent?: boolean;
  rule?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${rule ? "border-t mt-1 pt-2" : ""} ${
        indent ? "pl-4" : ""
      }`}
    >
      <span
        className={`${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} text-sm`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums text-sm ${bold ? "font-semibold" : ""} ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function IncomeStatementView({ st, t }: { st: FinancialStatements; t: T }) {
  const p = st.incomeStatement;
  return (
    <div>
      <h3 className="mb-1 font-medium">
        {t("statements.tab.pl")} · {st.periodLabel}
      </h3>
      <Line label={t("statements.revenue")} value={money(p.revenue)} />
      <Line label={t("statements.operatingCosts")} value={`(${money(p.operatingCosts)})`} />
      {p.costLines.slice(0, 6).map((c) => (
        <Line key={c.label} label={c.label} value={`(${money(c.amount)})`} muted indent />
      ))}
      <Line label={t("statements.ebitda")} value={money(p.ebitda)} bold rule />
      <Line label={t("statements.depreciation")} value={`(${money(p.depreciation)})`} />
      <Line label={t("statements.ebit")} value={money(p.ebit)} bold rule />
      <Line label={t("statements.interest")} value={`(${money(p.interest)})`} />
      <Line label={t("statements.profitBeforeTax")} value={money(p.profitBeforeTax)} bold rule />
      <p className="mt-2 text-xs text-muted-foreground">{t("statements.plNote")}</p>
    </div>
  );
}

function BalanceSheetView({ st, t }: { st: FinancialStatements; t: T }) {
  const b = st.balanceSheet;
  return (
    <div>
      <h3 className="mb-1 font-medium">{t("statements.tab.bs")}</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        {t("statements.asOf", { date: b.asOfIso })}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("statements.assets")}
      </p>
      <Line label={t("statements.fixedAssets")} value={money(b.fixedAssets)} indent />
      <Line label={t("statements.investments")} value={money(b.investments)} indent />
      <Line label={t("statements.cash")} value={money(b.cash)} indent />
      <Line label={t("statements.totalAssets")} value={money(b.totalAssets)} bold rule />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("statements.liabilitiesEquity")}
      </p>
      <Line label={t("statements.loans")} value={money(b.liabilities)} indent />
      <Line label={t("statements.equity")} value={money(b.equity)} indent />
      <Line
        label={t("statements.totalLiabEquity")}
        value={money(b.liabilities + b.equity)}
        bold
        rule
      />
      <p className="mt-2 text-xs text-muted-foreground">{t("statements.bsNote")}</p>
    </div>
  );
}

function CashFlowView({ st, t }: { st: FinancialStatements; t: T }) {
  const c = st.cashFlow;
  const sign = (n: number) => (n < 0 ? `(${money(Math.abs(n))})` : money(n));
  return (
    <div>
      <h3 className="mb-1 font-medium">
        {t("statements.tab.cf")} · {st.periodLabel}
      </h3>
      <Line label={t("statements.cfOperating")} value={sign(c.operating)} bold />
      <Line label={t("statements.revenue")} value={money(c.detail.revenue)} muted indent />
      <Line
        label={t("statements.operatingCosts")}
        value={`(${money(c.detail.operatingCosts)})`}
        muted
        indent
      />
      <Line label={t("statements.cfInvesting")} value={sign(c.investing)} bold rule />
      <Line label={t("statements.capex")} value={`(${money(c.detail.capex)})`} muted indent />
      <Line label={t("statements.cfFinancing")} value={sign(c.financing)} bold rule />
      <Line label={t("statements.newLoans")} value={money(c.detail.newLoans)} muted indent />
      <Line
        label={t("statements.debtPayments")}
        value={`(${money(c.detail.debtPayments)})`}
        muted
        indent
      />
      <Line label={t("statements.netCashFlow")} value={sign(c.net)} bold rule />
      <p className="mt-2 text-xs text-muted-foreground">{t("statements.cfNote")}</p>
    </div>
  );
}

/** Self-contained HTML with all three statements for download. */
function buildStatementsHtml(st: FinancialStatements, t: T): string {
  const p = st.incomeStatement;
  const b = st.balanceSheet;
  const c = st.cashFlow;
  const row = (label: string, value: string, bold = false, indent = false) =>
    `<tr><td style="padding:3px 0;${indent ? "padding-left:16px;" : ""}${
      bold ? "font-weight:bold;border-top:1px solid #e2e8f0" : ""
    }">${label}</td><td style="text-align:right;${
      bold ? "font-weight:bold;border-top:1px solid #e2e8f0" : ""
    }">${value}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statements ${st.periodLabel}</title></head>
  <body style="font-family:Arial,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#0f172a">
    <h1 style="font-size:22px;margin:0 0 2px">${t("statements.title")}</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 4px">${st.companyName} · ${st.periodLabel}</p>
    <p style="color:#b45309;font-size:12px;margin:0 0 20px">${t("statements.indicative")}</p>

    <h2 style="font-size:16px;margin:16px 0 6px">${t("statements.tab.pl")}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${row(t("statements.revenue"), money(p.revenue))}
      ${row(t("statements.operatingCosts"), `(${money(p.operatingCosts)})`)}
      ${row(t("statements.ebitda"), money(p.ebitda), true)}
      ${row(t("statements.depreciation"), `(${money(p.depreciation)})`)}
      ${row(t("statements.ebit"), money(p.ebit), true)}
      ${row(t("statements.interest"), `(${money(p.interest)})`)}
      ${row(t("statements.profitBeforeTax"), money(p.profitBeforeTax), true)}
    </table>

    <h2 style="font-size:16px;margin:20px 0 6px">${t("statements.tab.bs")} <span style="font-weight:normal;color:#64748b;font-size:12px">(${t(
      "statements.asOf",
      { date: b.asOfIso },
    )})</span></h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${row(t("statements.fixedAssets"), money(b.fixedAssets), false, true)}
      ${row(t("statements.investments"), money(b.investments), false, true)}
      ${row(t("statements.cash"), money(b.cash), false, true)}
      ${row(t("statements.totalAssets"), money(b.totalAssets), true)}
      ${row(t("statements.loans"), money(b.liabilities), false, true)}
      ${row(t("statements.equity"), money(b.equity), false, true)}
      ${row(t("statements.totalLiabEquity"), money(b.liabilities + b.equity), true)}
    </table>

    <h2 style="font-size:16px;margin:20px 0 6px">${t("statements.tab.cf")}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${row(t("statements.cfOperating"), money(c.operating), true)}
      ${row(t("statements.cfInvesting"), c.investing < 0 ? `(${money(Math.abs(c.investing))})` : money(c.investing), true)}
      ${row(t("statements.cfFinancing"), c.financing < 0 ? `(${money(Math.abs(c.financing))})` : money(c.financing), true)}
      ${row(t("statements.netCashFlow"), c.net < 0 ? `(${money(Math.abs(c.net))})` : money(c.net), true)}
    </table>

    <p style="color:#94a3b8;font-size:11px;margin-top:24px">Generated by bynku from your own records — indicative only.</p>
  </body></html>`;
}
