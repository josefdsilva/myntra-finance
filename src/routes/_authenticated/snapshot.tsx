import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Share2, Sparkles, ShieldCheck, TrendingUp, Landmark, PiggyBank, Target } from "lucide-react";
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
import { computeCycle } from "@/lib/cycle";
import { computeHealth, type Badge as BadgeKind } from "@/lib/health-score";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import appIcon from "@/assets/app-icon.svg.asset.json";

export const Route = createFileRoute("/_authenticated/snapshot")({
  head: () => ({ meta: [{ title: "Financial snapshot · bynku" }] }),
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
    queryKey: ["snapshot", householdId],
    queryFn: async () => {
      const [incomes, fixed, debts, buckets, { data: salaries }] = await Promise.all([
        qc.fetchQuery(incomesQuery(householdId!)),
        qc.fetchQuery(fixedExpensesQuery(householdId!)),
        qc.fetchQuery(debtsQuery(householdId!)),
        qc.fetchQuery(bucketsQuery(householdId!)),
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId!)
          .eq("kind", "income")
          .eq("is_salary", true)
          .order("occurred_at", { ascending: false })
          .limit(6),
      ]);
      const cycle = computeCycle((salaries ?? []).map((r) => r.occurred_at as string));
      const [{ data: allocs }, { data: moves }, { data: expenses }] = await Promise.all([
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount")
          .eq("household_id", householdId!),
        supabase
          .from("account_movements")
          .select("*")
          .eq("household_id", householdId!),
        supabase
          .from("expenses")
          .select("amount, kind, is_salary")
          .eq("household_id", householdId!)
          .gte("occurred_at", cycle.start.toISOString())
          .lt("occurred_at", cycle.end.toISOString()),
      ]);

      const income = incomes.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const fixedTotal =
        fixed.reduce((s, r) => s + Number(r.monthly_amount), 0) +
        debts.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const debtMonthly = debts.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const balances = bucketBalancesFor(
        buckets,
        allocs ?? [],
        (moves ?? []) as AccountMovement[],
      );
      const bucketsTotal = Object.values(balances).reduce((s, v) => s + v, 0);
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

      return {
        income,
        fixedTotal,
        debtMonthly,
        bucketsTotal,
        hasInvestment,
        variablePool,
        variableSpent,
        cycleProgress,
      };
    },
  });

  const health = useMemo(() => (data ? computeHealth(data) : null), [data]);
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
        backgroundColor: "#0f172a",
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

      {setupIncomplete && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-6">
            <p className="text-sm">{t("snapshot.setupNeeded")}</p>
          </CardContent>
        </Card>
      )}

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

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[560px] px-4 sm:px-0">
          {health && (
            <SnapshotCard
              ref={cardRef}
              overall={health.overall}
              scores={health.scores}
              badges={health.badges}
              monthLabel={monthLabel}
              t={t as unknown as (key: string, vars?: Record<string, string | number>) => string}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("snapshot.privacyNote")}</p>
    </div>
  );
}

const BADGE_META: Record<
  BadgeKind,
  { icon: typeof Sparkles; tone: string }
> = {
  emergency_ready: { icon: ShieldCheck, tone: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/40" },
  debt_slayer: { icon: Landmark, tone: "bg-sky-500/20 text-sky-100 ring-sky-400/40" },
  consistent_saver: { icon: PiggyBank, tone: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/40" },
  budget_hero: { icon: Target, tone: "bg-amber-500/20 text-amber-100 ring-amber-400/40" },
  investing: { icon: TrendingUp, tone: "bg-violet-500/20 text-violet-100 ring-violet-400/40" },
  getting_started: { icon: Sparkles, tone: "bg-slate-500/20 text-slate-100 ring-slate-400/40" },
};

const SCORE_LABELS: Record<string, string> = {
  savings: "snapshot.score.savings",
  emergency: "snapshot.score.emergency",
  debt: "snapshot.score.debt",
  budget: "snapshot.score.budget",
};

type CardProps = {
  overall: number;
  scores: { key: string; value: number }[];
  badges: BadgeKind[];
  monthLabel: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const SnapshotCard = ({
  ref,
  overall,
  scores,
  badges,
  monthLabel,
  t,
}: CardProps & { ref: React.Ref<HTMLDivElement> }) => {
  const ringColor =
    overall >= 80 ? "#34d399" : overall >= 60 ? "#facc15" : overall >= 40 ? "#fb923c" : "#f87171";
  const circumference = 2 * Math.PI * 52;
  const dash = (overall / 100) * circumference;

  return (
    <div
      ref={ref}
      className="rounded-2xl p-8 text-white shadow-2xl"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, #4c1d95 0%, transparent 50%), radial-gradient(circle at 80% 100%, #0e7490 0%, transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        width: 560,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={appIcon.url} alt="" className="size-8 rounded-lg" />
          <span className="font-display text-xl tracking-tight">bynku</span>
        </div>
        <span className="text-xs uppercase tracking-widest text-white/60">{monthLabel}</span>
      </div>

      <div className="mt-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width={128} height={128} viewBox="0 0 128 128">
            <circle cx={64} cy={64} r={52} stroke="rgba(255,255,255,0.12)" strokeWidth={10} fill="none" />
            <circle
              cx={64}
              cy={64}
              r={52}
              stroke={ringColor}
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-display tabular-nums">{overall}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/60">/ 100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-white/60">
            {t("snapshot.tagline")}
          </p>
          <h2 className="text-2xl font-display leading-tight mt-1">{t("snapshot.overall")}</h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {scores.map((s) => (
          <div key={s.key} className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">{t(SCORE_LABELS[s.key])}</span>
              <span className="tabular-nums font-medium">{s.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${s.value}%`,
                  background:
                    s.value >= 80
                      ? "#34d399"
                      : s.value >= 60
                        ? "#facc15"
                        : s.value >= 40
                          ? "#fb923c"
                          : "#f87171",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {badges.map((b) => {
          const meta = BADGE_META[b];
          const Icon = meta.icon;
          return (
            <span
              key={b}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${meta.tone}`}
            >
              <Icon className="size-3" />
              {t(`snapshot.badge.${b}`)}
            </span>
          );
        })}
      </div>

      <p className="mt-6 text-[10px] uppercase tracking-widest text-white/40 text-right">
        bynku.app
      </p>
    </div>
  );
};
