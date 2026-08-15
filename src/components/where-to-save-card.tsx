import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { computeBenchmarkComparison, hasBenchmark } from "@/lib/benchmarks";
import { findSavings } from "@/lib/savings-finder";
import { cycleForSpace, perCycleFromMonthly } from "@/lib/cadence";
import { resolveIntent, defaultIntentForCategory } from "@/lib/intent";
import { fetchCycleBounds } from "@/lib/cycle-bounds";
import {
  fetchCommitments,
  commitmentsQueryKey,
  commitToCut,
  resolveCommitment,
} from "@/lib/savings-commitments";

// Only these intents are ever suggested for cutting — never essentials
// (housing, kids, groceries, health, utilities, transport) and never
// "important" (fuel, insurance). Suggesting a tight family cut their kids or
// their home is exactly the mistake this fixes.
const DISCRETIONARY = new Set(["nice_to_have", "treat"]);

/**
 * "Where to save" — the deep home of the tight-budget savings finder. It ranks
 * DISCRETIONARY spending (nice-to-have + treat), fixed and variable, largest
 * first — including subscriptions — and suggests trimming a third of each. It
 * never proposes cutting essentials, and only renders for a household that's
 * genuinely tight (via `findSavings.surface`), never for business spaces.
 */
export function WhereToSaveCard({
  householdId,
  monthlyIncome,
  monthlySpend,
  spendByCategory,
  surplus,
}: {
  householdId: string;
  monthlyIncome: number;
  monthlySpend: number;
  spendByCategory: Record<string, number>;
  surplus: number;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { data: hh } = useQuery({
    queryKey: ["where-to-save-hh", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("households")
        .select(
          "country, adults, children, kind, age_band, margin_pct, cycle, cycle_mode, cycle_anchor_date, baseline_budget",
        )
        .eq("id", householdId)
        .maybeSingle();
      return data;
    },
  });
  const { data: fixedRows } = useQuery({
    queryKey: ["where-to-save-fixed", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fixed_expenses")
        .select("category, intent, monthly_amount")
        .eq("household_id", householdId);
      return data ?? [];
    },
  });

  // Commitments the household has made ("I'll cut €40 of eating out"), plus the
  // real spend so far in the CURRENT cycle per category — that pair is what turns
  // a suggestion into a verified promise instead of advice that vanishes.
  const { data: commitments = [] } = useQuery({
    queryKey: commitmentsQueryKey(householdId),
    queryFn: () => fetchCommitments(householdId),
  });
  const { data: cycleSpend } = useQuery({
    enabled: !!hh,
    queryKey: [
      "where-to-save-cycle-spend",
      householdId,
      hh?.cycle,
      hh?.cycle_mode,
      hh?.cycle_anchor_date,
    ],
    queryFn: async () => {
      const bounds = await fetchCycleBounds(supabase, householdId, hh);
      const { data } = await supabase
        .from("expenses")
        .select("amount, category")
        .eq("household_id", householdId)
        .eq("kind", "expense")
        .gte("occurred_at", bounds.start.toISOString())
        .lt("occurred_at", bounds.end.toISOString());
      const byCategory: Record<string, number> = {};
      for (const r of (data ?? []) as Array<{ amount: number | string; category: string }>) {
        byCategory[r.category] = (byCategory[r.category] ?? 0) + (Number(r.amount) || 0);
      }
      return { start: bounds.start, byCategory };
    },
  });

  const commit = useMutation({
    mutationFn: (v: { category: string; monthlyTarget: number; baselineMonthly: number }) =>
      commitToCut({
        householdId,
        category: v.category,
        monthlyTarget: v.monthlyTarget,
        baselineMonthly: v.baselineMonthly,
        cycleStart: cycleSpend?.start ?? new Date(),
      }),
    onSuccess: () => {
      toast.success(t("ana.save.commitDone"));
      void qc.invalidateQueries({ queryKey: commitmentsQueryKey(householdId) });
    },
    onError: () => toast.error(t("ana.save.commitFailed")),
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; status: "kept" | "dropped" }) =>
      resolveCommitment(v.id, v.status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: commitmentsQueryKey(householdId) }),
    onError: () => toast.error(t("ana.save.commitFailed")),
  });

  const country = hh?.country ?? null;
  const isBusiness = hh?.kind === "business";
  const adults = Number(hh?.adults ?? 2);
  const children = Number(hh?.children ?? 0);
  const ageBand = (hh?.age_band as string | null) ?? null;
  const marginPct = Number(hh?.margin_pct ?? 10);

  // Peer comparison is optional context (shown per row when available). It also
  // supplies the income quintile for the income-side nudge.
  const comp = useMemo(
    () =>
      country && hasBenchmark(country) && !isBusiness
        ? computeBenchmarkComparison({
            country,
            adults,
            children,
            monthlyIncome,
            monthlySpend,
            spendByCategory,
          })
        : null,
    [country, isBusiness, adults, children, monthlyIncome, monthlySpend, spendByCategory],
  );

  if (isBusiness) return null;

  // Discretionary spend per category — fixed (by its intent) + variable (by the
  // category's default intent). Essentials/important are excluded.
  const catSpend: Record<string, number> = {};
  for (const r of fixedRows ?? []) {
    const level = resolveIntent({ intent: r.intent, category: r.category });
    if (DISCRETIONARY.has(level) && r.category) {
      catSpend[r.category] = (catSpend[r.category] ?? 0) + (Number(r.monthly_amount) || 0);
    }
  }
  for (const [cat, amt] of Object.entries(spendByCategory)) {
    if (DISCRETIONARY.has(defaultIntentForCategory(cat))) {
      catSpend[cat] = (catSpend[cat] ?? 0) + amt;
    }
  }
  const categoryCuts = Object.entries(catSpend).map(([category, monthly]) => ({ category, monthly }));

  // Underwater = baseline exceeds income. Passing the overspend lets this card
  // render (and read as break-even) for the households that most need it.
  const baseline = Number(hh?.baseline_budget ?? 0);
  const deficit = Math.max(0, baseline - monthlyIncome);

  const savings = findSavings({
    income: monthlyIncome,
    surplus,
    marginPct,
    ageBand,
    incomeQuintile: comp?.incomeQuintile ?? null,
    categoryCuts,
    deficit,
  });

  const committedCats = new Set(commitments.map((c) => c.category));
  const suggestions = savings.surface
    ? savings.spending.filter((s) => s.kind !== "category" || !committedCats.has(s.category))
    : [];

  // Keep the card alive while a promise is being tracked, even once the household
  // is no longer "tight" — that improvement IS the proof they wanted to see.
  if (suggestions.length === 0 && commitments.length === 0) return null;

  const byCat = new Map((comp?.categories ?? []).map((c) => [c.category, c]));
  const cycle = cycleForSpace(hh);
  const per = t(`period.per.${cycle}` as MessageKey);
  const cyc = (m: number) => money(perCycleFromMonthly(m, cycle));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4 text-primary" /> {t("ana.save.title")}
        </CardTitle>
        <CardDescription>
          {savings.mode === "breakeven"
            ? t("ana.save.introDeficit", { deficit: cyc(savings.deficitEur) })
            : t("ana.save.intro", { gap: cyc(savings.gapEur) })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {commitments.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("ana.save.trackTitle")}
            </p>
            <ul className="space-y-2">
              {commitments.map((c) => {
                const target = Number(c.monthly_target) || 0;
                const baselineMonthly = Number(c.baseline_monthly) || 0;
                // The promise, in cycle money: spend no more than what they were
                // spending minus the trim they chose.
                const allowance = perCycleFromMonthly(
                  Math.max(0, baselineMonthly - target),
                  cycle,
                );
                const spent = cycleSpend?.byCategory[c.category] ?? 0;
                const onTrack = spent <= allowance;
                const pct = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 100;
                return (
                  <li key={c.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium capitalize">
                        {onTrack ? (
                          <CheckCircle2 className="size-4 text-primary" />
                        ) : (
                          <AlertTriangle className="size-4 text-destructive" />
                        )}
                        {c.category}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {t("ana.save.trackSpend", {
                          spent: money(spent),
                          allowance: money(allowance),
                          per,
                        })}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={onTrack ? "h-full bg-primary" : "h-full bg-destructive"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {onTrack
                          ? t("ana.save.trackOnTrack", { amount: money(allowance - spent) })
                          : t("ana.save.trackOver", { amount: money(spent - allowance) })}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ id: c.id, status: "kept" })}
                        >
                          {t("ana.save.trackKept")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ id: c.id, status: "dropped" })}
                        >
                          {t("ana.save.trackDrop")}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <ul className="space-y-2">
          {suggestions.map((s) => {
            if (s.kind !== "category") return null;
            const c = byCat.get(s.category);
            const overPeer = c && c.userMonthly > c.benchmarkMonthly;
            return (
              <li
                key={s.category}
                className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{s.category}</span>
                  <span className="shrink-0 tabular-nums font-medium text-amber-700 dark:text-amber-300">
                    {t("ana.save.trim", { amount: cyc(s.monthlyEur), per })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {overPeer
                    ? t("ana.save.detail", {
                        user: cyc(c!.userMonthly),
                        per,
                        benchmark: cyc(c!.benchmarkMonthly),
                      })
                    : t("ana.save.detailPlain", { amount: cyc(catSpend[s.category] ?? 0), per })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                  disabled={commit.isPending || !cycleSpend}
                  onClick={() =>
                    commit.mutate({
                      category: s.category,
                      monthlyTarget: s.monthlyEur,
                      baselineMonthly: catSpend[s.category] ?? s.monthlyEur * 3,
                    })
                  }
                >
                  {t("ana.save.commit")}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("ana.save.footer")}</p>
      </CardContent>
    </Card>
  );
}
