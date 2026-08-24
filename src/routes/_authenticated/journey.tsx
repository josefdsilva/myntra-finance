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
import { ValuesRatiosCard } from "@/components/values-ratios-card";
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
import { TimeToDreamLine } from "@/components/time-to-dream";
import { JourneyCoach } from "@/components/journey-coach";
import { listKpiTargets, createKpiTarget, type KpiTarget } from "@/lib/kpi-targets.functions";
import { metricMeta, formatMetricValue, isTargetMet, computeMetrics, fetchMetricInputs, type MetricKey } from "@/lib/metrics";
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

export function JourneyPage({ embedded = false }: { embedded?: boolean } = {}) {
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
  const kpiTargetsFn = useServerFn(listKpiTargets);
  const createKpiFn = useServerFn(createKpiTarget);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

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
      const [{ data: buckets }, { data: allocs }, movements, { data: incomes }, { data: debts }, { data: fixed }, { data: cyc }] =
        await Promise.all([
          supabase
            .from("buckets")
            .select("id, name, color, kind, target_type, target_value, target_deadline, initial_balance")
            .eq("household_id", householdId!)
            .order("sort_order"),
          supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId!),
          fetchMovements(householdId!),
          supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
          supabase
            .from("debts")
            .select("id, label, monthly_amount, principal_remaining, starting_principal")
            .eq("household_id", householdId!),
          supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
          supabase
            .from("cycle_metrics")
            .select("spend_actual, planned_spend")
            .eq("household_id", householdId!)
            .order("cycle_end", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
      const bs = (buckets ?? []) as Bucket[];
      const balances = bucketBalancesFor(
        bs.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
        (allocs ?? []) as Array<{ bucket_id: string; amount: number | string }>,
        movements as AccountMovement[],
      );
      const incomeArr = (incomes ?? []).map((r) => Number(r.monthly_amount) || 0);
      const income = incomeArr.reduce((s, v) => s + v, 0);
      const incomeMax = incomeArr.reduce((mx, v) => Math.max(mx, v), 0);
      const debtMonthly = (debts ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const fixedMonthly = (fixed ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      // Remaining/starting principal per debt, for any "clear this loan" stage.
      const debtsById: Record<string, { remaining: number; starting: number }> = {};
      for (const d of (debts ?? []) as Array<{
        id: string;
        principal_remaining: number | string | null;
        starting_principal: number | string | null;
      }>) {
        debtsById[d.id] = {
          remaining: Number(d.principal_remaining ?? d.starting_principal ?? 0),
          starting: Number(d.starting_principal ?? d.principal_remaining ?? 0),
        };
      }
      return {
        buckets: bs,
        balances,
        debtsById,
        income,
        incomeMax,
        debtMonthly,
        essentials: fixedMonthly + debtMonthly,
        spendActual: cyc ? Number(cyc.spend_actual) : null,
        plannedSpend: cyc?.planned_spend != null ? Number(cyc.planned_spend) : null,
      };
    },
  });

  const { data: achievements } = useQuery({
    enabled: !!householdId,
    queryKey: ["achievements", householdId],
    queryFn: () => listAchFn({ data: { household_id: householdId! } }),
  });

  const { data: kpiTargets } = useQuery({
    enabled: !!householdId,
    queryKey: ["kpi-targets", householdId],
    queryFn: () => kpiTargetsFn({ data: { household_id: householdId! } }),
  });

  // All metric values come from the shared registry (shared cache key with the
  // Grow → Targets tab), so the journey knows every metric a target can track.
  const { data: registryMetrics } = useQuery({
    enabled: !!householdId,
    queryKey: ["kpi-metrics", householdId],
    queryFn: async () => computeMetrics(await fetchMetricInputs(householdId!)),
  });

  // Sourced from the shared registry — no separate copy of the formulas here.
  // Values may be null when a metric isn't computable yet.
  const metrics = (registryMetrics ?? null) as Record<string, number | null> | null;

  // Evaluate each persisted stage against the live metrics.
  const evaluated = useMemo(() => {
    const stages = stagesQ.data ?? [];
    // Require real metrics before evaluating — otherwise placeholder zeros make
    // "under 15%" trivially true and briefly mark the debt stage complete, which
    // the achievement recorder would lock in as a bogus medal.
    if (!stages.length || !metrics) return null;
    const m = metrics;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const fmt = (key: string, cur: number) => {
      const f = metricMeta(key)?.format;
      if (f === "currency" || key === "invested_amount") return money(cur);
      if (f === "pct") return `${Math.round(cur)}%`;
      if (f === "years") return t("journey.years", { n: cur.toFixed(1) });
      return t("journey.months", { n: cur.toFixed(1) });
    };

    // What a normal month costs — the denominator behind every "months of cover"
    // metric, so a months-based rung can be expressed as euros still to save.
    const monthlyCost = Math.max(
      1,
      (metricsData?.essentials ?? 0) + (metricsData?.plannedSpend ?? 0),
    );

    const evalOne = (
      s: JourneyStage,
    ): { complete: boolean; progress: number; value: string | null; gapEur: number | null } => {
      if (s.objective_type === "custom") {
        return {
          complete: s.status === "done",
          progress: s.status === "done" ? 1 : 0,
          value: null,
          gapEur: null,
        };
      }
      if (s.objective_type === "project") {
        const cfg = s.objective_config as { bucket_id?: string; debt_id?: string };
        // "Clear this loan" — progress by principal paid down; complete at zero.
        if (cfg.debt_id) {
          const d = metricsData?.debtsById?.[String(cfg.debt_id)];
          if (!d || d.starting <= 0)
            return { complete: false, progress: 0, value: null, gapEur: null };
          return {
            complete: d.remaining <= 0.01,
            progress: clamp01((d.starting - d.remaining) / d.starting),
            value: t("journey.debtRemaining", { amount: money(d.remaining) }),
            gapEur: Math.max(0, d.remaining),
          };
        }
        const id = String(cfg.bucket_id ?? "");
        const b = metricsData?.buckets.find((x) => x.id === id);
        const bal = metricsData?.balances[id] ?? 0;
        const target = Number(b?.target_value ?? 0);
        if (!b || target <= 0) return { complete: false, progress: 0, value: null, gapEur: null };
        return {
          complete: bal >= target - 0.01,
          progress: clamp01(bal / target),
          value: `${money(bal)} / ${money(target)}`,
          gapEur: Math.max(0, target - bal),
        };
      }
      const cfg = s.objective_config as { key?: string; op?: string; value?: number };
      const key = String(cfg.key ?? "");
      const op = cfg.op === "<=" ? "<=" : ">=";
      const target = Number(cfg.value ?? 0);
      const raw = m[key];
      // Metric not computable yet (e.g. no cycle closed for spending vs plan) —
      // show 0% and never complete, so no bogus medal is minted.
      if (raw == null) return { complete: false, progress: 0, value: null, gapEur: null };
      const cur = raw;
      const complete = op === "<=" ? cur <= target : cur >= target;
      const progress = op === "<=" ? (complete ? 1 : clamp01(target / Math.max(cur, 0.0001))) : clamp01(cur / Math.max(target, 0.0001));
      // Only "save up to X" rungs have an honest euro gap: months of cover
      // convert through a normal month's cost, currency metrics are already
      // euros. Ratio rungs (debt-to-income, %) don't, so they show no pace.
      const format = metricMeta(key)?.format;
      const gapEur =
        complete || op === "<="
          ? 0
          : format === "months"
            ? Math.max(0, (target - cur) * monthlyCost)
            : format === "currency" || key === "invested_amount"
              ? Math.max(0, target - cur)
              : null;
      return { complete, progress, value: fmt(key, cur), gapEur };
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

    // What the household actually frees up each month — the pace behind every
    // "at this pace" line. Income minus what a normal month costs.
    const paceEur = Math.max(0, (metricsData?.income ?? 0) - monthlyCost);

    return {
      all: withEval,
      spineNodes,
      side,
      doneCount,
      roleKey,
      autoQuests,
      otherProjects,
      paceEur,
    };
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
  const [targetPicker, setTargetPicker] = useState(false);
  const [coachSuggest, setCoachSuggest] = useState<{ key: MetricKey; op: "<=" | ">="; value: number } | null>(null);

  // The coach's degradation nudge links here with ?kpi=&op=&value= — open a
  // prefilled confirmation to turn the slipping metric into a tracked target.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const key = sp.get("kpi");
    if (!key || !metricMeta(key)) return;
    const value = Number(sp.get("value"));
    if (!Number.isFinite(value)) return;
    const op = sp.get("op") === "<=" ? "<=" : ">=";
    setCoachSuggest({ key: key as MetricKey, op, value });
    // Clean the URL so a refresh doesn't re-open the suggestion.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["journey-stages", householdId] });
  }

  async function acceptCoachSuggestion() {
    if (!householdId || !coachSuggest) return;
    const meta = metricMeta(coachSuggest.key);
    const label = meta ? t(meta.labelKey) : coachSuggest.key;
    try {
      const tg = await createKpiFn({
        data: {
          household_id: householdId,
          title: label,
          metric_key: coachSuggest.key,
          op: coachSuggest.op,
          target_value: coachSuggest.value,
          created_by: "coach",
        },
      });
      await addTargetAsStage(tg);
      qc.invalidateQueries({ queryKey: ["kpi-targets", householdId] });
      setCoachSuggest(null);
    } catch {
      toast.error(t("kpi.saveFailed"));
    }
  }

  // KPI targets already linked to a stage (by kpi_target_id in objective_config),
  // so the picker only offers ones not yet on the journey.
  const linkedTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of stagesQ.data ?? []) {
      const id = (s.objective_config as { kpi_target_id?: string })?.kpi_target_id;
      if (id) ids.add(id);
    }
    return ids;
  }, [stagesQ.data]);

  async function addTargetAsStage(tg: KpiTarget) {
    if (!householdId) return;
    const meta = metricMeta(tg.metric_key);
    const label = meta ? t(meta.labelKey) : tg.metric_key;
    const target = Number(tg.target_value);
    const valueStr = formatMetricValue(tg.metric_key as MetricKey, target, money);
    // Priority: a target already met is a maintained win, so it rides alongside;
    // one still open needs attention, so it belongs on the main spine.
    const cur = metrics ? metrics[tg.metric_key] : null;
    const met = isTargetMet(tg.op, cur ?? null, target);
    const res = await createFn({
      data: {
        household_id: householdId,
        title: tg.title,
        objective: `${label} ${tg.op} ${valueStr}`,
        optional: met,
        objective_type: "metric",
        objective_config: { key: tg.metric_key, op: tg.op, value: target, kpi_target_id: tg.id },
      },
    });
    // Put an unmet spine target right after the current active stage so it's next
    // up, instead of buried at the end of the roadmap.
    const newId = (res as { id: string | null } | null)?.id ?? null;
    if (newId && !met && evaluated) {
      const activeId = evaluated.spineNodes.find((s) => s.status === "active")?.id;
      const order = evaluated.all.map((s) => s.id).filter((id) => id !== newId);
      const at = activeId ? order.indexOf(activeId) + 1 : order.length;
      order.splice(at, 0, newId);
      await reorderFn({ data: { household_id: householdId, ids: order } });
    }
    setTargetPicker(false);
    toast.success(t("journey.targetAdded"));
    refresh();
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
    <div className={embedded ? "space-y-6" : pageShellClass("3xl")}>
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

      {/* The journey is values-first: how much of the flexible money actually
          served those values belongs right under the heading. */}
      {householdId && <ValuesRatiosCard householdId={householdId} />}

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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog({ mode: "add" })}>
              <Plus className="size-4" /> {t("journey.addStage")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTargetPicker(true)}>
              <Target className="size-4" /> {t("journey.addTarget")}
            </Button>
          </div>
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
                        {s.gapEur != null && s.gapEur > 0 && (
                          <TimeToDreamLine gapEur={s.gapEur} paceEur={evaluated.paceEur} />
                        )}
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
                          <>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary/50" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                            </div>
                            {s.gapEur != null && s.gapEur > 0 && (
                              <TimeToDreamLine gapEur={s.gapEur} paceEur={evaluated.paceEur} compact />
                            )}
                          </>
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
                {evaluated.side.map((s) => {
                  const cfg = s.objective_config as {
                    key?: string;
                    op?: string;
                    value?: number;
                    kpi_target_id?: string;
                  };
                  const isMetric = s.objective_type === "metric";
                  const meta = isMetric ? metricMeta(cfg.key ?? "") : undefined;
                  // Where this side-quest came from, so the card explains itself.
                  const origin = cfg.kpi_target_id
                    ? "target"
                    : s.objective_type === "project"
                      ? "project"
                      : s.created_by === "coach"
                        ? "coach"
                        : "milestone";
                  const op = cfg.op === "<=" ? "≤" : "≥";
                  const targetStr =
                    isMetric && cfg.value != null
                      ? formatMetricValue(cfg.key as MetricKey, Number(cfg.value), money)
                      : "";
                  const whatText = meta
                    ? t(meta.descKey)
                    : s.objective_type === "project"
                      ? t("journey.projectDesc")
                      : s.displayObjective || null;
                  return (
                    <div key={s.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Target className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{s.displayTitle}</span>
                          {s.complete && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {t(`journey.origin.${origin}` as MessageKey)}
                          </span>
                        </span>
                        {s.objective_type !== "custom" && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {Math.round(s.progress * 100)}%
                          </span>
                        )}
                      </div>
                      {whatText && <p className="mt-1 text-xs text-muted-foreground">{whatText}</p>}
                      {s.objective_type !== "custom" && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full", s.complete ? "bg-emerald-500" : "bg-primary")}
                            style={{ width: `${Math.round(s.progress * 100)}%` }}
                          />
                        </div>
                      )}
                      {isMetric ? (
                        <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                          {t("kpi.now")} {s.value ?? "—"} · {t("journey.goalShort")} {op} {targetStr}
                        </p>
                      ) : s.value ? (
                        <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{s.value}</p>
                      ) : null}
                    </div>
                  );
                })}
                {evaluated.autoQuests.map((q) => (
                  <div key={q.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{q.name}</span>
                        {q.reached && <Trophy className="size-3.5 shrink-0 text-emerald-600" />}
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t("journey.origin.project")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{q.pct}%</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("journey.projectDesc")}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full", q.reached ? "bg-emerald-500" : "bg-primary")} style={{ width: `${q.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {t("kpi.now")} {money(q.balance)} · {t("journey.goalShort")} {money(q.target)}
                    </p>
                    {!q.reached && (
                      <TimeToDreamLine gapEur={q.target - q.balance} paceEur={evaluated.paceEur} />
                    )}
                  </div>
                ))}
                {evaluated.otherProjects.map((p) => (
                  <div key={p.id} className="rounded-lg border border-dashed border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t("journey.origin.project")}
                        </span>
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

      <Dialog open={targetPicker} onOpenChange={setTargetPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("journey.addTarget")}</DialogTitle>
          </DialogHeader>
          {(() => {
            const available = (kpiTargets ?? []).filter((tg) => !linkedTargetIds.has(tg.id));
            if (available.length === 0) {
              return (
                <div className="space-y-3 py-2 text-sm text-muted-foreground">
                  <p>{t("journey.noTargets")}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/allocations">
                      {t("journey.createTarget")} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              );
            }
            return (
              <ul className="space-y-2">
                {available.map((tg) => {
                  const meta = metricMeta(tg.metric_key);
                  const label = meta ? t(meta.labelKey) : tg.metric_key;
                  const valueStr = formatMetricValue(tg.metric_key as MetricKey, Number(tg.target_value), money);
                  const cur = metrics ? metrics[tg.metric_key] : undefined;
                  return (
                    <li key={tg.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tg.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {label} {tg.op} {valueStr}
                          {cur !== undefined ? ` · ${t("kpi.now")} ${formatMetricValue(tg.metric_key as MetricKey, cur, money)}` : ""}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => addTargetAsStage(tg)}>
                        <Plus className="size-4" /> {t("journey.addStage")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!coachSuggest} onOpenChange={(o) => { if (!o) setCoachSuggest(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("journey.coachSuggestTitle")}</DialogTitle>
          </DialogHeader>
          {coachSuggest &&
            (() => {
              const meta = metricMeta(coachSuggest.key);
              const label = meta ? t(meta.labelKey) : coachSuggest.key;
              const valueStr = formatMetricValue(coachSuggest.key, coachSuggest.value, money);
              return (
                <p className="text-sm text-muted-foreground">
                  {t("journey.coachSuggestBody", { metric: label, op: coachSuggest.op, value: valueStr })}
                </p>
              );
            })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCoachSuggest(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={acceptCoachSuggestion} disabled={!householdId}>
              {t("journey.addTarget")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
