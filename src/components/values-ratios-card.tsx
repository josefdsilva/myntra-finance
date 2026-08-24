import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, TrendingUp, TrendingDown, Target, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { fetchCycleBoundsById, resolveClosedCycles } from "@/lib/cycle-bounds";
import { alignmentSummary, parseValues, valueLabelKey } from "@/lib/values";
import { valuesRatios, type RatioBucket } from "@/lib/values-ratios";

type ExpenseRow = {
  amount: number | string;
  category: string | null;
  intent: string | null;
  kind: string | null;
  labels: string[] | null;
};

type RecurringRow = {
  label: string | null;
  category: string | null;
  monthly_amount: number | string;
};


/**
 * "Money on what matters" — the values ratios that steer the journey. Of the
 * flexible money in this cycle, how much served the household's own values, how
 * much drifted elsewhere, and how much actually reached the dreams (buckets that
 * serve those values). Essentials are excluded on purpose: rent and groceries
 * are not a choice, so counting them would flatter everyone.
 */
export function ValuesRatiosCard({ householdId }: { householdId: string }) {
  const t = useT();

  const { data } = useQuery({
    queryKey: ["values-ratios", householdId],
    queryFn: async () => {
      const [{ data: hh }, bounds] = await Promise.all([
        supabase
          .from("households")
          .select("life_values, kind, cycle, cycle_mode, cycle_anchor_date")
          .eq("id", householdId)
          .maybeSingle(),
        fetchCycleBoundsById(supabase, householdId),
      ]);

      const closed = await resolveClosedCycles(supabase, householdId, hh ?? null, 1);
      const prev = closed[closed.length - 1] ?? null;

      const [
        current,
        previous,
        bucketsRes,
        allocRes,
        movesRes,
        incomesRes,
        peopleRes,
        fixedRes,
        varRes,
      ] = await Promise.all([
          supabase
            .from("expenses")
            .select("amount, category, intent, kind, labels")
            .eq("household_id", householdId)
            .gte("occurred_at", bounds.start.toISOString())
            .lt("occurred_at", bounds.end.toISOString()),
          prev
            ? supabase
                .from("expenses")
                .select("amount, category, intent, kind, labels")
                .eq("household_id", householdId)
                .gte("occurred_at", prev.start.toISOString())
                .lt("occurred_at", prev.end.toISOString())
            : Promise.resolve({ data: [] as ExpenseRow[] }),
          supabase
            .from("buckets")
            .select("id, name, kind, target_type, target_value, initial_balance")
            .eq("household_id", householdId),
          supabase
            .from("bucket_allocations")
            .select("bucket_id, amount, period, confirmed_at")
            .eq("household_id", householdId),
          supabase
            .from("account_movements")
            .select("to_type, to_id, from_type, from_id, amount, created_at")
            .eq("household_id", householdId)
            .gte("created_at", bounds.start.toISOString())
            .lt("created_at", bounds.end.toISOString()),
          supabase.from("incomes").select("monthly_amount").eq("household_id", householdId),
          supabase.from("household_people").select("name").eq("household_id", householdId),
          supabase
            .from("fixed_expenses")
            .select("label, category, monthly_amount")
            .eq("household_id", householdId),
          supabase
            .from("variable_estimates")
            .select("label, category, monthly_amount")
            .eq("household_id", householdId),
        ]);


      const rows = (current.data ?? []) as ExpenseRow[];
      const prevRows = (previous.data ?? []) as ExpenseRow[];

      const actualIncome = rows
        .filter((r) => r.kind === "income")
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const expectedIncome = (incomesRes.data ?? []).reduce(
        (s, r: { monthly_amount: number | string }) => s + (Number(r.monthly_amount) || 0),
        0,
      );

      const allocs = (allocRes.data ?? []) as Array<{
        bucket_id: string;
        amount: number | string;
        period: string;
        confirmed_at: string | null;
      }>;
      const startMs = bounds.start.getTime();
      const endMs = bounds.end.getTime();

      // Allocations are stamped with a normalised `period` (often the calendar
      // month start), so a payday cycle that starts mid-month would miss them.
      // What matters is when the household actually confirmed the money.
      const inCycle = (a: { period: string; confirmed_at: string | null }) => {
        const stamp = a.confirmed_at ?? a.period;
        const ms = new Date(stamp).getTime();
        return ms >= startMs && ms < endMs;
      };

      // Money transferred straight into a project account also funds the dream.
      const moves = (movesRes.data ?? []) as Array<{
        to_type: string | null;
        to_id: string | null;
        from_type: string | null;
        from_id: string | null;
        amount: number | string;
      }>;
      const movedInto = (bucketId: string) =>
        moves.reduce((s, m) => {
          const amt = Number(m.amount) || 0;
          if (m.to_type === "bucket" && m.to_id === bucketId) return s + amt;
          if (m.from_type === "bucket" && m.from_id === bucketId) return s - amt;
          return s;
        }, 0);

      const buckets: RatioBucket[] = ((bucketsRes.data ?? []) as Array<{
        id: string;
        name: string;
        kind: string | null;
        target_type: string;
        target_value: number | string | null;
        initial_balance: number | string | null;
      }>).map((b) => {
        const mine = allocs.filter((a) => a.bucket_id === b.id);
        const balance =
          (Number(b.initial_balance) || 0) + mine.reduce((s, a) => s + (Number(a.amount) || 0), 0);
        const fundedThisCycle = Math.max(
          0,
          mine.filter(inCycle).reduce((s, a) => s + (Number(a.amount) || 0), 0) + movedInto(b.id),
        );
        const periods = new Set(mine.map((a) => a.period));
        const monthlyPace = periods.size
          ? mine.reduce((s, a) => s + (Number(a.amount) || 0), 0) / periods.size
          : 0;
        // Only absolute targets give a meaningful "months to go" figure.
        const target =
          b.target_type === "fixed_monthly" || b.target_type === "pct_surplus"
            ? null
            : Number(b.target_value) || null;
        return {
          id: b.id,
          name: b.name,
          kind: b.kind,
          target,
          balance,
          fundedThisCycle,
          monthlyPace,
        };
      });

      const values = parseValues(hh?.life_values);
      const personNames = ((peopleRes.data ?? []) as Array<{ name: string | null }>)
        .map((p) => p.name ?? "")
        .filter((n) => n.trim().length >= 2);
      const prevPct = prevRows.length
        ? alignmentSummary(prevRows, values, { personNames }).alignedPct
        : null;

      // Recurring money the household already committed: fixed costs (rent,
      // kindergarten) and its own variable estimates (groceries, fuel). Both
      // feed the "already serving your values" total and the essentials yardstick.
      const recurring = [
        ...((fixedRes.data ?? []) as RecurringRow[]),
        ...((varRes.data ?? []) as RecurringRow[]),
      ];
      const plannedByCategory = recurring
        .filter((r) => (r.category ?? "").trim().length > 0)
        .map((r) => ({
          category: (r.category ?? "").trim(),
          amount: Number(r.monthly_amount) || 0,
        }));

      return {
        values,
        rows,
        buckets,
        income: actualIncome > 0 ? actualIncome : expectedIncome,
        prevPct,
        personNames,
        recurring,
        plannedByCategory,
      };
    },
  });

  const r = useMemo(
    () =>
      data
        ? valuesRatios({
            expenses: data.rows,
            values: data.values,
            income: data.income,
            buckets: data.buckets,
            prevAlignmentPct: data.prevPct,
            personNames: data.personNames,
            recurring: data.recurring,
            plannedByCategory: data.plannedByCategory,
          })
        : null,
    [data],
  );


  if (!r) return null;

  const gradeVariant =
    r.grade === "on_course" ? "default" : r.grade === "drifting" ? "secondary" : "destructive";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="size-4 text-primary" /> {t("align.title")}
            </CardTitle>
            <CardDescription>
              {r.unset ? t("align.unset") : t("align.body", { pct: r.alignmentPct })}
            </CardDescription>
          </div>
          {!r.unset && (
            <Badge variant={gradeVariant}>{t(`ratios.grade.${r.grade}` as MessageKey)}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {r.unset ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">{t("align.setValues")}</Link>
          </Button>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary"
                style={{ width: `${Math.min(100, r.alignmentPct)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {t("align.aligned")} · {money(r.align.aligned)}
              </span>
              <span>
                {t("align.off")} · {money(r.align.offValues)}
              </span>
            </div>

            {/* ---- The three ratios ---- */}
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t("ratios.alignment")}</dt>
                <dd className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-medium tabular-nums">{r.alignmentPct}%</span>
                  {r.trendPts != null && r.trendPts !== 0 && (
                    <span
                      className={`flex items-center gap-0.5 text-xs ${
                        r.trendPts > 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {r.trendPts > 0 ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {Math.abs(r.trendPts)}
                    </span>
                  )}
                </dd>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {t("ratios.alignment.hint")}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t("ratios.drift")}</dt>
                <dd className="mt-0.5 text-xl font-medium tabular-nums">{r.driftPct}%</dd>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {t("ratios.drift.hint", { amount: money(r.drift) })}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t("ratios.dream")}</dt>
                <dd className="mt-0.5 text-xl font-medium tabular-nums">{r.dreamFundingPct}%</dd>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {r.driftPerDreamEuro != null
                    ? t("ratios.dream.hint", { ratio: r.driftPerDreamEuro })
                    : t("ratios.dream.none")}
                </p>
              </div>
            </dl>

            {/* ---- The swap: what redirecting half the drift would buy ---- */}
            {r.redirect && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Target className="size-4 text-primary" /> {t("ratios.redirect.title")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("ratios.redirect.body", {
                    amount: money(r.redirect.redirect),
                    bucket: r.redirect.bucketName,
                    after: r.redirect.monthsAfter ?? 0,
                  })}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/allocations">
                    {t("ratios.redirect.cta")} <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            )}

            {r.align.byValue.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {r.align.byValue.map((v) => (
                  <li key={v.key} className="flex justify-between">
                    <span>{t(valueLabelKey(v.key) as MessageKey)}</span>
                    <span className="tabular-nums">{money(v.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            {r.align.leaks.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("align.leaks")}
                </p>
                <ul className="space-y-1 text-sm">
                  {r.align.leaks.map((l) => (
                    <li key={l.category} className="flex justify-between">
                      <span className="capitalize">{l.category}</span>
                      <span className="tabular-nums">{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
