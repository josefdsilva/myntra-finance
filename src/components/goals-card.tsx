import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Trophy, Target, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { bucketBalancesFor, fetchMovements, type AccountMovement } from "@/lib/movements";
import { recordAchievement, listAchievements } from "@/lib/achievements.functions";
import { useT } from "@/lib/i18n";

type Bucket = {
  id: string;
  name: string;
  color: string | null;
  kind: "savings" | "emergency" | "investment" | null;
  target_type: string;
  target_value: number | string;
  target_deadline: string | null;
  initial_balance: number | string;
};

const MAX_SHOWN = 5;

/**
 * Goals-first, celebratory view of the household's projects. Shows what you're
 * working toward with a progress bar, cheers the ones you've reached, and
 * highlights the goal you're closest to finishing — turning the dashboard from
 * a vigilance tool into something motivating.
 */
export function GoalsCard({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const recordFn = useServerFn(recordAchievement);
  const listFn = useServerFn(listAchievements);

  // Durable medals: a persisted record of goals already reached, so recognition
  // survives later target edits (raising a goal must not erase the trophy).
  const { data: achievements } = useQuery({
    queryKey: ["achievements", householdId],
    queryFn: () => listFn({ data: { household_id: householdId } }),
  });
  const achievedByBucket = useMemo(() => {
    const m: Record<string, { earned_at: string; detail: string | null }> = {};
    for (const a of achievements ?? []) {
      if (a.kind === "goal_reached" && a.ref_id)
        m[a.ref_id] = { earned_at: a.earned_at, detail: a.detail };
    }
    return m;
  }, [achievements]);
  const recordedRef = useRef<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["goals-card", householdId],
    queryFn: async () => {
      const [{ data: buckets }, { data: allocs }, movements] = await Promise.all([
        supabase
          .from("buckets")
          .select("id, name, color, kind, target_type, target_value, target_deadline, initial_balance")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId),
        fetchMovements(householdId),
      ]);
      const bs = (buckets ?? []) as Bucket[];
      const balances = bucketBalancesFor(
        bs.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
        (allocs ?? []) as Array<{ bucket_id: string; amount: number | string }>,
        movements as AccountMovement[],
      );
      return { buckets: bs, balances };
    },
  });

  const goals = useMemo(() => {
    if (!data) return [];
    return data.buckets.map((b) => {
      const balance = data.balances[b.id] ?? 0;
      const target = Number(b.target_value) || 0;
      // A goal has a "finish line" only when it targets a balance by a date, or
      // a fixed yearly amount. Percent-of-surplus / monthly targets are ongoing.
      const hasFinishLine =
        (b.target_type === "goal_by_date" || b.target_type === "fixed_yearly") && target > 0;
      const pct = hasFinishLine ? Math.min(100, Math.round((balance / target) * 100)) : null;
      const reached = hasFinishLine ? balance >= target - 0.01 : false;
      const remaining = hasFinishLine ? Math.max(0, target - balance) : 0;
      return { ...b, balance, target, hasFinishLine, pct, reached, remaining };
    });
  }, [data]);

  // Persist a durable medal the first time a finish-line goal is reached, and
  // celebrate exactly once. Idempotent server-side (dedupe_key), so re-detecting
  // the same reached goal on later renders never re-fires.
  useEffect(() => {
    for (const g of goals) {
      if (!g.hasFinishLine || !g.reached) continue;
      if (recordedRef.current.has(g.id) || achievedByBucket[g.id]) continue;
      recordedRef.current.add(g.id);
      recordFn({
        data: {
          household_id: householdId,
          kind: "goal_reached",
          dedupe_key: `goal_reached:${g.id}`,
          title: g.name,
          detail: money(g.target),
          ref_type: "bucket",
          ref_id: g.id,
          meta: { target: g.target, balance: g.balance },
        },
      })
        .then((r) => {
          if (r?.created) {
            toast.success(t("goals.reachedToast", { name: g.name }));
            qc.invalidateQueries({ queryKey: ["achievements", householdId] });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, achievedByBucket]);

  // Sort finish-line goals first (reached float to the top as trophies, then
  // most-complete), ongoing ones after.
  const sorted = useMemo(() => {
    return [...goals].sort((a, b) => {
      if (a.hasFinishLine !== b.hasFinishLine) return a.hasFinishLine ? -1 : 1;
      return (b.pct ?? -1) - (a.pct ?? -1);
    });
  }, [goals]);

  // The goal you're closest to finishing (but not there yet) — the motivator.
  const closest = useMemo(() => {
    const contenders = goals.filter((g) => g.hasFinishLine && !g.reached && g.remaining > 0);
    if (!contenders.length) return null;
    return contenders.reduce((best, g) => (g.remaining < best.remaining ? g : best));
  }, [goals]);

  if (!data) return null;

  if (!data.buckets.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" /> {t("goals.title")}
          </CardTitle>
          <CardDescription>{t("goals.empty")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/allocations">
              {t("goals.emptyCta")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shown = sorted.slice(0, MAX_SHOWN);
  const extra = sorted.length - shown.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-primary" /> {t("goals.title")}
        </CardTitle>
        <CardDescription>{t("goals.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {closest && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span>{t("goals.closest", { amount: money(closest.remaining), name: closest.name })}</span>
          </div>
        )}

        <ul className="space-y-3">
          {shown.map((g) => (
            <li key={g.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: g.color ?? "var(--primary)" }}
                  />
                  <span className="truncate font-medium">{g.name}</span>
                  {(g.reached || achievedByBucket[g.id]) && (
                    <Trophy className="size-3.5 shrink-0 text-emerald-600" />
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {g.hasFinishLine ? (
                    <>
                      <span className="font-medium text-foreground">{money(g.balance)}</span> /{" "}
                      {money(g.target)}
                    </>
                  ) : (
                    <span className="font-medium text-foreground">{money(g.balance)}</span>
                  )}
                </span>
              </div>

              {g.hasFinishLine && (
                <Progress
                  value={g.pct ?? 0}
                  className={g.reached ? "[&>div]:bg-emerald-500" : "[&>div]:bg-primary"}
                />
              )}

              <p
                className={`text-xs ${g.reached || achievedByBucket[g.id] ? "text-emerald-600" : "text-muted-foreground"}`}
              >
                {g.reached
                  ? t("goals.reached")
                  : achievedByBucket[g.id]
                    ? t("goals.reachedEarlier")
                    : g.hasFinishLine
                      ? t("goals.toGo", { amount: money(g.remaining), pct: g.pct ?? 0 })
                      : t("goals.growing")}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/allocations">
              {t("goals.manage")} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          {extra > 0 && (
            <span className="text-xs text-muted-foreground">{t("goals.more", { count: extra })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
