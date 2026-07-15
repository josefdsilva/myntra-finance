import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  categorizeMerchants,
  applyStatementImport,
  inferStatementColumnsAI,
} from "@/lib/statement-import.functions";
import {
  parseCsv,
  inferColumns,
  toTransactions,
  analyzeStatement,
  CATEGORIES,
  type Category,
  type RawTxn,
} from "@/lib/statement-import";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Upload, Loader2, Check } from "lucide-react";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type FixedRow = {
  include: boolean;
  label: string;
  monthly_amount: number;
  category: Category;
  confidence: number;
  occurrences: number;
  cadence: string;
};
type VarRow = { include: boolean; category: Category; monthly_amount: number; txnCount: number };
type IncomeRow = { include: boolean; label: string; monthly_amount: number; isSalary: boolean };
type DebtRow = { include: boolean; label: string; monthly_amount: number };

/**
 * The full upload → review → apply flow, without a page chrome, so it can be
 * used both on the standalone route and inside a dialog from Settings.
 * `onApplied` fires after a successful apply (e.g. to close the dialog).
 */
export function StatementImportFlow({
  householdId,
  onApplied,
}: {
  householdId: string;
  onApplied?: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const categorizeFn = useServerFn(categorizeMerchants);
  const inferColsFn = useServerFn(inferStatementColumnsAI);
  const applyFn = useServerFn(applyStatementImport);

  const { data: current } = useQuery({
    enabled: !!householdId,
    queryKey: ["stmt-current", householdId],
    queryFn: async () => {
      const [fx, ve, inc, dt] = await Promise.all([
        supabase.from("fixed_expenses").select("label, monthly_amount").eq("household_id", householdId),
        supabase.from("variable_estimates").select("label, monthly_amount").eq("household_id", householdId),
        supabase.from("incomes").select("label, monthly_amount").eq("household_id", householdId),
        supabase.from("debts").select("label, monthly_amount").eq("household_id", householdId),
      ]);
      return {
        fixed: fx.data ?? [],
        variable: ve.data ?? [],
        incomes: inc.data ?? [],
        debts: dt.data ?? [],
      };
    },
  });

  const [step, setStep] = useState<"upload" | "review">("upload");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fixedRows, setFixedRows] = useState<FixedRow[]>([]);
  const [varRows, setVarRows] = useState<VarRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [anomalies, setAnomalies] = useState<
    Array<{ description: string; amount: number; category: string }>
  >([]);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error(t("stmt.errNoRows"));
      let map = inferColumns(rows[0]);
      if (!map) {
        map = await inferColsFn({
          data: { householdId, headers: rows[0], sampleRows: rows.slice(1, 4) },
        });
      }
      const txns: RawTxn[] = toTransactions(rows, map);
      if (txns.length < 3) throw new Error(t("stmt.errFewTxns"));

      let analysis = analyzeStatement(txns);
      const unknown = Array.from(
        new Set([
          ...analysis.variable.unknownMerchants,
          ...analysis.fixed.filter((f) => !f.category).map((f) => f.merchant),
        ]),
      );
      let catMap: Record<string, string> = {};
      if (unknown.length) {
        const res = await categorizeFn({ data: { householdId, merchants: unknown } });
        catMap = res.map;
        analysis = analyzeStatement(txns, (m) => (catMap[m] as Category) ?? null);
      }

      setFileName(file.name);
      setFixedRows(
        analysis.fixed.map((f) => ({
          include: f.confidence >= 0.6,
          label: f.sampleDescription.slice(0, 60),
          monthly_amount: f.monthlyAmount,
          category: (f.category ?? (catMap[f.merchant] as Category) ?? "other") as Category,
          confidence: f.confidence,
          occurrences: f.occurrences,
          cadence: f.cadence,
        })),
      );
      setVarRows(
        analysis.variable.estimates.map((v) => ({
          include: true,
          category: v.category,
          monthly_amount: v.monthlyAmount,
          txnCount: v.txnCount,
        })),
      );
      setIncomeRows(
        analysis.income.map((i) => ({
          include: i.recurring,
          label: i.label,
          monthly_amount: i.monthlyAmount,
          isSalary: i.isSalary,
        })),
      );
      setDebtRows(
        analysis.debts.map((d) => ({ include: true, label: d.label, monthly_amount: d.monthlyAmount })),
      );
      setAnomalies(analysis.variable.anomalies);
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("stmt.errRead"));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    try {
      const s = await applyFn({
        data: {
          householdId,
          fileName,
          fixed: fixedRows
            .filter((r) => r.include)
            .map((r) => ({ label: r.label, monthly_amount: r.monthly_amount, category: r.category })),
          variable: varRows
            .filter((r) => r.include)
            .map((r) => ({ label: cap(r.category), category: r.category, monthly_amount: r.monthly_amount })),
          incomes: incomeRows
            .filter((r) => r.include)
            .map((r) => ({ label: r.label, monthly_amount: r.monthly_amount })),
          debts: debtRows
            .filter((r) => r.include)
            .map((r) => ({ label: r.label, monthly_amount: r.monthly_amount })),
        },
      });
      toast.success(
        t("stmt.applied", {
          fi: s.fixed.inserted,
          fu: s.fixed.updated,
          vi: s.variable.inserted,
          vu: s.variable.updated,
          ii: s.incomes.inserted,
          iu: s.incomes.updated,
          di: s.debts.inserted,
        }),
      );
      qc.invalidateQueries();
      onApplied?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("stmt.errApply"));
    } finally {
      setBusy(false);
    }
  }

  const existingAmount = (
    list: Array<{ label: string; monthly_amount: number }> | undefined,
    label: string,
  ) => {
    const found = (list ?? []).find((r) => r.label.trim().toLowerCase() === label.trim().toLowerCase());
    return found ? Number(found.monthly_amount) : null;
  };

  function DiffBadge({ prev }: { prev: number | null }) {
    if (prev == null)
      return (
        <Badge variant="outline" className="text-[10px]">
          {t("stmt.new")}
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-[10px] text-amber-600">
        {t("stmt.was", { amount: money(prev) })}
      </Badge>
    );
  }

  const inclSum = (rows: Array<{ include: boolean; monthly_amount: number }>) =>
    rows.filter((r) => r.include).reduce((s, r) => s + (Number(r.monthly_amount) || 0), 0);
  const curSum = (list?: Array<{ monthly_amount: number | string }>) =>
    (list ?? []).reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
  const totalNode = (next: number, cur: number) => (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {t("stmt.totalNow", { amount: money(next), current: money(cur) })}
    </span>
  );

  return (
    <div className="space-y-6">
      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stmt.uploadTitle")}</CardTitle>
            <CardDescription>{t("stmt.uploadDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-12 cursor-pointer hover:bg-muted/40 transition-colors">
              {busy ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="size-8 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {busy ? t("stmt.analysing") : t("stmt.choose")}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground mt-3">{t("stmt.how")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("stmt.reviewIntro", { file: fileName ?? "" })}
          </p>

          {incomeRows.length > 0 && (
            <Section
              title={t("stmt.incomeTitle")}
              desc={t("stmt.incomeDesc")}
              right={totalNode(inclSum(incomeRows), curSum(current?.incomes))}
            >
              {incomeRows.map((r, i) => (
                <Row key={i} include={r.include} onToggle={(v) => setIncomeRows(upd(incomeRows, i, { include: v }))}>
                  <input
                    className="flex-1 bg-transparent border-b text-sm py-1 min-w-0"
                    value={r.label}
                    onChange={(e) => setIncomeRows(upd(incomeRows, i, { label: e.target.value }))}
                  />
                  {r.isSalary && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("stmt.salary")}
                    </Badge>
                  )}
                  <DiffBadge prev={existingAmount(current?.incomes, r.label)} />
                  <AmountInput
                    value={r.monthly_amount}
                    onChange={(v) => setIncomeRows(upd(incomeRows, i, { monthly_amount: v }))}
                  />
                </Row>
              ))}
            </Section>
          )}

          {fixedRows.length > 0 && (
            <Section
              title={t("stmt.fixedTitle")}
              desc={t("stmt.fixedDesc")}
              right={totalNode(inclSum(fixedRows), curSum(current?.fixed))}
            >
              {fixedRows.map((r, i) => (
                <Row key={i} include={r.include} onToggle={(v) => setFixedRows(upd(fixedRows, i, { include: v }))}>
                  <input
                    className="flex-1 bg-transparent border-b text-sm py-1 min-w-0"
                    value={r.label}
                    onChange={(e) => setFixedRows(upd(fixedRows, i, { label: e.target.value }))}
                  />
                  {r.cadence !== "monthly" && (
                    <Badge variant="outline" className="text-[10px]">
                      {t(r.cadence === "yearly" ? "stmt.yearly" : "stmt.quarterly")}
                    </Badge>
                  )}
                  <CategorySelect
                    value={r.category}
                    onChange={(v) => setFixedRows(upd(fixedRows, i, { category: v }))}
                  />
                  <DiffBadge prev={existingAmount(current?.fixed, r.label)} />
                  <AmountInput
                    value={r.monthly_amount}
                    onChange={(v) => setFixedRows(upd(fixedRows, i, { monthly_amount: v }))}
                  />
                </Row>
              ))}
            </Section>
          )}

          {debtRows.length > 0 && (
            <Section
              title={t("stmt.debtTitle")}
              desc={t("stmt.debtDesc")}
              right={totalNode(inclSum(debtRows), curSum(current?.debts))}
            >
              {debtRows.map((r, i) => (
                <Row key={i} include={r.include} onToggle={(v) => setDebtRows(upd(debtRows, i, { include: v }))}>
                  <input
                    className="flex-1 bg-transparent border-b text-sm py-1 min-w-0"
                    value={r.label}
                    onChange={(e) => setDebtRows(upd(debtRows, i, { label: e.target.value }))}
                  />
                  {current?.debts.some((d) => d.label.trim().toLowerCase() === r.label.trim().toLowerCase()) && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("stmt.exists")}
                    </Badge>
                  )}
                  <AmountInput
                    value={r.monthly_amount}
                    onChange={(v) => setDebtRows(upd(debtRows, i, { monthly_amount: v }))}
                  />
                </Row>
              ))}
            </Section>
          )}

          {varRows.length > 0 && (
            <Section
              title={t("stmt.variableTitle")}
              desc={t("stmt.variableDesc")}
              right={totalNode(inclSum(varRows), curSum(current?.variable))}
            >
              {varRows.map((r, i) => (
                <Row key={i} include={r.include} onToggle={(v) => setVarRows(upd(varRows, i, { include: v }))}>
                  <span className="flex-1 text-sm capitalize">{r.category}</span>
                  <span className="text-xs text-muted-foreground">{t("stmt.txns", { n: r.txnCount })}</span>
                  <DiffBadge prev={existingAmount(current?.variable, cap(r.category))} />
                  <AmountInput
                    value={r.monthly_amount}
                    onChange={(v) => setVarRows(upd(varRows, i, { monthly_amount: v }))}
                  />
                </Row>
              ))}
            </Section>
          )}

          {anomalies.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("stmt.anomaliesNote", {
                count: anomalies.length,
                list: anomalies.map((a) => `${a.description.slice(0, 20)} (${money(a.amount)})`).join(", "),
              })}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("upload")} disabled={busy}>
              {t("stmt.back")}
            </Button>
            <Button onClick={apply} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}
              {t("stmt.apply")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact button that opens the import flow in a dialog — for Settings lists. */
export function StatementImportButton({ householdId }: { householdId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> {t("nav.statementImport")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("stmt.title")}</DialogTitle>
            <DialogDescription>{t("stmt.subtitle")}</DialogDescription>
          </DialogHeader>
          <StatementImportFlow householdId={householdId} onApplied={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((r, j) => (j === i ? { ...r, ...patch } : r));
}

function Section({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
          {right && <div className="text-right shrink-0">{right}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({
  include,
  onToggle,
  children,
}: {
  include: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox checked={include} onCheckedChange={(v) => onToggle(!!v)} />
      {children}
    </div>
  );
}

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      inputMode="decimal"
      className="w-24 text-right"
      value={String(value)}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

function CategorySelect({ value, onChange }: { value: Category; onChange: (v: Category) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Category)}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c} className="capitalize">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
