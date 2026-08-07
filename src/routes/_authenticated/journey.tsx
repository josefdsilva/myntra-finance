import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Trophy,
  Flag,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Lock,
  Check,
  Target,
  Award,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { pageShellClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { bucketBalancesFor, fetchMovements, type AccountMovement } from "@/lib/movements";
import { listAchievements } from "@/lib/achievements.functions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/journey")({
  head: () =>
    pageMeta({
      path: "/journey",
      title: "Journey · bynku",
      description: "Your money journey — a roadmap of milestones from safety net to investing.",
      noindex: true,
    }),
  component: JourneyPage,
});

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

type StageKey = "starter" | "debt" | "net3" | "net6" | "invest";
type StageStatus = "done" | "active" | "locked";

const STAGE_ICON: Record<StageKey, LucideIcon> = {
  starter: Flag,
  debt: CreditCard,
  net3: ShieldCheck,
  net6: ShieldCheck,
  invest: TrendingUp,
};

function JourneyPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const listAchFn = useServerFn(listAchievements);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["journey-data", householdId],
    queryFn: async () => {
      const [{ data: buckets }, { data: allocs }, movements, { data: incomes }, { data: debts }, { data: fixed }] =
        await Promise.all([
          supabase
            .from("buckets")
            .select("id, name, color, kind, target_type, target_value, target_deadline, initial_balance")
            .eq("household_id", householdId!)
            .order("sort_order"),
          supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId!),
          fetchMovements(householdId!),
          supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
          supabase.from("debts").select("monthly_amount").eq("household_id", householdId!),
          supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        ]);
      const bs = (buckets ?? []) as Bucket[];
      const balances = bucketBalancesFor(
        bs.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
        (allocs ?? []) as Array<{ bucket_id: string; amount: number | string }>,
        movements as AccountMovement[],
      );
      const income = (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const debtMonthly = (debts ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const fixedMonthly = (fixed ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return { buckets: bs, balances, income, debtMonthly, essentials: fixedMonthly + debtMonthly };
    },
  });

  const { data: achievements } = useQuery({
    enabled: !!householdId,
    queryKey: ["achievements", householdId],
    queryFn: () => listAchFn({ data: { household_id: householdId! } }),
  });

  const derived = useMemo(() => {
    if (!data) return null;
    const essentials = Math.max(1, data.essentials);
    let emergencyBal = 0;
    let savingsBal = 0;
    let investBal = 0;
    for (const b of data.buckets) {
      const bal = data.balances[b.id] ?? 0;
      if (b.kind === "investment") investBal += bal;
      else if (b.kind === "emergency") emergencyBal += bal;
      else savingsBal += bal;
    }
    const hasEmergency = data.buckets.some((b) => b.kind === "emergency");
    const liquidReserve = hasEmergency ? emergencyBal : emergencyBal + savingsBal;
    const emergencyMonths = liquidReserve / essentials;
    const dtiPct = data.income > 0 ? (data.debtMonthly / data.income) * 100 : 0;
    const invested = investBal;

    const specs: Array<{ key: StageKey; met: boolean; progress: number; value: string | null }> = [
      { key: "starter", met: emergencyMonths >= 1, progress: emergencyMonths / 1, value: t("journey.months", { n: emergencyMonths.toFixed(1) }) },
      {
        key: "debt",
        met: data.debtMonthly === 0 || dtiPct <= 15,
        progress: data.debtMonthly === 0 ? 1 : Math.min(1, 15 / Math.max(dtiPct, 0.01)),
        value: data.debtMonthly === 0 ? null : `${Math.round(dtiPct)}%`,
      },
      { key: "net3", met: emergencyMonths >= 3, progress: emergencyMonths / 3, value: t("journey.months", { n: emergencyMonths.toFixed(1) }) },
      { key: "net6", met: emergencyMonths >= 6, progress: emergencyMonths / 6, value: t("journey.months", { n: emergencyMonths.toFixed(1) }) },
      { key: "invest", met: invested > 0, progress: invested > 0 ? 1 : 0, value: money(invested) },
    ];
    const activeIndex = specs.findIndex((s) => !s.met);
    const stages = specs.map((s, i) => ({
      ...s,
      progress: Math.max(0, Math.min(1, s.progress)),
      status: (activeIndex === -1 || i < activeIndex ? "done" : i === activeIndex ? "active" : "locked") as StageStatus,
    }));
    const doneCount = stages.filter((s) => s.status === "done").length;
    const activeKey: StageKey = activeIndex === -1 ? "invest" : specs[activeIndex].key;

    const sideQuests = data.buckets
      .filter((b) => b.target_type === "goal_by_date" && Number(b.target_value) > 0)
      .map((b) => {
        const bal = data.balances[b.id] ?? 0;
        const target = Number(b.target_value);
        return {
          id: b.id,
          name: b.name,
          color: b.color,
          balance: bal,
          target,
          pct: Math.min(100, Math.round((bal / target) * 100)),
          reached: bal >= target - 0.01,
        };
      });

    return { stages, doneCount, activeKey, sideQuests };
  }, [data, t]);

  const medals = achievements ?? [];

  return (
    <div className={pageShellClass("3xl")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("journey.subtitle")}</p>
          <h1 className="font-display text-3xl md:text-4xl">{t("journey.heading")}</h1>
        </div>
        {derived && (
          <div className="text-right">
            <p className="text-lg font-medium">
              {t("journey.level", { n: derived.doneCount })} ·{" "}
              <span className="text-primary">{t(`journey.role.${derived.activeKey}`)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t("journey.progress", { done: derived.doneCount, total: 5 })}
            </p>
          </div>
        )}
      </header>

      {!derived ? (
        <p className="text-sm text-muted-foreground">{t("journey.loading")}</p>
      ) : (
        <>
          <div className="flex flex-col">
            {derived.stages.map((s, i) => {
              const Icon = STAGE_ICON[s.key];
              const last = i === derived.stages.length - 1;
              const lineDone = s.status === "done";
              return (
                <div key={s.key} className="grid grid-cols-[40px_1fr] gap-3">
                  <div className="relative">
                    {!last && (
                      <span
                        className={cn(
                          "absolute left-[18px] top-0 -bottom-1 w-0.5",
                          lineDone ? "bg-emerald-500/70" : "bg-border",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex size-[34px] items-center justify-center rounded-full",
                        s.status === "done" && "bg-emerald-500 text-white",
                        s.status === "active" && "border-2 border-primary bg-card text-primary",
                        s.status === "locked" && "border bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {s.status === "done" ? (
                        <Check className="size-4" />
                      ) : s.status === "locked" ? (
                        <Lock className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </span>
                  </div>

                  <div className="pb-3.5">
                    {s.status === "active" ? (
                      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-primary">{t(`journey.stage.${s.key}.title`)}</span>
                          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t("journey.here")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-primary/90">
                          {t(`journey.stage.${s.key}.obj`)}
                          {s.value ? ` · ${s.value}` : ""}
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
                          <div className="h-full bg-primary" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium",
                              s.status === "done" ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {t(`journey.stage.${s.key}.title`)}
                          </span>
                          {s.status === "done" && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.status === "done" ? t("journey.doneLabel") : t(`journey.stage.${s.key}.obj`)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {derived.sideQuests.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("journey.sideQuests")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {derived.sideQuests.map((q) => (
                  <div key={q.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{q.name}</span>
                        {q.reached && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{q.pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full", q.reached ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${q.pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {money(q.balance)} / {money(q.target)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2 border-t pt-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("journey.medals")}
            </h2>
            {medals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("journey.noMedals")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {medals.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300"
                  >
                    <Award className="size-3.5" /> {m.title}
                  </span>
                ))}
              </div>
            )}
          </section>

          <div>
            <Button asChild variant="outline" size="sm">
              <Link to="/allocations">
                {t("journey.manageProjects")} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
