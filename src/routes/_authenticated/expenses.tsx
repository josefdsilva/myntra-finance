import { createFileRoute } from "@tanstack/react-router";
import { pageShellClass } from "@/components/page-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { deleteExpense, addExpensesBulk } from "@/lib/budget.functions";
import { parseBankStatement } from "@/lib/ai-parse.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpenseQuickAdd } from "@/components/expense-quick-add";
import { SpendingVsEstimate } from "@/components/spending-vs-estimate";
import { FixedExpensesSection, VariableEstimatesSection } from "@/routes/_authenticated/settings";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { money, fmtDateTime, fmtDate } from "@/lib/format";
import { computeCycle } from "@/lib/cycle";
import { toast } from "sonner";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses · bynku" }] }),
  component: ExpensesPage,
});

import { useCategoryNames } from "@/hooks/use-categories";
import { useRecentLabels } from "@/hooks/use-labels";

function ExpensesPage() {
  const t = useT();
  const qc = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const del = useServerFn(deleteExpense);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const { names: catNames } = useCategoryNames(householdId);
  const categoryOptions = ["all", ...catNames];
  const { data: recentLabels = [] } = useRecentLabels(householdId);

  const [category, setCategory] = useState("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");

  const [cycleOffset, setCycleOffset] = useState(0);

  // Fetch salary history to derive pay cycles
  const { data: salaries } = useQuery({
    enabled: !!householdId,
    queryKey: ["salaries", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("occurred_at")
        .eq("household_id", householdId!)
        .eq("kind", "income")
        .eq("is_salary", true)
        .order("occurred_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []).map((r) => r.occurred_at as string);
    },
  });

  // Compute cycle bounds for the selected offset (0 = current, -1 previous, +1 next predicted)
  const cycle = useMemo(() => {
    const list = salaries ?? [];
    if (cycleOffset === 0) return computeCycle(list);
    if (cycleOffset < 0) {
      // Historic cycle: between salary[i] (start) and salary[i-1] (end)
      const i = -cycleOffset;
      const startStr = list[i];
      const endStr = list[i - 1];
      if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        return { start, end, source: "salary" as const, predicted: false };
      }
      const base = computeCycle(list);
      const start = new Date(base.start);
      start.setMonth(start.getMonth() + cycleOffset);
      const end = new Date(base.end);
      end.setMonth(end.getMonth() + cycleOffset);
      return { start, end, source: base.source, predicted: true };
    }
    // Future predicted cycle: shift by +1 month from current
    const base = computeCycle(list);
    const start = new Date(base.start);
    start.setMonth(start.getMonth() + cycleOffset);
    const end = new Date(base.end);
    end.setMonth(end.getMonth() + cycleOffset);
    return { ...base, start, end, predicted: true };
  }, [salaries, cycleOffset]);

  const { data: rows, refetch } = useQuery({
    enabled: !!householdId && !!cycle,
    queryKey: [
      "expenses-list",
      householdId,
      category,
      labelFilter,
      cycle?.start?.toISOString(),
      cycle?.end?.toISOString(),
    ],
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("*")
        .eq("household_id", householdId!)
        .gte("occurred_at", cycle!.start.toISOString())
        .lt("occurred_at", cycle!.end.toISOString())
        .order("occurred_at", { ascending: false });
      if (category !== "all") q = q.eq("category", category);
      if (labelFilter !== "all") q = q.contains("labels", [labelFilter]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fixedTotal = 0 } = useQuery({
    enabled: !!householdId,
    queryKey: ["expenses-fixed-plus-debt-total", householdId],
    queryFn: async () => {
      const [{ data: fx, error: e1 }, { data: dt, error: e2 }] = await Promise.all([
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("debts").select("monthly_amount").eq("household_id", householdId!),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const sum = (rows: Array<{ monthly_amount: number | string }> | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return sum(fx) + sum(dt);
    },
  });

  async function remove(id: string) {
    await del({ data: { id } });
    toast.success(t("exp.removedToast"));
    refetch();
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const spent = (rows ?? [])
    .filter((r) => r.kind !== "income")
    .reduce((s, r) => s + Number(r.amount), 0);
  const received = (rows ?? [])
    .filter((r) => r.kind === "income")
    .reduce((s, r) => s + Number(r.amount), 0);
  const net = received - spent - fixedTotal;
  const cycleLabel = cycle
    ? t("exp.cycleLabel", {
        start: fmtDate(cycle.start.toISOString()),
        end: fmtDate(cycle.end.toISOString()),
      }) + (cycle.predicted ? t("dashboard.cycle.predicted") : "")
    : t("exp.cycleLabel", { start: "", end: "" });

  return (
    <div className={pageShellClass("5xl")}>
      <header>
        <h1 className="text-3xl font-display">{t("exp.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("exp.subtitle")}</p>
      </header>

      {householdId && (
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="add">
              <TabsList className="mb-4">
                <TabsTrigger value="add">{t("exp.addTitle")}</TabsTrigger>
                <TabsTrigger value="statement">{t("exp.tabStatement")}</TabsTrigger>
              </TabsList>
              <TabsContent value="add">
                <ExpenseQuickAdd
                  householdId={householdId}
                  onAdded={() => {
                    refetch();
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  }}
                />
              </TabsContent>
              <TabsContent value="statement">
                <BankImport
                  householdId={householdId}
                  onImported={() => {
                    refetch();
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {householdId && <SpendingVsEstimate householdId={householdId} />}

      {householdId && <FixedExpensesSection householdId={householdId} />}
      {householdId && <VariableEstimatesSection householdId={householdId} />}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{cycleLabel}</CardTitle>
              <CardDescription>
                {t("exp.subtitle.entries", { count: rows?.length ?? 0 })} ·{" "}
                {t("exp.subtitle.spent", { value: money(spent) })}
                {received > 0 ? ` · ${t("exp.subtitle.received", { value: money(received) })}` : ""}
                {fixedTotal > 0
                  ? ` · ${t("exp.subtitle.fixed", { value: money(fixedTotal) })}`
                  : ""}
                {received > 0 ? ` · ${t("exp.subtitle.net", { value: money(net) })}` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCycleOffset((o) => o - 1)}>
                  {t("exp.prev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCycleOffset(0)}
                  disabled={cycleOffset === 0}
                >
                  {t("exp.current")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCycleOffset((o) => o + 1)}
                  disabled={cycleOffset >= 0}
                >
                  {t("exp.next")}
                </Button>
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recentLabels.length > 0 && (
                <Select value={labelFilter} onValueChange={setLabelFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder={t("exp.allLabels")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("exp.allLabels")}</SelectItem>
                    {recentLabels.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!rows?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("exp.empty")}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((e) => {
                const isIncome = e.kind === "income";
                return (
                  <li key={e.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.merchant || e.note || e.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDateTime(e.occurred_at)} · {e.category}
                        {isIncome ? t("exp.receivedSuffix") : ""} ·{" "}
                        <span className="capitalize">{e.source.replace("_", " ")}</span>
                      </p>
                      {e.note && (e.merchant || e.category) && e.note !== e.merchant && (
                        <p className="text-xs text-muted-foreground/80 italic truncate mt-0.5">
                          {e.note}
                        </p>
                      )}
                      {Array.isArray(e.labels) && e.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {e.labels.map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setLabelFilter(l)}
                              className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20"
                              title={t("exp.filterByLabel", { label: l })}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className={`font-medium tabular-nums ${isIncome ? "text-primary" : ""}`}>
                      {isIncome ? "+" : "−"}
                      {money(e.amount)}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ParsedItem = {
  amount: number;
  category: string;
  merchant?: string | null;
  occurred_at?: string;
  note?: string | null;
};

function BankImport({ householdId, onImported }: { householdId: string; onImported: () => void }) {
  const t = useT();
  const parse = useServerFn(parseBankStatement);
  const bulk = useServerFn(addExpensesBulk);
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [dupFlags, setDupFlags] = useState<boolean[]>([]);

  async function detectDuplicates(parsed: ParsedItem[]) {
    if (!parsed.length) return { flags: [] as boolean[] };
    const times = parsed
      .map((p) => (p.occurred_at ? new Date(p.occurred_at).getTime() : NaN))
      .filter((tms) => !isNaN(tms));
    const minT = times.length ? Math.min(...times) : Date.now();
    const maxT = times.length ? Math.max(...times) : Date.now();
    const from = new Date(minT - 2 * 86400_000).toISOString();
    const to = new Date(maxT + 2 * 86400_000).toISOString();
    const { data } = await supabase
      .from("expenses")
      .select("amount, occurred_at, merchant")
      .eq("household_id", householdId)
      .neq("kind", "income")
      .gte("occurred_at", from)
      .lte("occurred_at", to);
    const existing = (data ?? []).map((r) => ({
      amount: Math.abs(Number(r.amount)),
      t: new Date(r.occurred_at as string).getTime(),
      merchant: (r.merchant ?? "").toLowerCase().trim(),
    }));
    const flags = parsed.map((p) => {
      const pt = p.occurred_at ? new Date(p.occurred_at).getTime() : NaN;
      const pm = (p.merchant ?? "").toLowerCase().trim();
      const pa = Math.abs(Number(p.amount));
      return existing.some((e) => {
        if (Math.abs(e.amount - pa) > 0.01) return false;
        if (!isNaN(pt) && Math.abs(e.t - pt) > 2 * 86400_000) return false;
        if (pm && e.merchant && pm !== e.merchant) return false;
        return true;
      });
    });
    return { flags };
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error(t("exp.fileTooLarge"));
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await parse({
        data: {
          file_base64: base64,
          mime_type: f.type || "application/pdf",
          file_name: f.name,
          householdId,
        },
      });
      const parsed = res.items as ParsedItem[];
      const { flags } = await detectDuplicates(parsed);
      setItems(parsed);
      setDupFlags(flags);
      setSelected(flags.map((isDup) => !isDup));
      const dupCount = flags.filter(Boolean).length;
      const dupNote = !dupCount
        ? ""
        : dupCount === 1
          ? t("exp.dupCountSingular")
          : t("exp.dupCountPlural", { count: dupCount });
      toast.success(t("exp.parsedTransactions", { count: parsed.length }) + dupNote);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("exp.parseFailed"));
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function confirmImport() {
    if (!items?.length) return;
    const toImport = items.filter((_, i) => selected[i]);
    if (!toImport.length) return toast.error(t("exp.nothingSelected"));
    setLoading(true);
    try {
      await bulk({
        data: {
          items: toImport.map((i) => ({
            household_id: householdId,
            amount: i.amount,
            category: i.category,
            merchant: i.merchant,
            occurred_at: i.occurred_at,
            note: i.note,
            source: "statement" as const,
          })),
        },
      });
      const skipped = items.length - toImport.length;
      const skippedNote = skipped ? t("exp.skippedCount", { count: skipped }) : "";
      toast.success(t("exp.importedCount", { count: toImport.length }) + skippedNote);
      setItems(null);
      setSelected([]);
      setDupFlags([]);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("exp.importFailed"));
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = selected.filter(Boolean).length;
  const selectedTotal = items
    ? items.reduce((s, it, i) => s + (selected[i] ? it.amount : 0), 0)
    : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload a CSV or PDF bank statement with last transactions for consolidation. Likely
        duplicates are pre-unchecked.
      </p>
      <div className="flex items-center gap-3">
          <Input
            ref={ref}
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            onChange={onFile}
            disabled={loading}
          />
          {loading && <Loader2 className="animate-spin text-muted-foreground" />}
        </div>
        {items && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {selectedCount} / {items.length} selected · total {money(selectedTotal)}
              </span>
              <div className="flex gap-2">
                <button className="underline" onClick={() => setSelected(items.map(() => true))}>
                  Select all
                </button>
                <button className="underline" onClick={() => setSelected(dupFlags.map((d) => !d))}>
                  Reset dupes
                </button>
                <button className="underline" onClick={() => setSelected(items.map(() => false))}>
                  None
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
              {items.map((t, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${dupFlags[i] ? "bg-amber-500/5" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[i]}
                    onChange={(e) =>
                      setSelected((s) => s.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      {t.merchant || t.note || t.category}{" "}
                      {dupFlags[i] && (
                        <span className="text-amber-600 text-xs">· likely duplicate</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.occurred_at ? fmtDate(t.occurred_at) : "—"} · {t.category}
                    </p>
                  </div>
                  <span className="tabular-nums">{money(t.amount)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmImport} disabled={loading || selectedCount === 0}>
                <FileUp /> Import {selectedCount}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setItems(null);
                  setSelected([]);
                  setDupFlags([]);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
