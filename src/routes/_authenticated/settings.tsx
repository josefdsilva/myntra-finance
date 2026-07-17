import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold, updateHousehold, inviteMember } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { invalidateHouseholdData } from "@/lib/household-queries";
import { pageShellClass } from "@/components/page-shell";
import {
  upsertIncome,
  deleteIncome,
  upsertFixedExpense,
  deleteFixedExpense,
  upsertVariableEstimate,
  deleteVariableEstimate,
  upsertBucket,
  deleteBucket,
  upsertDebt,
  deleteDebt,
} from "@/lib/budget.functions";
import { getHouseholdCreditUsage } from "@/lib/credits.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { money, setCurrentCurrency } from "@/lib/format";
import { impliedAnnualRate } from "@/lib/amortization";
import { differenceInCalendarMonths } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Copy, Check, Zap } from "lucide-react";
import { NotificationSettings } from "@/components/notification-settings";
import { DangerZone } from "@/components/danger-zone";
import { StatementImportButton } from "@/components/statement-import-flow";
import { LanguageSettings } from "@/components/language-settings";
import { CategoryManager } from "@/components/category-manager";
import { useCategoryNames } from "@/hooks/use-categories";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · bynku" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const {
    data: hh,
    isLoading: hhLoading,
    error: hhError,
    refetch: refetchHh,
  } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
    retry: 1,
  });
  const householdId = hh?.household?.id;

  return (
    <div className={pageShellClass("4xl")}>
      <header>
        <h1 className="text-3xl font-display">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <LanguageSettings />

      {hhLoading && !hh && (
        <div className="space-y-3">
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        </div>
      )}

      {hhError && !hh && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{t("settings.loadError")}</p>
          <p className="text-muted-foreground mt-1">{(hhError as Error).message}</p>
          <button
            type="button"
            onClick={() => refetchHh()}
            className="mt-3 inline-flex items-center rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {householdId && (
        <>
          <HouseholdSection
            household={hh!.household!}
            onChange={() => qc.invalidateQueries({ queryKey: ["household"] })}
          />
          <IncomesSection householdId={householdId} />
          <FixedExpensesSection householdId={householdId} />
          <DebtsSection householdId={householdId} />
          <VariableEstimatesSection householdId={householdId} />
          <CategoryManager householdId={householdId} />
          <BucketsSection householdId={householdId} />
          <MembersSection householdId={householdId} />
          <NotificationSettings householdId={householdId} />
          <CreditUsageSection household={hh!.household!} />
          <DangerZone
            householdId={householdId}
            householdName={hh!.household!.name ?? t("hh.defaultName")}
            role={hh!.role ?? "member"}
          />
        </>
      )}
    </div>
  );
}

function operationLabels(t: ReturnType<typeof useT>): Record<string, string> {
  return {
    ai_coach_overview: t("credits.opCoachOverview"),
    ai_coach_chat: t("credits.opCoachChat"),
    ai_parse_memo: t("credits.opParseMemo"),
    ai_parse_voice: t("credits.opParseVoice"),
    ai_parse_photo: t("credits.opParsePhoto"),
    ai_parse_statement: t("credits.opParseStatement"),
  };
}

const HARDWIRED_CAP = 10;

function rowsOrEmpty<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

function CreditUsageSection({ household }: { household: { id: string } }) {
  const t = useT();
  const opLabels = operationLabels(t);
  const fetchUsage = useServerFn(getHouseholdCreditUsage);
  const { data } = useQuery({
    queryKey: ["credit-usage", household.id],
    queryFn: () => fetchUsage({ data: { householdId: household.id } }),
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;
  const capValue = HARDWIRED_CAP;
  const pct = Math.min(100, (total / capValue) * 100);
  const remaining = Math.max(0, capValue - total);
  const overCap = total > capValue;

  const periodLabel = data?.periodStart
    ? new Date(data.periodStart).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-5 text-primary" />
          {t("credits.title")}{" "}
          {periodLabel && (
            <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
          )}
        </CardTitle>
        <CardDescription>{t("credits.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-3xl font-display tabular-nums" data-lovable-blur-currency>
                {total.toFixed(3)}
              </span>
              <span className="text-sm text-muted-foreground ml-2">
                / {capValue.toFixed(2)} credits
              </span>
            </div>
            <div
              className={`text-sm tabular-nums ${overCap ? "text-destructive font-medium" : "text-muted-foreground"}`}
            >
              {overCap
                ? t("credits.overBy", { value: (total - capValue).toFixed(3) })
                : t("credits.remaining", { value: remaining.toFixed(3) })}
            </div>
          </div>
          <Progress value={pct} className={overCap ? "[&>*]:bg-destructive" : ""} />
        </div>

        <p className="text-xs text-muted-foreground">
          {t("credits.capNote", { cap: HARDWIRED_CAP })}
        </p>

        {data?.breakdown && data.breakdown.length > 0 ? (
          <div>
            <div className="text-sm font-medium mb-2">{t("credits.byFeature")}</div>
            <div className="space-y-1.5">
              {data.breakdown.map((b) => (
                <div
                  key={b.operation}
                  className="flex items-center justify-between text-sm rounded-md px-3 py-2 bg-muted/40"
                >
                  <div>
                    <div>{opLabels[b.operation] ?? b.operation}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.count} call{b.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="tabular-nums font-medium">{b.credits.toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("credits.noActivity")}</p>
        )}

        {data?.recent && data.recent.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              {t("credits.recent", { count: data.recent.length })}
            </summary>
            <div className="mt-2 space-y-1">
              {data.recent.map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b last:border-b-0">
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {opLabels[r.operation] ?? r.operation}
                  </span>
                  <span className="tabular-nums">
                    {r.credits.toFixed(4)}
                    {r.input_tokens || r.output_tokens ? (
                      <span className="text-muted-foreground ml-2">
                        ({r.input_tokens ?? 0}→{r.output_tokens ?? 0} tok)
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-xs text-muted-foreground">{t("credits.pricingNote")}</p>
      </CardContent>
    </Card>
  );
}

function HouseholdSection({
  household,
  onChange,
}: {
  household: {
    id: string;
    name: string;
    baseline_budget: number | string;
    margin_pct: number | string;
    country?: string | null;
    adults?: number | null;
    children?: number | null;
  };
  onChange: () => void;
}) {
  const t = useT();
  const update = useServerFn(updateHousehold);
  const qc = useQueryClient();
  const [name, setName] = useState(household.name);
  const [margin, setMargin] = useState(Number(household.margin_pct));
  const [country, setCountry] = useState((household.country ?? "PT").toUpperCase());
  const [adults, setAdults] = useState(Number(household.adults ?? 2));
  const [children, setChildren] = useState(Number(household.children ?? 0));
  const [currency, setCurrency] = useState<"EUR" | "USD" | "GBP">(
    (String(household.currency ?? "EUR").toUpperCase() as "EUR" | "USD" | "GBP") ?? "EUR",
  );

  const { data: fixedRows } = useQuery({
    queryKey: ["fixed-total", household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("monthly_amount")
        .eq("household_id", household.id);
      if (error) throw error;
      return rowsOrEmpty(data);
    },
  });
  const { data: debtRows } = useQuery({
    queryKey: ["debts-total", household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("monthly_amount")
        .eq("household_id", household.id);
      if (error) throw error;
      return rowsOrEmpty(data);
    },
  });
  const { data: varRows } = useQuery({
    queryKey: ["variable-estimates-total", household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variable_estimates")
        .select("monthly_amount")
        .eq("household_id", household.id);
      if (error) throw error;
      return rowsOrEmpty(data);
    },
  });

  const fixedTotal = rowsOrEmpty(fixedRows).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const debtTotal = rowsOrEmpty(debtRows).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const varTotal = rowsOrEmpty(varRows).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const safetyReserve = ((fixedTotal + debtTotal + varTotal) * margin) / 100;
  const baseline = fixedTotal + debtTotal + varTotal + safetyReserve;
  const storedBaseline = Number(household.baseline_budget);

  // Auto-persist computed baseline whenever the inputs change
  useEffect(() => {
    if (!Array.isArray(fixedRows) || !Array.isArray(varRows) || !Array.isArray(debtRows)) return;
    if (Math.abs(baseline - storedBaseline) < 0.005 && margin === Number(household.margin_pct))
      return;
    update({
      data: {
        household_id: household.id,
        baseline_budget: Number(baseline.toFixed(2)),
        margin_pct: margin,
      },
    })
      .then(() => {
        onChange();
        invalidateHouseholdData(qc);
        qc.invalidateQueries({ queryKey: ["allocations"] });
      })
      .catch(() => {});
    // Intentionally excludes stable refs (update, onChange, qc, household.*) to
    // avoid write loops; recomputes only when the derived baseline inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, margin, storedBaseline, fixedRows, varRows, debtRows]);

  async function saveName() {
    try {
      await update({ data: { household_id: household.id, name } });
      toast.success(t("hh.savedToast"));
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("hh.failedToast"));
    }
  }

  async function saveCurrency(next: "EUR" | "USD" | "GBP") {
    setCurrency(next);
    setCurrentCurrency(next); // update money() formatting immediately
    try {
      await update({ data: { household_id: household.id, currency: next } });
      onChange();
      qc.invalidateQueries({ queryKey: ["household", household.id] });
      qc.invalidateQueries({ queryKey: ["household"] });
      toast.success(t("hh.savedToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("hh.failedToast"));
    }
  }

  async function saveProfile() {
    try {
      await update({
        data: {
          household_id: household.id,
          country: country.toUpperCase().slice(0, 2),
          adults: Math.max(1, Math.round(adults)),
          children: Math.max(0, Math.round(children)),
        },
      });
      toast.success(t("hh.savedToast"));
      onChange();
      qc.invalidateQueries({ queryKey: ["household-demographics", household.id] });
      qc.invalidateQueries({ queryKey: ["coach"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("hh.failedToast"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("hh.title")}</CardTitle>
        <CardDescription>{t("hh.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("hh.name")}</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveName} variant="outline">
                {t("common.save")}
              </Button>
            </div>
          </div>
          <div>
            <Label>{t("hh.safetyMargin", { value: margin })}</Label>
            <Slider
              value={[margin]}
              min={0}
              max={30}
              step={1}
              onValueChange={(v) => setMargin(v[0])}
              className="mt-3"
            />
          </div>
          <div>
            <Label>{t("hh.currency")}</Label>
            <Select value={currency} onValueChange={(v) => saveCurrency(v as "EUR" | "USD" | "GBP")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">€ EUR</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="GBP">£ GBP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("hh.currencyHint")}</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Household profile</div>
              <div className="text-xs text-muted-foreground">
                Used to compare your finances against national benchmarks (public reference data,
                never other users&apos; data).
              </div>
            </div>
            <Button onClick={saveProfile} variant="outline" size="sm">
              {t("common.save")}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Country (ISO)</Label>
              <Input
                value={country}
                maxLength={2}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="PT"
              />
            </div>
            <div>
              <Label>Adults</Label>
              <Input
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Children (under 14)</Label>
              <Input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t("hh.fixedMonthly")}</span>
            <span className="tabular-nums">{money(fixedTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Debt payments</span>
            <span className="tabular-nums">{money(debtTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t("hh.variableEst")}</span>
            <span className="tabular-nums">{money(varTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("hh.marginRow", { value: margin })}</span>
            <span className="tabular-nums">{money(safetyReserve)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-medium">
            <span>{t("hh.baseline")}</span>
            <span className="tabular-nums text-lg">{money(baseline)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VariableEstimatesSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertVariableEstimate);
  const del = useServerFn(deleteVariableEstimate);
  const { data: rows, refetch } = useQuery({
    queryKey: ["variable-estimates", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variable_estimates")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const { names: catNames } = useCategoryNames(householdId);
  const categoryOptions = catNames.length ? catNames : ["groceries", "other"];
  const [category, setCategory] = useState("groceries");

  useEffect(() => {
    if (categoryOptions.length && !categoryOptions.includes(category)) {
      setCategory(categoryOptions[0]);
    }
  }, [categoryOptions, category]);

  async function add() {
    if (!label || !amount) return;
    await upsert({
      data: { household_id: householdId, label, category, monthly_amount: parseFloat(amount) || 0 },
    });
    setLabel("");
    setAmount("");
    refetch();
    qc.invalidateQueries({ queryKey: ["variable-estimates-total", householdId] });
    qc.invalidateQueries({ queryKey: ["household"] });
    invalidateHouseholdData(qc);
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    qc.invalidateQueries({ queryKey: ["variable-estimates-total", householdId] });
    qc.invalidateQueries({ queryKey: ["household"] });
    invalidateHouseholdData(qc);
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("var.title")}</CardTitle>
            <CardDescription>
              {t("var.description")} {t("common.total")}:{" "}
              <span className="font-medium text-foreground">{money(total)}</span>
            </CardDescription>
          </div>
          <StatementImportButton householdId={householdId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p>{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
          <Input
            placeholder={t("var.placeholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
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
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button onClick={add}>
            <Plus /> {t("common.add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomesSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertIncome);
  const del = useServerFn(deleteIncome);
  const { data: rows, refetch } = useQuery({
    queryKey: ["incomes", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  async function add() {
    if (!label || !amount) return;
    await upsert({
      data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 },
    });
    setLabel("");
    setAmount("");
    refetch();
    invalidateHouseholdData(qc);
    qc.invalidateQueries({ queryKey: ["allocations"] });
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    invalidateHouseholdData(qc);
    qc.invalidateQueries({ queryKey: ["allocations"] });
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("income.title")}</CardTitle>
            <CardDescription>
              {t("common.total")}: <span className="font-medium text-foreground">{money(total)}</span>
            </CardDescription>
          </div>
          <StatementImportButton householdId={householdId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>{r.label}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
          <Input
            placeholder={t("income.placeholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button onClick={add}>
            <Plus /> {t("common.add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FixedExpensesSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertFixedExpense);
  const del = useServerFn(deleteFixedExpense);
  const { data: rows, refetch } = useQuery({
    queryKey: ["fixed", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const { names: catNames } = useCategoryNames(householdId);
  const categoryOptions = catNames.length ? catNames : ["housing", "other"];
  const [category, setCategory] = useState("housing");

  useEffect(() => {
    if (categoryOptions.length && !categoryOptions.includes(category)) {
      setCategory(categoryOptions[0]);
    }
  }, [categoryOptions, category]);

  async function add() {
    if (!label || !amount) return;
    await upsert({
      data: { household_id: householdId, label, category, monthly_amount: parseFloat(amount) || 0 },
    });
    setLabel("");
    setAmount("");
    refetch();
    qc.invalidateQueries({ queryKey: ["fixed-total", householdId] });
    qc.invalidateQueries({ queryKey: ["household"] });
    invalidateHouseholdData(qc);
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    qc.invalidateQueries({ queryKey: ["fixed-total", householdId] });
    qc.invalidateQueries({ queryKey: ["household"] });
    invalidateHouseholdData(qc);
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("fixed.title")}</CardTitle>
            <CardDescription>
              {t("fixed.description")} {t("common.total")}:{" "}
              <span className="font-medium text-foreground">{money(total)}</span>
            </CardDescription>
          </div>
          <StatementImportButton householdId={householdId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p>{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
          <Input
            placeholder={t("fixed.placeholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
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
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button onClick={add}>
            <Plus /> {t("common.add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BucketsSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertBucket);
  const del = useServerFn(deleteBucket);
  const { data: rows, refetch } = useQuery({
    queryKey: ["buckets-settings", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buckets")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  async function save(b: typeof rows extends (infer T)[] | null | undefined ? T : never) {
    await upsert({
      data: {
        id: b.id,
        household_id: householdId,
        name: b.name,
        target_type: b.target_type,
        target_value: Number(b.target_value),
        target_deadline: b.target_deadline ?? null,
        color: b.color,
        sort_order: b.sort_order,
        initial_balance: Number(b.initial_balance ?? 0),
        kind: (b.kind as "savings" | "emergency" | "investment") ?? "savings",
      },
    });
    qc.invalidateQueries({ queryKey: ["allocations"] });
    invalidateHouseholdData(qc);
    refetch();
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    qc.invalidateQueries({ queryKey: ["allocations"] });
    invalidateHouseholdData(qc);
  }
  async function addNew() {
    await upsert({
      data: {
        household_id: householdId,
        name: t("buckets.newBucketName"),
        target_type: "pct_surplus",
        target_value: 10,
        color: "#2c6e6b",
        sort_order: rows?.length ?? 0,
        initial_balance: 0,
        kind: "savings",
      },
    });
    invalidateHouseholdData(qc);
    refetch();
  }

  const pctTotal = (rows ?? [])
    .filter((r) => r.target_type === "pct_surplus")
    .reduce((s, r) => s + Number(r.target_value), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("buckets.title")}</CardTitle>
        <CardDescription>
          {t("buckets.description", { pct: `<${pctTotal}>` })
            .split(`<${pctTotal}>`)
            .flatMap((part, i, arr) =>
              i < arr.length - 1
                ? [
                    part,
                    <span
                      key={i}
                      className={`font-medium ${pctTotal > 100 ? "text-destructive" : "text-foreground"}`}
                    >
                      {pctTotal}%
                    </span>,
                  ]
                : [part],
            )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(rows ?? []).map((b) => (
          <BucketRow key={b.id} bucket={b} onSave={save} onRemove={() => remove(b.id)} />
        ))}
        <Button variant="outline" onClick={addNew}>
          <Plus /> {t("buckets.add")}
        </Button>
      </CardContent>
    </Card>
  );
}

type BucketRowShape = {
  id: string;
  name: string;
  color?: string | null;
  target_type: string;
  target_value: number | string;
  target_deadline: string | null;
  priority?: number | null;
  initial_balance?: number | string | null;
  kind?: "savings" | "emergency" | "investment" | null;
  [key: string]: unknown;
};

function BucketRow<T extends BucketRowShape>({
  bucket,
  onSave,
  onRemove,
}: {
  bucket: T;
  onSave: (b: T) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [b, setB] = useState(bucket);
  const dirty = JSON.stringify(b) !== JSON.stringify(bucket);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <Label>{t("buckets.name")}</Label>
          <Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
        </div>
        <div>
          <Label>{t("buckets.color")}</Label>
          <Input
            type="color"
            value={b.color ?? "#2c6e6b"}
            onChange={(e) => setB({ ...b, color: e.target.value })}
            className="w-16 p-1 h-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>{t("buckets.kindLabel")}</Label>
          <Select
            value={b.kind ?? "savings"}
            onValueChange={(v) =>
              setB({ ...b, kind: v as "savings" | "emergency" | "investment" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">{t("buckets.kindSavings")}</SelectItem>
              <SelectItem value="emergency">{t("buckets.kindEmergency")}</SelectItem>
              <SelectItem value="investment">{t("buckets.kindInvestment")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{t("buckets.kindHint")}</p>
        </div>
        <div>
          <Label>{t("buckets.targetType")}</Label>
          <Select value={b.target_type} onValueChange={(v) => setB({ ...b, target_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pct_surplus">{t("buckets.pctSurplus")}</SelectItem>
              <SelectItem value="fixed_monthly">{t("buckets.fixedMonthly")}</SelectItem>
              <SelectItem value="fixed_yearly">{t("buckets.fixedYearly")}</SelectItem>
              <SelectItem value="goal_by_date">{t("buckets.goalByDate")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>
            {b.target_type === "pct_surplus"
              ? t("buckets.targetPct", { value: b.target_value })
              : b.target_type === "goal_by_date"
                ? t("buckets.goalAmount")
                : t("buckets.targetAmount")}
          </Label>
          {b.target_type === "pct_surplus" ? (
            <Slider
              value={[Number(b.target_value)]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setB({ ...b, target_value: v[0] })}
              className="mt-3"
            />
          ) : (
            <Input
              inputMode="decimal"
              value={b.target_value}
              onChange={(e) => setB({ ...b, target_value: parseFloat(e.target.value) || 0 })}
            />
          )}
        </div>
        {b.target_type === "goal_by_date" && (
          <div>
            <Label>{t("buckets.reachBy")}</Label>
            <Input
              type="date"
              value={b.target_deadline ?? ""}
              onChange={(e) => setB({ ...b, target_deadline: e.target.value || null })}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("buckets.reachByHint")}</p>
          </div>
        )}
        <div>
          <Label>{t("buckets.initialBalance")}</Label>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={b.initial_balance ?? 0}
            onChange={(e) => setB({ ...b, initial_balance: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("buckets.initialBalanceHint")}</p>
        </div>
      </div>
      {dirty && (
        <Button size="sm" onClick={() => onSave(b)}>
          {t("common.saveChanges")}
        </Button>
      )}
    </div>
  );
}

function MembersSection({ householdId }: { householdId: string }) {
  const t = useT();
  const invite = useServerFn(inviteMember);
  const { data: members } = useQuery({
    queryKey: ["members", householdId],
    queryFn: async () => {
      const { data: hm } = await supabase
        .from("household_members")
        .select("user_id, role, joined_at")
        .eq("household_id", householdId);
      if (!hm?.length) return [];
      const ids = hm.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      return hm.map((m) => ({ ...m, profile: profiles?.find((p) => p.user_id === m.user_id) }));
    },
  });
  const { data: invites, refetch } = useQuery({
    queryKey: ["invites", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("household_invitations")
        .select("*")
        .eq("household_id", householdId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function send() {
    if (!email) return;
    try {
      await invite({ data: { household_id: householdId, email } });
      setEmail("");
      toast.success(t("members.invitationCreatedToast"));
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("members.failedToast"));
    }
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("members.title")}</CardTitle>
        <CardDescription>{t("members.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex justify-between py-2">
              <span>{m.profile?.display_name ?? t("members.fallbackName")}</span>
              <span className="text-xs uppercase text-muted-foreground">{m.role}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <Input
            type="email"
            placeholder="partner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={send}>
            <Mail /> {t("members.inviteBtn")}
          </Button>
        </div>
        {!!invites?.length && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("members.pending")}</p>
            <ul className="space-y-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{i.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{inviteLink(i.token)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(i.token)}>
                    {copied === i.token ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DebtKind = "mortgage" | "personal" | "auto" | "credit_card" | "student" | "other";

function debtKinds(t: ReturnType<typeof useT>): Array<{ value: DebtKind; label: string }> {
  return [
    { value: "mortgage", label: t("debts.kindMortgage") },
    { value: "personal", label: t("debts.kindPersonal") },
    { value: "auto", label: t("debts.kindAuto") },
    { value: "credit_card", label: t("debts.kindCreditCard") },
    { value: "student", label: t("debts.kindStudent") },
    { value: "other", label: t("debts.kindOther") },
  ];
}

function DebtsSection({ householdId }: { householdId: string }) {
  const t = useT();
  const DEBT_KINDS = debtKinds(t);
  const qc = useQueryClient();
  const upsert = useServerFn(upsertDebt);
  const del = useServerFn(deleteDebt);
  const { data: rows, refetch } = useQuery({
    queryKey: ["debts", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<(typeof DEBT_KINDS)[number]["value"]>("mortgage");
  const [monthly, setMonthly] = useState("");
  const [taeg, setTaeg] = useState("");
  const [principal, setPrincipal] = useState("");
  const [maturity, setMaturity] = useState("");

  function bumpCaches() {
    qc.invalidateQueries({ queryKey: ["debts-total", householdId] });
    qc.invalidateQueries({ queryKey: ["household"] });
    invalidateHouseholdData(qc);
    qc.invalidateQueries({ queryKey: ["fixed-total", householdId] });
    qc.invalidateQueries({ queryKey: ["fixed-rows", householdId] });
  }

  async function add() {
    if (!label || !monthly) return;
    await upsert({
      data: {
        household_id: householdId,
        label,
        kind,
        monthly_amount: parseFloat(monthly) || 0,
        taeg_pct: taeg ? parseFloat(taeg) : null,
        principal_remaining: principal ? parseFloat(principal) : null,
        maturity_date: maturity || null,
      },
    });
    setLabel("");
    setMonthly("");
    setTaeg("");
    setPrincipal("");
    setMaturity("");
    refetch();
    bumpCaches();
  }

  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    bumpCaches();
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const principalTotal = (rows ?? []).reduce((s, r) => s + Number(r.principal_remaining ?? 0), 0);

  // Live "deduced rate" preview: solve the annual effective rate from
  // principal + monthly + months to maturity. This is what the app uses for
  // payoff/interest — the entered all-in rate is only a reference estimate.
  const pNum = parseFloat(principal);
  const mNum = parseFloat(monthly);
  const termToMaturity = maturity
    ? differenceInCalendarMonths(new Date(maturity), new Date())
    : 0;
  const deducedRate =
    pNum && mNum && termToMaturity > 0 ? impliedAnnualRate(pNum, mNum, termToMaturity) : null;
  const deducedUnsolvable = !!(pNum && mNum && termToMaturity > 0 && deducedRate == null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Debt</CardTitle>
            <CardDescription>
              Loans and credit lines with an interest rate ({t("settings.debtRateLabel")}) and
              maturity. Counted alongside fixed expenses in your monthly baseline. Total:{" "}
              <span className="font-medium text-foreground">{money(total)}</span>
              {principalTotal > 0 && (
                <>
                  {" "}
                  · principal outstanding{" "}
                  <span className="font-medium text-foreground">{money(principalTotal)}</span>
                </>
              )}
              .
            </CardDescription>
          </div>
          <StatementImportButton householdId={householdId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 gap-3">
              <div className="min-w-0">
                <p className="truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {DEBT_KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}
                  {r.taeg_pct != null && ` · ${t("debt.apr", { pct: Number(r.taeg_pct).toFixed(2) })}`}
                  {r.principal_remaining != null &&
                    ` · principal ${money(Number(r.principal_remaining))}`}
                  {r.maturity_date && ` · until ${r.maturity_date}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums font-medium">
                  {money(r.monthly_amount)}
                  <span className="text-xs text-muted-foreground">/mo</span>
                </span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              placeholder="e.g. Prestação Crédito Habitação"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEBT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Monthly (€)</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">{t("settings.debtRateLabel")} %</Label>
            <Input
              inputMode="decimal"
              placeholder="e.g. 4.25"
              value={taeg}
              onChange={(e) => setTaeg(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Principal due (€)</Label>
            <Input
              inputMode="decimal"
              placeholder="e.g. 120000"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Maturity</Label>
            <Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} />
          </div>
        </div>
        {deducedRate != null && (
          <p className="text-xs text-muted-foreground">
            Deduced rate (used for payoff calculations):{" "}
            <span className="font-medium text-foreground">{deducedRate.toFixed(2)}%</span>
          </p>
        )}
        {deducedUnsolvable && (
          <p className="text-xs text-destructive">
            These values don&apos;t add up — the monthly payment is too low to clear the principal by
            that date. Payoff will use your entered rate instead.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={add}>
            <Plus /> Add debt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
