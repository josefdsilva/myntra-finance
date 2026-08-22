import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { upsertBucket } from "@/lib/budget.functions";
import { parseValues, suggestProjects, valueLabelKey } from "@/lib/values";

/**
 * Values-aligned project suggestions. Suggest, never create: each card is one
 * tap, and the amounts are derived from the household's real monthly surplus so
 * the goal is reachable rather than aspirational.
 */
export function ProjectSuggestions({
  householdId,
  monthlySurplus = 0,
}: {
  householdId: string;
  monthlySurplus?: number;
}) {
  const t = useT();
  const qc = useQueryClient();
  const addBucket = useServerFn(upsertBucket);
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["project-suggestions", householdId],
    queryFn: async () => {
      const [{ data: hh }, { data: buckets }] = await Promise.all([
        supabase.from("households").select("life_values").eq("id", householdId).maybeSingle(),
        supabase.from("buckets").select("name").eq("household_id", householdId),
      ]);
      return {
        values: parseValues(hh?.life_values),
        names: (buckets ?? []).map((b) => b.name),
      };
    },
  });

  const suggestions = useMemo(
    () =>
      data
        ? suggestProjects(data.values, {
            monthlySurplus,
            existingNames: data.names,
          })
        : [],
    [data, monthlySurplus],
  );

  if (!data || data.values.length === 0 || suggestions.length === 0) return null;

  async function add(i: number) {
    const s = suggestions[i];
    setBusy(s.nameKey);
    try {
      await addBucket({
        data: {
          household_id: householdId,
          name: t(s.nameKey as MessageKey),
          target_type: s.target_type,
          target_value: s.target_value,
          target_deadline: s.target_deadline ?? null,
          kind: s.kind,
        },
      });
      toast.success(t("suggest.added"));
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> {t("suggest.title")}
        </CardTitle>
        <CardDescription>{t("suggest.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={s.nameKey}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t(s.nameKey as MessageKey)}</p>
              <p className="text-xs text-muted-foreground">
                {s.target_type === "goal_by_date"
                  ? money(s.target_value)
                  : `${s.target_value}%`}{" "}
                ·{" "}
                {t("align.because", {
                  value: t(valueLabelKey(s.value as never) as MessageKey),
                })}
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={busy === s.nameKey} onClick={() => add(i)}>
              <Plus className="size-4" /> {t("suggest.add")}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
