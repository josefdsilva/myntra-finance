import { pageMeta } from "@/lib/route-meta";
import { LIQUID_ASSET_KINDS } from "@/lib/finance-helpers";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Download,
  Share2,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Landmark,
  PiggyBank,
  Target,
  Gem,
  Users,
  Gauge,
  Layers,
  Activity,
} from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import {
  bucketsQuery,
  incomesQuery,
  fixedExpensesQuery,
  debtsQuery,
} from "@/lib/household-queries";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { fetchCycleBounds, cycleKeyPart } from "@/lib/cycle-bounds";
import { computeHealth, computeBusinessHealth, type Badge as BadgeKind } from "@/lib/health-score";
import { getCountryBenchmark, percentileFromDeciles } from "@/lib/benchmarks";
import { defaultIntentForCategory } from "@/lib/intent";
import { pageShellClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ScoreTrendMini } from "@/components/score-trend";
import { useT } from "@/lib/i18n";
import appIcon from "@/assets/app-icon.svg.asset.json";

export const Route = createFileRoute("/_authenticated/snapshot")({
  head: () =>
    pageMeta({
      path: "/snapshot",
      title: "Financial snapshot · bynku",
      description: "A shareable snapshot of your budget health for the current cycle.",
      noindex: true,
    }),
  component: SnapshotPage,
});

function SnapshotPage() {
  const t = useT();
  const qc = useQueryClient();
  const activeId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeId],
    queryFn: () => fetchHh({ data: activeId ? { household_id: activeId } : {} }),
  });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["snapshot", householdId, ...cycleKeyPart(hh?.household)],
    queryFn: async () => {
      const [incomes, fixed, debts, buckets, cycle] = await Promise.all([
        qc.fetchQuery(incomesQuery(householdId!)),
        qc.fetchQuery(fixedExpensesQuery(householdId!)),
        qc.fetchQuery(debtsQuery(householdId!)),
        qc.fetchQuery(bucketsQuery(householdId!)),
        fetchCycleBounds(supabase, householdId!, hh?.household),
      ]);
      const [
        { data: allocs },
        { data: moves },
        { data: expenses },
        { data: assetsRows },
        { data: debtRows },
      ] = await Promise.all([
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount, period")
          .eq("household_id", householdId!),
        supabase.from("account_movements").select("*").eq("household_id", householdId!),
        supabase
          .from("expenses")
          .select("amount, kind, is_salary, merchant, intent, category")
          .eq("household_id", householdId!)
          .gte("occurred_at", cycle.start.toISOString())
          .lt("occurred_at", cycle.end.toISOString()),
        supabase
          .from("assets")
          .select("current_value, kind, bucket_id")
          .eq("household_id", householdId!),
        // Full debt rows: debtLiveSchedule needs principal/rate/dates to compute
        // the outstanding balance (debtsQuery only carries id + monthly_amount).
        supabase.from("debts").select("*").eq("household_id", householdId!),
      ]);

      const income = incomes.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const fixedTotal =
        fixed.reduce((s, r) => s + Number(r.monthly_amount), 0) +
        debts.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const debtMonthly = debts.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const balances = bucketBalancesFor(buckets, allocs ?? [], (moves ?? []) as AccountMovement[]);
      // A project linked to an asset is represented by that asset; exclude its
      // balance from savings so net worth and the emergency buffer don't double-count.
      const linkedBucketIds = new Set(
        (assetsRows ?? []).map((a) => a.bucket_id).filter((x): x is string => !!x),
      );
      const bucketsTotal = Object.entries(balances).reduce(
        (s, [id, v]) => (linkedBucketIds.has(id) ? s : s + v),
        0,
      );
      const hasInvestment = buckets.some((b) => b.kind === "investment");
      const variablePool = Math.max(0, baseline - fixedTotal);
      const spent = (expenses ?? [])
        .filter((r) => r.kind !== "income")
        .reduce((s, r) => s + Number(r.amount), 0);
      const received = (expenses ?? [])
        .filter((r) => r.kind === "income" && !r.is_salary)
        .reduce((s, r) => s + Number(r.amount), 0);
      const variableSpent = Math.max(0, spent - received);
      const totalDays = Math.max(
        1,
        Math.round((cycle.end.getTime() - cycle.start.getTime()) / 86400000),
      );
      const elapsed = Math.max(
        0,
        Math.min(totalDays, Math.round((Date.now() - cycle.start.getTime()) / 86400000)),
      );
      const cycleProgress = elapsed / totalDays;

      // Real money set aside THIS CYCLE. Cycles are payday-anchored and can
      // straddle two calendar months (e.g. 25 Jul – 25 Aug), so the old
      // calendar-month window wrongly read 0 at the start of a new month even
      // when the cycle's saving happened in the previous month. Scope it to the
      // cycle window instead: allocations are keyed by the month the cycle
      // STARTS in, and deposits are counted by timestamp within [start, end).
      const period = `${cycle.start.getFullYear()}-${String(
        cycle.start.getMonth() + 1,
      ).padStart(2, "0")}-01`;
      const confirmedThisCycle = (allocs ?? [])
        .filter((a) => a.period === period)
        .reduce((s, a) => s + Number(a.amount), 0);
      const netIntoProjects = ((moves ?? []) as AccountMovement[]).reduce((s, m) => {
        const created = new Date(m.created_at);
        if (created < cycle.start || created >= cycle.end) return s;
        if (m.reason === "plan_payment") return s; // paying a plan isn't new saving
        let d = 0;
        if (m.to_type === "bucket") d += Number(m.amount);
        if (m.from_type === "bucket") d -= Number(m.amount);
        return s + d;
      }, 0);
      const savedThisCycle = Math.max(0, confirmedThisCycle + netIntoProjects);

      // Assets & net worth. Liquid assets (cash/stocks/bonds/funds) count as an
      // accessible emergency backstop; net worth = assets + savings − debt owed.
      const assetsTotal = (assetsRows ?? []).reduce((s, a) => s + Number(a.current_value), 0);
      const liquidAssets = (assetsRows ?? [])
        .filter((a) => LIQUID_ASSET_KINDS.has(a.kind))
        .reduce((s, a) => s + Number(a.current_value), 0);
      const debtRemaining = ((debtRows ?? []) as Debt[]).reduce(
        (s, d) => s + debtLiveSchedule(d).remaining,
        0,
      );
      const netWorth = assetsTotal + bucketsTotal - debtRemaining;
      const hasNetWorthData = assetsTotal > 0 || bucketsTotal > 0 || debtRemaining > 0;

      // --- New household scorecard inputs (income, consumption, deploy, funding) --
      // Consumption quality: share of this cycle's variable spend that is
      // nice-to-have or treat (from each expense's tag, or its category default).
      let superSum = 0;
      for (const r of expenses ?? []) {
        if (r.kind === "income") continue;
        const level =
          (r.intent as string | null) || defaultIntentForCategory(String(r.category ?? "other"));
        if (level === "nice_to_have" || level === "treat") superSum += Number(r.amount);
      }
      const superfluousShare = spent > 0 ? Math.min(1, superSum / spent) : null;

      // Invested holdings = investment-kind projects + quickly-sellable assets.
      const investedFromBuckets = buckets
        .filter((b) => b.kind === "investment" && !linkedBucketIds.has(b.id))
        .reduce((s, b) => s + Math.max(0, balances[b.id] ?? 0), 0);
      const investedAmount = investedFromBuckets + Math.max(0, liquidAssets);

      // Funding consistency: average funded fraction across projects with a target.
      const targeted = buckets.filter(
        (b) => !linkedBucketIds.has(b.id) && Number(b.target_value) > 0,
      );
      const fundedFraction =
        targeted.length > 0
          ? targeted.reduce(
              (s, b) => s + Math.min(1, Math.max(0, balances[b.id] ?? 0) / Number(b.target_value)),
              0,
            ) / targeted.length
          : null;

      // Income percentile vs the country's equivalised-income deciles — leak-free
      // (only the relative position is used). OECD-modified equivalence scale.
      const adults = Math.max(1, Number(hh?.household?.adults ?? 1));
      const children = Math.max(0, Number(hh?.household?.children ?? 0));
      const equivFactor = 1 + 0.5 * (adults - 1) + 0.3 * children;
      const equivAnnual = (income * 12) / (equivFactor || 1);
      const bench = getCountryBenchmark(hh?.household?.country);
      const incomePercentile = bench?.incomeDecilesAnnualEquivalised
        ? percentileFromDeciles(
            equivAnnual,
            bench.incomeDecilesAnnualEquivalised as Parameters<typeof percentileFromDeciles>[1],
          )
        : null;

      // --- Business indicators ------------------------------------------------
      // Revenue diversification: the monthly amount of each income stream, plus
      // the distinct payers/clients seen in this cycle's receipts.
      const incomeSources = incomes.map((r) => Number(r.monthly_amount)).filter((n) => n > 0);
      const distinctClients = new Set(
        (expenses ?? [])
          .filter((r) => r.kind === "income")
          .map((r) => (r.merchant ?? "").trim().toLowerCase())
          .filter((m) => m.length > 0),
      ).size;
      const employees = Number(hh?.household?.employees ?? 0);
      const hasProjects = buckets.length > 0;
      const activityCount = (expenses ?? []).length;
      const monthlyOutgoings = fixedTotal + variablePool;
      // Operating cash flow ≈ revenue − all running costs (fixed + debt + everyday).
      const operatingCashFlow = income - monthlyOutgoings;
      const reserve = bucketsTotal + Math.max(0, liquidAssets);

      return {
        income,
        savedThisCycle,
        assetsTotal,
        liquidAssets,
        netWorth,
        hasNetWorthData,
        fixedTotal,
        debtMonthly,
        bucketsTotal,
        hasInvestment,
        variablePool,
        variableSpent,
        cycleProgress,
        // New scorecard inputs
        incomePercentile,
        superfluousShare,
        investedAmount,
        fundedFraction,
        // Business
        incomeSources,
        distinctClients,
        employees,
        hasProjects,
        activityCount,
        monthlyOutgoings,
        operatingCashFlow,
        reserve,
      };
    },
  });

  const isBusiness = hh?.household?.kind === "business";
  const health = useMemo(() => {
    if (!data) return null;
    if (isBusiness) {
      return computeBusinessHealth({
        revenueMonthly: data.income,
        operatingCashFlow: data.operatingCashFlow,
        reserve: data.reserve,
        monthlyOutgoings: data.monthlyOutgoings,
        debtMonthly: data.debtMonthly,
        netWorth: data.netWorth,
        hasNetWorthData: data.hasNetWorthData,
        incomeSources: data.incomeSources,
        distinctClients: data.distinctClients,
        employees: data.employees,
        hasProjects: data.hasProjects,
        activityCount: data.activityCount,
      });
    }
    return computeHealth(data);
  }, [data, isBusiness]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const setupIncomplete = !data || data.income === 0;

  const monthLabel = useMemo(
    () => new Date().toLocaleString(undefined, { month: "long", year: "numeric" }),
    [],
  );

  async function makeBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: isBusiness ? "#0a0a0a" : "#0f172a",
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    const blob = await makeBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bynku-snapshot-${new Date().toISOString().slice(0, 7)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    const blob = await makeBlob();
    if (!blob) return;
    const file = new File([blob], "bynku-snapshot.png", { type: "image/png" });
    const nav = window.navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({
          files: [file],
          title: t("snapshot.shareTitle"),
          text: t("snapshot.shareText"),
        });
        return;
      } catch {
        // user cancelled — fall through to download
      }
    }
    await handleDownload();
    toast.success(t("snapshot.downloaded"));
  }

  return (
    <div className={pageShellClass("4xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("snapshot.title")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("snapshot.subtitle")}</p>
      </header>

      {setupIncomplete ? (
        <EmptyState
          icon={Sparkles}
          title={t("snapshot.empty.title")}
          description={t("snapshot.setupNeeded")}
          ctaLabel={t("snapshot.empty.cta")}
          ctaTo="/cashflow"
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleShare} disabled={busy || !health}>
              <Share2 className="size-4" />
              {t("snapshot.share")}
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={busy || !health}>
              <Download className="size-4" />
              {t("snapshot.download")}
            </Button>
          </div>

          {/* The card is authored at a fixed export width so every download and
              share looks identical on any device. On narrow screens we scale it
              down visually instead of allowing horizontal scroll. */}
          <ScaledPreview>
            {health && (
              <SnapshotCard
                ref={cardRef}
                overall={health.overall}
                scores={health.scores}
                badges={health.badges}
                monthLabel={monthLabel}
                isBusiness={isBusiness}
                t={t as unknown as (key: string, vars?: Record<string, string | number>) => string}
              />
            )}
          </ScaledPreview>


          <ScoreTrendMini householdId={householdId} isBusiness={isBusiness} />

          <p className="text-xs text-muted-foreground">{t("snapshot.privacyNote")}</p>
        </>
      )}
    </div>
  );
}

/** Fixed export width of the snapshot image — identical on every device. */
const CARD_WIDTH = 600;

/**
 * Shows the fixed-width snapshot card scaled to fit the available width, so it
 * never causes horizontal scrolling. The DOM node keeps its real 600px size, so
 * the exported PNG stays device-independent.
 */
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const measure = () => {
      const s = Math.min(1, box.clientWidth / CARD_WIDTH);
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={boxRef} className="w-full min-w-0" style={{ height: height || undefined }}>
      <div
        ref={innerRef}
        style={{ width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}



// Premium (gold/emerald) tone used for the business snapshot's badges so the
// whole card reads more refined than the household rainbow.
const PREMIUM_TONE = "bg-amber-300/10 text-amber-50 ring-amber-300/30";

const BADGE_META: Record<BadgeKind, { icon: typeof Sparkles; tone: string }> = {
  emergency_ready: {
    icon: ShieldCheck,
    tone: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/40",
  },
  debt_slayer: { icon: Landmark, tone: "bg-sky-500/20 text-sky-100 ring-sky-400/40" },
  consistent_saver: {
    icon: PiggyBank,
    tone: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/40",
  },
  budget_hero: { icon: Target, tone: "bg-amber-500/20 text-amber-100 ring-amber-400/40" },
  investing: { icon: TrendingUp, tone: "bg-violet-500/20 text-violet-100 ring-violet-400/40" },
  net_worth_positive: { icon: Gem, tone: "bg-teal-500/20 text-teal-100 ring-teal-400/40" },
  getting_started: { icon: Sparkles, tone: "bg-slate-500/20 text-slate-100 ring-slate-400/40" },
  // Business badges — premium tone.
  fcf_positive: { icon: TrendingUp, tone: PREMIUM_TONE },
  strong_runway: { icon: ShieldCheck, tone: PREMIUM_TONE },
  diversified: { icon: Layers, tone: PREMIUM_TONE },
  productive: { icon: Gauge, tone: PREMIUM_TONE },
  low_leverage: { icon: Landmark, tone: PREMIUM_TONE },
  equity_positive: { icon: Gem, tone: PREMIUM_TONE },
  active: { icon: Activity, tone: PREMIUM_TONE },
};

const SCORE_LABELS: Record<string, string> = {
  income: "snapshot.score.income",
  consumption: "snapshot.score.consumption",
  emergency: "snapshot.score.emergency",
  deploy: "snapshot.score.deploy",
  debt: "snapshot.score.debt",
  funding: "snapshot.score.funding",
  networth: "snapshot.score.networth",
  savings: "snapshot.score.savings",
  budget: "snapshot.score.budget",
  // Business pillars
  cashflow: "snapshot.score.cashflow",
  runway: "snapshot.score.runway",
  diversification: "snapshot.score.diversification",
  productivity: "snapshot.score.productivity",
  equity: "snapshot.score.equity",
};

type CardProps = {
  overall: number;
  scores: { key: string; value: number }[];
  badges: BadgeKind[];
  monthLabel: string;
  isBusiness?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

// Score → colour. Households use a plain traffic-light scale; businesses get a
// metallic gold/bronze scale so the whole card reads premium.
function scoreColor(v: number, isBusiness: boolean): string {
  if (isBusiness) {
    return v >= 80 ? "#e8c874" : v >= 60 ? "#cdae6b" : v >= 40 ? "#b08d57" : "#c77b6b";
  }
  return v >= 80 ? "#34d399" : v >= 60 ? "#facc15" : v >= 40 ? "#fb923c" : "#f87171";
}

const SnapshotCard = ({
  ref,
  overall,
  scores,
  badges,
  monthLabel,
  isBusiness = false,
  t,
}: CardProps & { ref: React.Ref<HTMLDivElement> }) => {
  const ringColor = scoreColor(overall, isBusiness);
  // Premium: deep charcoal with champagne-gold and emerald light sources.
  const background = isBusiness
    ? "radial-gradient(circle at 14% -8%, rgba(212,175,90,0.22) 0%, transparent 55%), radial-gradient(circle at 100% 108%, rgba(20,120,96,0.24) 0%, transparent 55%), linear-gradient(135deg, #0b0b0e 0%, #17140d 55%, #0a0a0a 100%)"
    : "radial-gradient(circle at 15% -10%, #6d28d9 0%, transparent 55%), radial-gradient(circle at 100% 110%, #0891b2 0%, transparent 55%), linear-gradient(135deg, #0b1024 0%, #1e1b4b 55%, #0f172a 100%)";

  return (
    <div
      ref={ref}
      className="rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden"
      style={{ background, width: 600 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={appIcon.url}
            alt=""
            className={`size-9 rounded-xl ring-1 ${isBusiness ? "ring-amber-300/30" : "ring-white/20"}`}
          />
          <span className="font-display text-2xl tracking-tight">bynku</span>
          {isBusiness && (
            <span className="ml-1 inline-flex items-center rounded-full bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-200 ring-1 ring-amber-300/40">
              {t("snapshot.businessLabel")}
            </span>
          )}
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">{monthLabel}</span>
      </div>

      {/* Hero score */}
      <div className="mt-8 flex items-center gap-7">
        <div className="relative shrink-0">
          <svg width={144} height={144} viewBox="0 0 144 144">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={ringColor} stopOpacity="1" />
                <stop offset="100%" stopColor={ringColor} stopOpacity="0.55" />
              </linearGradient>
            </defs>
            <circle
              cx={72}
              cy={72}
              r={60}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={11}
              fill="none"
            />
            <circle
              cx={72}
              cy={72}
              r={60}
              stroke="url(#ringGrad)"
              strokeWidth={11}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(overall / 100) * (2 * Math.PI * 60)} ${2 * Math.PI * 60}`}
              transform="rotate(-90 72 72)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-display tabular-nums leading-none">{overall}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1">/ 100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
            {t(isBusiness ? "snapshot.taglineBiz" : "snapshot.tagline")}
          </p>
          <h2 className="text-3xl font-display leading-tight mt-1.5">
            {t(isBusiness ? "snapshot.overallBiz" : "snapshot.overall")}
          </h2>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="mt-7 grid grid-cols-2 gap-2.5">
        {scores.map((s) => (
          <div
            key={s.key}
            className="rounded-xl bg-white/[0.06] ring-1 ring-white/10 px-3.5 py-2.5 backdrop-blur"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/75">{t(SCORE_LABELS[s.key])}</span>
              <span className="tabular-nums font-semibold">{s.value}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.value}%`, background: scoreColor(s.value, isBusiness) }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        {badges.map((b) => {
          const meta = BADGE_META[b];
          const Icon = meta.icon;
          return (
            <span
              key={b}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${meta.tone}`}
            >
              <Icon className="size-3.5" />
              {t(`snapshot.badge.${b}`)}
            </span>
          );
        })}
      </div>

      {/* CTA footer — the growth loop */}
      <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">{t("snapshot.ctaHeadline")}</p>
          <p className="text-xs text-white/60 mt-0.5">{t("snapshot.buildYours")}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-white text-slate-900 px-4 py-2.5 text-sm font-semibold shadow-lg">
          bynku.app
        </div>
      </div>
    </div>
  );
};
