import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { deleteExpense, addExpensesBulk } from "@/lib/budget.functions";
import { parseBankStatement } from "@/lib/ai-parse.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpenseQuickAdd } from "@/components/expense-quick-add";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { money, fmtDateTime, fmtDate } from "@/lib/format";
import { computeCycle } from "@/lib/cycle";
import { toast } from "sonner";
import { FileUp, Loader2, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses · Household Budget" }] }),
  component: ExpensesPage,
});

const CATEGORIES = [
  "all", "groceries", "dining", "transport", "fuel", "utilities", "housing",
  "subscriptions", "health", "kids", "shopping", "entertainment", "travel", "gifts", "other",
];

function ExpensesPage() {
  const qc = useQueryClient();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const del = useServerFn(deleteExpense);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHh() });
  const householdId = hh?.household?.id;

  const [category, setCategory] = useState("all");
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
      // Historic cycle: between salary[|offset|] and salary[|offset|-1]
      const i = -cycleOffset; // 1,2,...
      const startStr = list[i];
      const endStr = list[i - 1];
      if (startStr && endStr) {
        return computeCycle(list.slice(i)); // treats salary[i] as latest → end predicted, but override end
          ? undefined as never
          : undefined as never;
      }
      // Fallback: shift current cycle by one month
      const base = computeCycle(list);
      const start = new Date(base.start); start.setMonth(start.getMonth() + cycleOffset);
      const end = new Date(base.end); end.setMonth(end.getMonth() + cycleOffset);
      return { ...base, start, end };
    }
    // Future predicted cycle: shift by +1 month from current
    const base = computeCycle(list);
    const start = new Date(base.start); start.setMonth(start.getMonth() + cycleOffset);
    const end = new Date(base.end); end.setMonth(end.getMonth() + cycleOffset);
    return { ...base, start, end, predicted: true };
  }, [salaries, cycleOffset]);


  async function remove(id: string) {
    await del({ data: { id } });
    toast.success("Removed");
    refetch();
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const spent = (rows ?? []).filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
  const received = (rows ?? []).filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
  const net = spent - received;
  const monthLabel = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
    .toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display">Expenses</h1>
        <p className="text-sm text-muted-foreground">Add, review and import.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add expense</CardTitle></CardHeader>
        <CardContent>{householdId && <ExpenseQuickAdd householdId={householdId} onAdded={() => { refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />}</CardContent>
      </Card>

      {householdId && <BankImport householdId={householdId} onImported={() => { refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{monthLabel}</CardTitle>
              <CardDescription>
                {rows?.length ?? 0} entries · {money(spent)} spent{received > 0 ? ` · ${money(received)} received · net ${money(net)}` : ""}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMonthOffset((o) => o - 1)}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)} disabled={monthOffset === 0}>Current</Button>
              <Button variant="outline" size="sm" onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0}>Next</Button>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!rows?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No expenses in this period.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((e) => {
                const isIncome = e.kind === "income";
                return (
                  <li key={e.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.merchant || e.note || e.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDateTime(e.occurred_at)} · {e.category}{isIncome ? " · received" : ""} · <span className="capitalize">{e.source.replace("_", " ")}</span>
                      </p>
                    </div>
                    <p className={`font-medium tabular-nums ${isIncome ? "text-primary" : ""}`}>
                      {isIncome ? "+" : "−"}{money(e.amount)}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="size-4" /></Button>
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

function BankImport({ householdId, onImported }: { householdId: string; onImported: () => void }) {
  const parse = useServerFn(parseBankStatement);
  const bulk = useServerFn(addExpensesBulk);
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ amount: number; category: string; merchant?: string | null; occurred_at?: string; note?: string | null }> | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("File too large (max 10MB)");
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await parse({
        data: { file_base64: base64, mime_type: f.type || "application/pdf", file_name: f.name },
      });
      setItems(res.items);
      toast.success(`Parsed ${res.items.length} transactions — review below`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally { setLoading(false); if (ref.current) ref.current.value = ""; }
  }

  async function confirmImport() {
    if (!items?.length) return;
    setLoading(true);
    try {
      await bulk({
        data: {
          items: items.map((i) => ({
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
      toast.success(`Imported ${items.length} transactions`);
      setItems(null);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> Bank statement import</CardTitle>
        <CardDescription>Upload a CSV or PDF — AI will extract and categorize transactions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Input ref={ref} type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={onFile} disabled={loading} />
          {loading && <Loader2 className="animate-spin text-muted-foreground" />}
        </div>
        {items && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{items.length} transactions ready — total {money(items.reduce((s, i) => s + i.amount, 0))}</p>
            <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
              {items.map((t, i) => (
                <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="truncate">{t.merchant || t.note || t.category} · <span className="text-muted-foreground">{t.category}</span></span>
                  <span className="tabular-nums">{money(t.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmImport} disabled={loading}><FileUp /> Import all</Button>
              <Button variant="ghost" onClick={() => setItems(null)}>Discard</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
