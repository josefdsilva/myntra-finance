import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/route-meta";
import { Card, CardContent } from "@/components/ui/card";
import { pageShellClass } from "@/components/page-shell";

/**
 * TEMPORARY comparison page (not linked in the nav). Renders three candidate
 * versions of the dashboard hero so the cycle-focused reframing can be judged
 * visually before it is implemented. Static example numbers only — no queries.
 * Delete once a direction is chosen.
 */
export const Route = createFileRoute("/_authenticated/hero-options")({
  head: () =>
    pageMeta({
      title: "Dashboard hero options · bynku",
      description:
        "Three candidate versions of the bynku dashboard hero, comparing a daily framing with a cycle-focused one.",
    }),
  component: HeroOptions,
});

// Example cycle used by all three variants.
const BUDGET = 900;
const RECORDED = 260;
const ESTIMATED = 148;
const LEFT = BUDGET - RECORDED - ESTIMATED;
const DAY = 12;
const DAYS = 30;
const PER_DAY = 27;

const eur = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

function Headline() {
  return (
    <>
      <p className="text-sm text-muted-foreground">Left to spend this cycle</p>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-display text-5xl text-primary md:text-6xl">{eur(LEFT)}</p>
        <span className="text-sm text-muted-foreground">
          roughly {eur(PER_DAY)}/day if spread evenly
        </span>
      </div>
    </>
  );
}

function Pace() {
  return (
    <p className="mt-1.5 text-sm text-muted-foreground">
      {Math.round((DAY / DAYS) * 100)}% of the cycle gone ·{" "}
      {Math.round(((RECORDED + ESTIMATED) / BUDGET) * 100)}% of your everyday budget used —{" "}
      <span className="font-medium text-primary">on track</span>
    </p>
  );
}

/** The honesty bar: recorded, estimated-but-not-recorded, and what's left. */
function EstimationBar() {
  const pct = (n: number) => `${(n / BUDGET) * 100}%`;
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Everyday budget {eur(BUDGET)}</span>
        <span className="tabular-nums">
          {eur(RECORDED)} recorded · {eur(ESTIMATED)} estimated · {eur(LEFT)} left
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: pct(RECORDED) }} />
        <div
          className="h-full bg-primary/35"
          style={{
            width: pct(ESTIMATED),
            backgroundImage:
              "repeating-linear-gradient(45deg, color-mix(in srgb, var(--primary) 45%, transparent) 0 4px, transparent 4px 8px)",
          }}
        />
        <div className="h-full flex-1" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Last recorded spend 6 days ago — the gap is estimated.{" "}
        <span className="font-medium text-primary underline">Reconcile with statement →</span>
      </p>
    </div>
  );
}

/** Today's daily bars — what variant A and B keep. */
function DailySparkline() {
  const bars = [31, 12, 0, 0, 44, 18, 0];
  const max = Math.max(...bars, PER_DAY);
  return (
    <div className="mt-5">
      <div className="relative flex h-16 items-end gap-1.5">
        <div
          className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
          style={{ bottom: `${(PER_DAY / max) * 100}%` }}
        />
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary/70"
            style={{ height: `${Math.max(2, (b / max) * 100)}%` }}
          />
        ))}
      </div>
      <Caption>Last 7 days · dashed line = daily safe-to-spend</Caption>
    </div>
  );
}

/** Cycle-to-date cumulative spend vs even pace — variant C. */
function CycleCurve() {
  const w = 320;
  const h = 90;
  const evenPath = `M0,${h} L${w},0`;
  // Cumulative spend to day 12 (recorded + estimated), slightly under pace.
  const pts = [0, 40, 95, 130, 190, 240, 300, 340, 366, 380, 398, 408];
  const path = pts
    .map((v, i) => {
      const x = (i / (DAYS - 1)) * w;
      const y = h - (v / BUDGET) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = ((pts.length - 1) / (DAYS - 1)) * w;
  const lastY = h - (pts[pts.length - 1] / BUDGET) * h;
  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
        <path d={evenPath} className="stroke-muted-foreground/40" strokeDasharray="4 4" fill="none" />
        <path d={path} className="stroke-primary" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r="3" className="fill-primary" />
      </svg>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Day 1</span>
        <span>Cycle to date · dashed = even pace</span>
        <span>Day {DAYS}</span>
      </div>
    </div>
  );
}

function Panels() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {["Cash in and out", "Your spending plan"].map((title) => (
        <div key={title} className="rounded-lg bg-muted/40 p-4">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">(unchanged — shown as a placeholder)</p>
        </div>
      ))}
    </div>
  );
}

function Variant({
  tag,
  title,
  note,
  children,
}: {
  tag: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{tag}</p>
        <h2 className="font-display text-xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">{children}</CardContent>
      </Card>
    </section>
  );
}

function HeroOptions() {
  return (
    <main className={pageShellClass("5xl")}>
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Dashboard hero — three options</h1>
        <p className="text-sm text-muted-foreground">
          Same example cycle in all three: {eur(BUDGET)} everyday budget over {DAYS} days, day {DAY},{" "}
          {eur(RECORDED)} recorded, {eur(ESTIMATED)} estimated not yet recorded.
        </p>
      </header>

      <Variant
        tag="Option A"
        title="Cycle headline + pace"
        note="Smallest change: honest headline and a gap-tolerant pace read. Does not reveal which part is estimated."
      >
        <Headline />
        <Pace />
        <DailySparkline />
        <Panels />
      </Variant>

      <Variant
        tag="Option B"
        title="Headline + estimation bar"
        note="Adds the honesty layer: the interpolated slice is visible, and a stale ledger becomes a prompt."
      >
        <Headline />
        <EstimationBar />
        <DailySparkline />
        <Panels />
      </Variant>

      <Variant
        tag="Option C"
        title="Full rework (recommended)"
        note="B plus the pace line, and the daily bars give way to a cycle-to-date curve — gaps in recording no longer look like zero-spend days."
      >
        <Headline />
        <Pace />
        <EstimationBar />
        <CycleCurve />
        <Panels />
      </Variant>
    </main>
  );
}
