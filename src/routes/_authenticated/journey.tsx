import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Trophy,
  Flag,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Check,
  Target,
  Award,
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { pageShellClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { bucketBalancesFor, fetchMovements, type AccountMovement } from "@/lib/movements";
import { listAchievements, recordAchievement } from "@/lib/achievements.functions";
import {
  listStages,
  ensureJourneySeed,
  createStage,
  updateStage,
  deleteStage,
  setStageOrder,
  draftJourney,
  type JourneyStage,
} from "@/lib/journey.functions";
import { JourneyCoach } from "@/components/journey-coach";
import { cn } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";

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

const TEMPLATE_ICON: Record<string, LucideIcon> = {
  starter: Flag,
  debt: CreditCard,
  net3: ShieldCheck,
  net6: ShieldCheck,
  invest: TrendingUp,
  investDeep: TrendingUp,
  invest12: TrendingUp,
  fi: Award,
};

type Status = "done" | "active" | "locked";

function JourneyPage() {
  const t = useT();
  const qc = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);

  const listStagesFn = useServerFn(listStages);
  const seedFn = useServerFn(ensureJourneySeed);
  const createFn = useServerFn(createStage);
  const updateFn = useServerFn(updateStage);
  const deleteFn = useServerFn(deleteStage);
  const reorderFn = useServerFn(setStageOrder);
  const draftFn = useServerFn(draftJourney);
  const listAchFn = useServerFn(listAchievements);
  const recordFn = useServerFn(recordAchievement);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const stagesQ = useQuery({
    enabled: !!householdId,
    queryKey: ["journey-stages", householdId],
    queryFn: () => listStagesFn({ data: { household_id: householdId! } }),
  });

  // Seed the default spine the first time, then reload.
  const seededRef = useRef(false);
  const recordedStagesRef = useRef<Set<string>>(new Set());
  const recordedLevelsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!householdId || seededRef.current) return;
    if (stagesQ.data && stagesQ.data.length === 0) {
      seededRef.current = true;
      seedFn({ data: { household_id: householdId } })
        .then(() => qc.invalidateQueries({ queryKey: ["journey-stages", householdId] }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, stagesQ.data]);

  const { data: metricsData } = useQuery({
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

  const metrics = useMemo(() => {
    if (!metricsData) return null;
    // Essentials denominator = baseline monthly outgoings, matching the coach /
    // health-score "months of essential costs" (not just fixed + debt).
    const essentials = Math.max(1, baseline || metricsData.essentials);
    let emergencyBal = 0;
    let savingsBal = 0;
    let investBal = 0;
    for (const b of metricsData.buckets) {
      const bal = metricsData.balances[b.id] ?? 0;
      if (b.kind === "investment") investBal += bal;
      else if (b.kind === "emergency") emergencyBal += bal;
      else savingsBal += bal;
    }
    const hasEmergency = metricsData.buckets.some((b) => b.kind === "emergency");
    const liquidReserve = hasEmergency ? emergencyBal : emergencyBal + savingsBal;
    return {
      emergency_months: liquidReserve / essentials,
      dti_pct: metricsData.income > 0 ? (metricsData.debtMonthly / metricsData.income) * 100 : 0,
      invested_amount: investBal,
      // Invested measured in months of essential costs, so "long-term investing"
      // is a meaningful, personalized target rather than "any amount > 0".
      invested_months: investBal / essentials,
      // Years of essential costs covered by investments — anchors the financial
      // independence rung (~25× yearly costs).
      invested_years: investBal / (12 * essentials),
    } as Record<string, number>;
  }, [metricsData, baseline]);

  // Evaluate each persisted stage against the live metrics.
  const evaluated = useMemo(() => {
    const stages = stagesQ.data ?? [];
    // Require real metrics before evaluating — otherwise placeholder zeros make
    // "under 15%" trivially true and briefly mark the debt stage complete, which
    // the achievement recorder would lock in as a bogus medal.
    if (!stages.length || !metrics) return null;
    const m = metrics;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const fmt = (key: string, cur: number) =>
      key === "dti_pct"
        ? `${Math.round(cur)}%`
        : key === "invested_amount" || key === "net_worth"
          ? money(cur)
          : key === "invested_years"
            ? t("journey.years", { n: cur.toFixed(1) })
            : t("journey.months", { n: cur.toFixed(1) });

    const evalOne = (s: JourneyStage): { complete: boolean; progress: number; value: string | null } => {
      if (s.objective_type === "custom") {
        return { complete: s.status === "done", progress: s.status === "done" ? 1 : 0, value: null };
      }
      if (s.objective_type === "project") {
        const id = String((s.objective_config as { bucket_id?: string }).bucket_id ?? "");
        const b = metricsData?.buckets.find((x) => x.id === id);
        const bal = metricsData?.balances[id] ?? 0;
        const target = Number(b?.target_value ?? 0);
        if (!b || target <= 0) return { complete: false, progress: 0, value: null };
        return {
          complete: bal >= target - 0.01,
          progress: clamp01(bal / target),
          value: `${money(bal)} / ${money(target)}`,
        };
      }
      const cfg = s.objective_config as { key?: string; op?: string; value?: number };
      const key = String(cfg.key ?? "");
      const op = cfg.op === "<=" ? "<=" : ">=";
      const target = Number(cfg.value ?? 0);
      const cur = m[key] ?? 0;
      const complete = op === "<=" ? cur <= target : cur >= target;
      const progress = op === "<=" ? (complete ? 1 : clamp01(target / Math.max(cur, 0.0001))) : clamp01(cur / Math.max(target, 0.0001));
      return { complete, progress, value: fmt(key, cur) };
    };

    const withEval = stages.map((s) => {
      const e = evalOne(s);
      const displayTitle =
        s.title ?? (s.template_key ? t(`journey.stage.${s.template_key}.title` as MessageKey) : "");
      const displayObjective =
        s.objective ?? (s.template_key ? t(`journey.stage.${s.template_key}.obj` as MessageKey) : "");
      return { ...s, ...e, displayTitle, displayObjective };
    });

    const spine = withEval.filter((s) => !s.optional);
    const side = withEval.filter((s) => s.optional);
    // A stage is "done" whenever its own objective is met — even if an earlier
    // spine stage isn't — so achieved milestones always show as achieved. The
    // single "active" stage is the first still-incomplete one; the rest are
    // upcoming (advisory order, not hard-locked).
    const firstIncomplete = spine.findIndex((s) => !s.complete);
    const spineNodes = spine.map((s, i) => ({
      ...s,
      status: (s.complete ? "done" : i === firstIncomplete ? "active" : "locked") as Status,
    }));
    const doneCount = spineNodes.filter((s) => s.status === "done").length;
    const activeStage = spineNodes.find((s) => s.status === "active") ?? null;
    const roleKey = activeStage?.template_key ?? "custom";

    // Projects already promoted to a stage (project-type) shouldn't also show as
    // an "alongside" chip.
    const linkedBucketIds = new Set(
      stages
        .filter((s) => s.objective_type === "project")
        .map((s) => String((s.objective_config as { bucket_id?: string }).bucket_id ?? ""))
        .filter(Boolean),
    );

    // Auto side-quests from goal projects not promoted to their own stage.
    const autoQuests = (metricsData?.buckets ?? [])
      .filter((b) => b.target_type === "goal_by_date" && Number(b.target_value) > 0 && !linkedBucketIds.has(b.id))
      .map((b) => {
        const bal = metricsData?.balances[b.id] ?? 0;
        const target = Number(b.target_value);
        return { id: b.id, name: b.name, balance: bal, target, pct: Math.min(100, Math.round((bal / target) * 100)), reached: bal >= target - 0.01 };
      });

    // Every other project (ongoing contributions, no finish line) shown so
    // nothing is invisible — investing, kids savings, etc.
    const otherProjects = (metricsData?.buckets ?? [])
      .filter(
        (b) =>
          b.target_type !== "goal_by_date" &&
          (metricsData?.balances[b.id] ?? 0) > 0 &&
          !linkedBucketIds.has(b.id),
      )
      .map((b) => ({ id: b.id, name: b.name, balance: metricsData?.balances[b.id] ?? 0 }));

    return { all: withEval, spineNodes, side, doneCount, roleKey, autoQuests, otherProjects };
  }, [stagesQ.data, metrics, metricsData, t]);

  const medals = achievements ?? [];
  const [celebrate, setCelebrate] = useState<{ level: number; roleKey: string } | null>(null);

  // Persist a durable medal the first time a spine stage is complete, and
  // celebrate once. Idempotent server-side; deduped by template so re-personalizing
  // doesn't mint a second medal for the same milestone.
  useEffect(() => {
    if (!householdId || !evaluated) return;
    for (const s of evaluated.spineNodes) {
      if (s.status !== "done") continue;
      const key = s.template_key ?? s.id;
      if (recordedStagesRef.current.has(key)) continue;
      recordedStagesRef.current.add(key);
      recordFn({
        data: {
          household_id: householdId,
          kind: "stage_complete",
          dedupe_key: `stage_complete:${key}`,
          title: s.displayTitle,
          ref_type: "stage",
          ref_id: s.id,
        },
      })
        .then((r) => {
          if (r?.created) {
            toast.success(t("journey.stageDoneToast", { name: s.displayTitle }));
            qc.invalidateQueries({ queryKey: ["achievements", householdId] });
          }
        })
        .catch(() => {});
    }
    // Level up = number of completed spine stages. Record a durable medal and
    // celebrate once when a new level is reached.
    const level = evaluated.doneCount;
    if (level > 0 && !recordedLevelsRef.current.has(level)) {
      recordedLevelsRef.current.add(level);
      const roleKey = evaluated.roleKey;
      recordFn({
        data: {
          household_id: householdId,
          kind: "level_up",
          dedupe_key: `level_up:${level}`,
          title: t("journey.level", { n: level }),
        },
      })
        .then((r) => {
          if (r?.created) {
            setCelebrate({ level, roleKey });
            qc.invalidateQueries({ queryKey: ["achievements", householdId] });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluated, householdId]);
  const [editing, setEditing] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; stage?: JourneyStage } | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["journey-stages", householdId] });
  }
  async function personalize() {
    if (!householdId) return;
    if (!window.confirm(t("journey.personalizeConfirm"))) return;
    await draftFn({ data: { household_id: householdId } });
    toast.success(t("journey.personalizedToast"));
    refresh();
  }
  async function move(index: number, dir: -1 | 1) {
    if (!householdId || !evaluated) return;
    const arr = [...evaluated.all];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    await reorderFn({ data: { household_id: householdId, ids: arr.map((s) => s.id) } });
    refresh();
  }
  async function toggleDone(s: JourneyStage) {
    await updateFn({ data: { id: s.id, status: s.status === "done" ? "active" : "done" } });
    refresh();
  }
  async function remove(s: JourneyStage) {
    if (!window.confirm(t("journey.deleteConfirm"))) return;
    await deleteFn({ data: { id: s.id } });
    refresh();
  }

  const loading = !stagesQ.data || !evaluated;

  return (
    <div className={pageShellClass("3xl")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("journey.subtitle")}</p>
          <h1 className="font-display text-3xl md:text-4xl">{t("journey.heading")}</h1>
        </div>
        <div className="flex items-center gap-3">
          {evaluated && (
            <div className="text-right">
              <p className="text-lg font-medium">
                {t("journey.level", { n: evaluated.doneCount })} ·{" "}
                <span className="text-primary">{t(`journey.role.${evaluated.roleKey}` as MessageKey)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("journey.progress", { done: evaluated.doneCount, total: evaluated.spineNodes.length })}
              </p>
            </div>
          )}
          <Button variant={coachOpen ? "default" : "outline"} size="sm" onClick={() => setCoachOpen((o) => !o)}>
            <Sparkles className="size-4" /> {t("journey.coachButton")}
          </Button>
          <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => setEditing((e) => !e)}>
            <Pencil className="size-4" /> {editing ? t("journey.doneLabel") : t("journey.edit")}
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("journey.loading")}</p>
      ) : editing ? (
        /* ---- Edit mode: flat, reorderable list ---- */
        <section className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("journey.editHint")}</p>
          <ul className="divide-y rounded-lg border">
            {evaluated.all.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={t("journey.moveUp")}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("journey.moveDown")}
                    disabled={i === evaluated.all.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.displayTitle}</span>
                    {s.optional && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t("journey.sideQuestBadge")}
                      </span>
                    )}
                    {s.complete && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                  </div>
                  {s.displayObjective && (
                    <p className="truncate text-xs text-muted-foreground">{s.displayObjective}</p>
                  )}
                </div>
                {s.objective_type === "custom" && (
                  <Button variant="ghost" size="sm" onClick={() => toggleDone(s)}>
                    <Check className={cn("size-4", s.status === "done" && "text-emerald-600")} />
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label={t("journey.editStage")} onClick={() => setDialog({ mode: "edit", stage: s })}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t("journey.deleteStage")} onClick={() => remove(s)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" /> {t("journey.addStage")}
          </Button>
        </section>
      ) : (
        /* ---- Read mode: the map ---- */
        <>
          <div className="flex flex-col">
            {evaluated.spineNodes.map((s, i) => {
              const Icon = s.template_key ? TEMPLATE_ICON[s.template_key] ?? Target : Target;
              const last = i === evaluated.spineNodes.length - 1;
              return (
                <div key={s.id} className="grid grid-cols-[40px_1fr] gap-3">
                  <div className="relative">
                    {!last && (
                      <span
                        className={cn(
                          "absolute left-[18px] top-0 -bottom-1 w-0.5",
                          s.status === "done" ? "bg-emerald-500/70" : "bg-border",
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
                      {s.status === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                  </div>

                  <div className="pb-3.5">
                    {s.status === "active" ? (
                      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-primary">{s.displayTitle}</span>
                          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t("journey.here")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-primary/90">
                          {s.displayObjective}
                          {s.value ? ` · ${s.value}` : ""}
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
                          <div className="h-full bg-primary" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-medium", s.status === "done" ? "text-foreground" : "text-muted-foreground")}>
                            {s.displayTitle}
                          </span>
                          {s.status === "done" ? (
                            <Trophy className="size-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {Math.round(s.progress * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.status === "done" ? t("journey.doneLabel") : s.displayObjective}
                        </p>
                        {s.status === "locked" && (
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary/50" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {coachOpen && householdId && (
            <JourneyCoach householdId={householdId} onChanged={refresh} onPersonalize={personalize} />
          )}

          {(evaluated.side.length > 0 ||
            evaluated.autoQuests.length > 0 ||
            evaluated.otherProjects.length > 0) && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("journey.sideQuests")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {evaluated.side.map((s) => (
                  <div key={s.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{s.displayTitle}</span>
                        {s.complete && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                      </span>
                      {s.objective_type !== "custom" && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {Math.round(s.progress * 100)}%
                        </span>
                      )}
                    </div>
                    {s.objective_type !== "custom" && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full", s.complete ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${Math.round(s.progress * 100)}%` }}
                        />
                      </div>
                    )}
                    {s.value ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{s.value}</p>
                    ) : s.displayObjective ? (
                      <p className="mt-1 text-xs text-muted-foreground">{s.displayObjective}</p>
                    ) : null}
                  </div>
                ))}
                {evaluated.autoQuests.map((q) => (
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
                      <div className={cn("h-full", q.reached ? "bg-emerald-500" : "bg-primary")} style={{ width: `${q.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {money(q.balance)} / {money(q.target)}
                    </p>
                  </div>
                ))}
                {evaluated.otherProjects.map((p) => (
                  <div key={p.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{money(p.balance)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t("journey.ongoing")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2 border-t pt-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("journey.medals")}</h2>
            {medals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("journey.noMedals")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {medals.map((mm) => (
                  <span
                    key={mm.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300"
                  >
                    <Award className="size-3.5" /> {mm.title}
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

      {dialog && householdId && (
        <StageDialog
          mode={dialog.mode}
          stage={dialog.stage}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
          onCreate={(vals) => createFn({ data: { household_id: householdId, ...vals } })}
          onUpdate={(id, vals) => updateFn({ data: { id, ...vals } })}
        />
      )}

      {celebrate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCelebrate(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Trophy className="size-7" />
            </div>
            <h2 className="font-display text-2xl">{t("journey.levelUpTitle", { n: celebrate.level })}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("journey.levelUpBody", { role: t(`journey.role.${celebrate.roleKey}` as MessageKey) })}
            </p>
            <Button className="mt-4 w-full" onClick={() => setCelebrate(null)}>
              {t("journey.celebrate.close")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StageDialog({
  mode,
  stage,
  onClose,
  onSaved,
  onCreate,
  onUpdate,
}: {
  mode: "add" | "edit";
  stage?: JourneyStage;
  onClose: () => void;
  onSaved: () => void;
  onCreate: (vals: { title: string; objective: string | null; optional: boolean }) => Promise<unknown>;
  onUpdate: (id: string, vals: { title: string | null; objective: string | null; optional: boolean }) => Promise<unknown>;
}) {
  const t = useT();
  const [title, setTitle] = useState(stage?.title ?? "");
  const [objective, setObjective] = useState(stage?.objective ?? "");
  const [optional, setOptional] = useState(stage?.optional ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error(t("journey.needTitle"));
      return;
    }
    setSaving(true);
    try {
      if (mode === "add") {
        await onCreate({ title: trimmed, objective: objective.trim() || null, optional });
      } else if (stage) {
        await onUpdate(stage.id, { title: trimmed, objective: objective.trim() || null, optional });
      }
      onSaved();
    } catch {
      toast.error(t("journey.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("journey.newStage") : t("journey.editStage")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("journey.field.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>{t("journey.field.objective")}</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} className="size-4" />
            {t("journey.field.optional")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {t("journey.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
