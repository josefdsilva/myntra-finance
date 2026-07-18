import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adoptCategoryEstimate } from "@/lib/budget.functions";
import { invalidateHouseholdData } from "@/lib/household-queries";
import { computeCycle } from "@/lib/cycle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Spending vs your estimate" for the current cycle, by category. Shows how each
 * everyday-spending estimate is tracking against what was actually recorded, and
 * lets the user adopt the real figure as the new estimate. Makes the abstract
 * chain (estimate -> everyday pool -> safe to spend) concrete and self-correcting.
 */
export function SpendingVsEstimate({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const adoptFn = useServerFn(adoptCategoryEstimate);

  const { data, refetch } = useQuery({
    enabled: !!householdId,
    queryKey: ["spending-vs-estimate", householdId],
    queryFn: async () => {
      const [{ data: salaries }, { data: estimates }] = await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId)
          .eq("kind", "income")
          .eq("is_salary", true)
          .order("occurred_at", { ascending: false })
          .limit(12),
        supabase
          .from("variable_estimates")
          .select("category, monthly_amount")
          .eq("household_id", householdId),
      ]);
      const cycle = computeCycle((salaries ?? []).map((r) => r.occurred_at as string));
      const { data: exps } = await supabase
        .from("expenses")
        .select("category, amount, kind")
        .eq("household_id", householdId)
        .gte("occurred_at", cycle.start.toISOString())
        .lt("occurred_at", cycle.end.toISOString());

      const estByCat: Record<string, number> = {};
      for (const e of estimates ?? []) {
        const c = e.category ?? "other";
        estByCat[c] = (estByCat[c] ?? 0) + Number(e.monthly_amount);
      }
      const actByCat: Record<string, number> = {};
      for (const e of exps ?? []) {
        if (e.kind === "income") continue;
        const c = e.category ?? "other";
        actByCat[c] = (actByCat[c] ?? 0) + Number(e.amount);
      }
      const cats = Array.from(new Set([...Object.keys(estByCat), ...Object.keys(actByCat)]));
      const rows = cats
        .map((c) => ({ category: c, estimate: round2(estByCat[c] ?? 0), actual: round2(actByCat[c] ?? 0) }))
        .filter((r) => r.estimate > 0 || r.actual > 0)
        .sort((a, b) => b.actual - a.actual);
      return { rows };
    },
  });

  async function adopt(category: string, actual: number) {
    try {
      await adoptFn({
        data: { household_id: householdId, category, label: cap(category), monthly_amount: actual },
      });
      refetch();
      invalidateHouseholdData(qc);
      qc.invalidateQueries({ queryKey: ["variable-estimates", householdId] });
      qc.invalidateQueries({ queryKey: ["variable-estimates-total", householdId] });
      toast.success(t("sve.adopted"));
    } catch {
      toast.error(t("sve.error"));
    }
  }

  const rows = data?.rows ?? [];
  if (rows.length === 0) return null;

  const totalEst = round2(rows.reduce((s, r) => s + r.estimate, 0));
  const totalAct = round2(rows.reduce((s, r) => s + r.actual, 0));
  const totalPct =
    totalEst > 0 ? Math.min(100, (totalAct / totalEst) * 100) : totalAct > 0 ? 100 : 0;
  const totalOver = totalEst > 0 && totalAct > totalEst;
  const totalDiff = round2(Math.abs(totalEst - totalAct));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sve.title")}</CardTitle>
        <CardDescription>{t("sve.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2 text-sm font-medium">
            <span>{t("sve.total")}</span>
            <span className="tabular-nums">
              <span className={totalOver ? "text-destructive" : ""}>{money(totalAct)}</span>
              <span className="text-muted-foreground font-normal"> / {money(totalEst)}</span>
            </span>
          </div>
          <Progress value={totalPct} className={totalOver ? "[&>div]:bg-destructive" : ""} />
          <p className="text-xs text-muted-foreground">
            {totalEst === 0
              ? t("sve.noEstimate")
              : totalDiff < 0.005
                ? t("sve.onTrack")
                : totalOver
                  ? t("sve.over", { amount: money(totalDiff) })
                  : t("sve.left", { amount: money(totalDiff) })}
          </p>
        </div>
        {rows.map((r) => {
          const pct =
            r.estimate > 0 ? Math.min(100, (r.actual / r.estimate) * 100) : r.actual > 0 ? 100 : 0;
          const over = r.estimate > 0 && r.actual > r.estimate;
          const diff = round2(Math.abs(r.estimate - r.actual));
          const canAdopt = r.actual > 0 && Math.abs(r.actual - r.estimate) >= 0.005;
          return (
            <div key={r.category} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize">{r.category}</span>
                <span className="tabular-nums">
                  <span className={over ? "font-medium text-destructive" : "font-medium"}>
                    {money(r.actual)}
                  </span>
                  <span className="text-muted-foreground"> / {money(r.estimate)}</span>
                </span>
              </div>
              <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {r.estimate === 0
                    ? t("sve.noEstimate")
                    : diff < 0.005
                      ? t("sve.onTrack")
                      : over
                        ? t("sve.over", { amount: money(diff) })
                        : t("sve.left", { amount: money(diff) })}
                </span>
                {canAdopt && (
                  <button
                    className="shrink-0 text-primary hover:underline"
                    onClick={() => adopt(r.category, r.actual)}
                  >
                    {t("sve.useActual", { amount: money(r.actual) })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
