import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { fetchCycleBounds } from "@/lib/cycle-bounds";
import { alignmentSummary, parseValues, valueLabelKey } from "@/lib/values";

/**
 * "Money on what matters" — of the flexible spending in this cycle, how much
 * served the household's own values. Essentials are excluded on purpose: rent
 * and groceries are not a choice, so counting them would flatter everyone.
 *
 * Deliberately supportive: it never says "waste", it shows where the flexible
 * money went so a swap becomes obvious.
 */
export function AlignmentCard({ householdId }: { householdId: string }) {
  const t = useT();

  const { data } = useQuery({
    queryKey: ["alignment", householdId],
    queryFn: async () => {
      const [{ data: hh }, bounds] = await Promise.all([
        supabase.from("households").select("life_values").eq("id", householdId).maybeSingle(),
        fetchCycleBounds(supabase, householdId),
      ]);
      const { data: rows } = await supabase
        .from("expenses")
        .select("amount, category, intent, kind")
        .eq("household_id", householdId)
        .gte("occurred_at", bounds.start.toISOString())
        .lt("occurred_at", bounds.end.toISOString());
      return { values: parseValues(hh?.life_values), rows: rows ?? [] };
    },
  });

  const summary = useMemo(
    () => alignmentSummary(data?.rows ?? [], data?.values ?? []),
    [data],
  );

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="size-4 text-primary" /> {t("align.title")}
        </CardTitle>
        <CardDescription>
          {summary.unset ? t("align.unset") : t("align.body", { pct: summary.alignedPct })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary.unset ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">{t("align.setValues")}</Link>
          </Button>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary"
                style={{ width: `${Math.min(100, summary.alignedPct)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {t("align.aligned")} · {money(summary.aligned)}
              </span>
              <span>
                {t("align.off")} · {money(summary.offValues)}
              </span>
            </div>

            {summary.byValue.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {summary.byValue.map((v) => (
                  <li key={v.key} className="flex justify-between">
                    <span>{t(valueLabelKey(v.key) as MessageKey)}</span>
                    <span className="tabular-nums">{money(v.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            {summary.leaks.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("align.leaks")}
                </p>
                <ul className="space-y-1 text-sm">
                  {summary.leaks.map((l) => (
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
