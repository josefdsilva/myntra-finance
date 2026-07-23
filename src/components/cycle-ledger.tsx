import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { perCycleFromMonthly, type Cycle } from "@/lib/cadence";
import { planAppliesToMonth, monthKey, type Plan } from "@/lib/plan";
import { useT } from "@/lib/i18n";

/**
 * Committed lines expected this cycle: recurring income and fixed costs. Per the
 * product decision these are pure assumptions — shown as "expected", never
 * reconciled against reality — so they sit here as the backbone of the cycle
 * ledger while envelopes (Spending vs Estimate) and one-off plans carry the
 * actual-vs-expected comparison.
 */
export function CommittedThisCycle({
  householdId,
  cycle,
  isBusiness,
}: {
  householdId: string;
  cycle: Cycle;
  isBusiness: boolean;
}) {
  const t = useT();
  const suffix = t(`cadence.short.${cycle}`);
  const { data } = useQuery({
    queryKey: ["cycle-committed", householdId],
    queryFn: async () => {
      const [fx, inc, db] = await Promise.all([
        supabase
          .from("fixed_expenses")
          .select("id, label, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("incomes")
          .select("id, label, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("debts")
          .select("id, label, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
      ]);
      return {
        fixed: (fx.data ?? []) as Array<{ id: string; label: string; monthly_amount: number }>,
        incomes: (inc.data ?? []) as Array<{ id: string; label: string; monthly_amount: number }>,
        debts: (db.data ?? []) as Array<{ id: string; label: string; monthly_amount: number }>,
      };
    },
  });
  const fixed = data?.fixed ?? [];
  const incomes = data?.incomes ?? [];
  const debts = data?.debts ?? [];
  if (!fixed.length && !incomes.length && !debts.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("ledger.committedTitle")}</CardTitle>
        <CardDescription>{t("ledger.committedDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {incomes.length > 0 && (
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}
            </p>
            <ul className="divide-y">
              {incomes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="shrink-0 tabular-nums text-primary">
                    +{money(perCycleFromMonthly(Number(r.monthly_amount), cycle))}
                    {suffix}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {fixed.length > 0 && (
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t("cashflow.fixed")}
            </p>
            <ul className="divide-y">
              {fixed.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="shrink-0 tabular-nums">
                    −{money(perCycleFromMonthly(Number(r.monthly_amount), cycle))}
                    {suffix}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {debts.length > 0 && (
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t("cashflow.debt")}
            </p>
            <ul className="divide-y">
              {debts.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="shrink-0 tabular-nums">
                    −{money(perCycleFromMonthly(Number(r.monthly_amount), cycle))}
                    {suffix}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One-off (and repeating) plans that land in the current cycle. Open ones show
 * their expected amount; resolved ones show the actual with an over/under badge.
 * Reconciling (mark paid/received) happens on the Planned tab / Plan page.
 */
export function PlannedThisCycle({ householdId }: { householdId: string }) {
  const t = useT();
  const ym = monthKey(new Date());
  const { data: plans = [] } = useQuery({
    queryKey: ["cycle-plans", householdId, ym],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("household_id", householdId);
      return (data ?? []) as Plan[];
    },
  });

  const items = plans.filter(
    (p) =>
      (!p.done && planAppliesToMonth(p, ym)) ||
      (p.done && String(p.month).slice(0, 7) === ym),
  );
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("ledger.plannedTitle")}</CardTitle>
        <CardDescription>{t("ledger.plannedDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((p) => {
            const expected = Math.abs(Number(p.amount) || 0);
            const done = !!p.done;
            const actual = Number(p.actual_amount ?? 0);
            const magnitude = Math.abs(expected - actual);
            const favorable = p.direction === "income" ? actual >= expected : actual <= expected;
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {p.direction === "income" ? (
                    <TrendingUp className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <TrendingDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{p.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {done ? (
                    <>
                      <span>
                        {t("ledger.actual")} {money(actual)}
                      </span>
                      {magnitude >= 0.005 && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${favorable ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {favorable ? "−" : "+"}
                          {money(magnitude)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("ledger.expected")} {money(expected)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
