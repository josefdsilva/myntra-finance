import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Wallet,
  Gauge,
  PiggyBank,
  MessageCircle,
  BarChart3,
  CalendarClock,
  FastForward,
  ShieldCheck,
  ArrowRight,
  Check,
  Building2,
  Users,
  TrendingUp,
  Landmark,
  ScanLine,
  Receipt,
  Scale,
  Lightbulb,
  Map as MapIcon,
  Target,
  Trophy,
  BellRing,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { joinWaitlist, isValidEmail } from "@/lib/waitlist";

// The public marketing page shown at "/" to visitors who are not signed in.
// English-first by design; localised once the copy settles. Faithful in-app
// mockups stand in for real screenshots until those are supplied.
//
// bynku is pre-launch, so the primary call to action is "join the waiting list"
// (an email we contact when a spot opens), captured with explicit GDPR consent.

// Fixed brand surfaces for the premium snapshot, so it keeps the same deep-teal
// look in both light and dark rather than flipping with the primary token.
const DEEP = "oklch(0.30 0.055 195)";
const ACCENT = "oklch(0.72 0.12 155)";

// --- Waiting-list wiring -----------------------------------------------------

const JoinContext = createContext<() => void>(() => {});
const useJoin = () => useContext(JoinContext);

// --- Theme for the public pages ---------------------------------------------
// The app stores the chosen theme in localStorage["theme"] and toggles a `.dark`
// class on <html>. On the public pages we honour that saved choice so a signed-in
// visitor keeps their theme, and fall back to the OS setting for anonymous
// visitors (tracking live changes). We never write localStorage and never strip
// the class on unmount, so returning to the app leaves its theme intact.

function useDeviceTheme() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      root.classList.toggle("dark", stored === "dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

// Reveal-on-scroll wrapper. Respects reduced-motion by showing immediately.
function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      bynku
    </span>
  );
}

function CtaRow({ size = "default", center = false }: { size?: "default" | "lg"; center?: boolean }) {
  const openJoin = useJoin();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", center && "justify-center")}>
      <Button size={size} onClick={openJoin}>
        Join the waiting list <ArrowRight className="size-4" />
      </Button>
      <Button asChild variant="outline" size={size}>
        <Link to="/auth">Log in</Link>
      </Button>
    </div>
  );
}

// ---- Premium snapshot with a households / businesses tab ---------------------

type SnapshotData = {
  title: string;
  score: number;
  badges: string[];
  bars: [string, number][];
};

const SNAPSHOTS: Record<"household" | "business", SnapshotData> = {
  household: {
    title: "Financial health",
    score: 74,
    badges: ["Emergency ready", "Debt slayer", "Investing"],
    bars: [
      ["Income", 78],
      ["Consumption", 82],
      ["Buffer", 66],
      ["Debt", 90],
      ["Funding", 60],
      ["Net worth", 71],
    ],
  },
  business: {
    title: "Business health",
    score: 68,
    badges: ["Positive cash flow", "Low leverage", "Diversified"],
    bars: [
      ["Cash flow", 72],
      ["Runway", 58],
      ["Diversification", 64],
      ["Productivity", 70],
      ["Debt", 88],
      ["Equity", 55],
    ],
  },
};

function SnapshotShowcase() {
  const [aud, setAud] = useState<"household" | "business">("household");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const d = SNAPSHOTS[aud];
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="mx-auto w-full min-w-0 max-w-sm md:mx-0 md:ml-auto">
      <div className="mb-3 inline-flex rounded-lg border bg-card p-0.5 text-xs sm:text-sm">
        {(["household", "business"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAud(k)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors sm:px-3.5",
              aud === k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {k === "household" ? "For households" : "For businesses"}
          </button>
        ))}
      </div>
      <div
        className="min-w-0 rounded-2xl p-5 text-white shadow-xl transition-opacity duration-300 sm:p-6"
        style={{ backgroundColor: DEEP }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative size-24 shrink-0 sm:size-28">
            <svg viewBox="0 0 120 120" className="size-24 -rotate-90 sm:size-28">
              <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" stroke="rgba(255,255,255,0.18)" />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                stroke={ACCENT}
                strokeDasharray={c}
                style={{
                  strokeDashoffset: mounted ? c - (c * d.score) / 100 : c,
                  transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.2,1)",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl tabular-nums">{d.score}</span>
              <span className="text-xs opacity-80">of 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-medium">{d.title}</p>
            <p className="mt-0.5 text-xs opacity-80">
              A shareable snapshot that never reveals a single amount
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.badges.map((b) => (
                <span key={b} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {d.bars.map(([label, val]) => (
            <div key={label} className="min-w-0">
              <div className="flex justify-between gap-2 text-xs">
                <span className="truncate opacity-85">{label}</span>
                <span className="shrink-0 tabular-nums">{val}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/15">
                <div
                  className="h-full rounded transition-[width] duration-700 ease-out"
                  style={{ width: mounted ? `${val}%` : 0, backgroundColor: ACCENT }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Fast forward with scenario chips ---------------------------------------

const FF_SERIES: Record<string, number[]> = {
  base: [40, 58, 78, 100, 124, 150, 178],
  overpay: [40, 56, 76, 102, 132, 166, 204],
  job: [40, 64, 92, 120, 150, 182, 214],
  retire: [40, 58, 78, 98, 116, 130, 140],
};
const FF_LABELS: [string, string][] = [
  ["base", "Base"],
  ["overpay", "Overpay loan"],
  ["job", "New job"],
  ["retire", "Retire at 60"],
];

function ffPoints(arr: number[]) {
  const w = 260;
  const h = 110;
  const mn = 30;
  const mx = 220;
  return arr
    .map((v, i) => `${((i / (arr.length - 1)) * w).toFixed(0)},${(h - ((v - mn) / (mx - mn)) * h).toFixed(0)}`)
    .join(" ");
}

function FastForwardMock() {
  const [scenario, setScenario] = useState<string>("base");
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <FastForward className="size-3.5" /> Fast forward
        </span>
        <span className="text-sm font-medium text-primary">net worth in 10y</span>
      </div>
      <svg viewBox="0 0 260 110" className="mt-2 w-full overflow-visible">
        <polyline points={ffPoints(FF_SERIES.base)} fill="none" strokeWidth={2} strokeDasharray="3 3" className="stroke-border" />
        <polyline
          points={ffPoints(FF_SERIES[scenario])}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary transition-all duration-500"
        />
      </svg>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FF_LABELS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScenario(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              scenario === key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Animated coach ---------------------------------------------------------

const COACH_SCRIPT: { role: "user" | "coach"; text: string }[] = [
  { role: "user", text: "Should I overpay my car loan or invest the €300 this cycle?" },
  {
    role: "coach",
    text: "Your car loan is 9.1%, above a realistic 6% return, so overpay it first. It clears about 7 months sooner and saves roughly €240 in interest.",
  },
  { role: "user", text: "And if I switch jobs for €400 more a month?" },
  {
    role: "coach",
    text: "Run it in Fast Forward: at your saving rate that reaches a full 6 month buffer 14 months earlier.",
  },
];

function CoachMock() {
  const [shown, setShown] = useState<number>(0);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (t: ReturnType<typeof setTimeout>) => timers.push(t);
    function schedule(i: number) {
      if (!alive) return;
      if (i >= COACH_SCRIPT.length) {
        push(
          setTimeout(() => {
            if (!alive) return;
            setShown(0);
            setTyping(false);
            schedule(0);
          }, 2800),
        );
        return;
      }
      const msg = COACH_SCRIPT[i];
      if (msg.role === "user") {
        setTyping(false);
        setShown(i + 1);
        push(setTimeout(() => schedule(i + 1), 900));
      } else {
        setTyping(true);
        push(
          setTimeout(() => {
            if (!alive) return;
            setTyping(false);
            setShown(i + 1);
            push(setTimeout(() => schedule(i + 1), 1500));
          }, 1100),
        );
      }
    }
    push(setTimeout(() => schedule(0), 500));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="mx-auto flex min-h-[190px] w-full max-w-md flex-col gap-2.5 rounded-2xl border bg-card p-5 shadow-sm">
      {COACH_SCRIPT.slice(0, shown).map((m, i) => (
        <div
          key={i}
          className={cn(
            "max-w-[88%] animate-in fade-in slide-in-from-bottom-2 rounded-2xl px-3.5 py-2 text-sm duration-300",
            m.role === "user"
              ? "self-end rounded-br-sm bg-primary text-primary-foreground"
              : "self-start rounded-bl-sm bg-muted",
          )}
        >
          {m.text}
        </div>
      ))}
      {typing && (
        <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
          <span className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Unique-to-bynku mocks --------------------------------------------------

function EstimatesMock() {
  const actual = [63, 71, 58, 76, 67, 61];
  const est = [55, 56, 57, 58, 60, 62];
  const W = 240;
  const H = 84;
  const max = 90;
  const bw = 26;
  const gap = (W - actual.length * bw) / (actual.length + 1);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5" /> Estimates vs reality
        </span>
        <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] font-medium text-warning">
          +9% for 3 cycles
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2.5 h-[88px] w-full overflow-visible">
        {actual.map((v, i) => {
          const x = gap + i * (bw + gap);
          const bh = (v / max) * H;
          return <rect key={i} x={x} y={H - bh} width={bw} height={bh} rx={3} fill={ACCENT} opacity={0.85} />;
        })}
        <polyline
          points={est.map((v, i) => `${gap + i * (bw + gap) + bw / 2},${H - (v / max) * H}`).join(" ")}
          fill="none"
          strokeWidth={2.5}
          strokeDasharray="4 3"
          className="stroke-primary"
        />
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Your everyday spend ran above your estimate, so bynku nudged your baseline up to keep safe to
        spend honest.
      </p>
    </div>
  );
}

function JourneyMock() {
  const stages: [string, string, "done" | "active" | "next"][] = [
    ["Level 1", "Cover one month of costs", "done"],
    ["Level 2", "Clear the expensive debt", "active"],
    ["Level 3", "Three months of buffer", "next"],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <MapIcon className="size-3.5" /> Your journey
      </span>
      <div className="mt-3 space-y-3">
        {stages.map(([level, title, state]) => (
          <div key={level} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                state === "done" && "border-transparent text-white",
                state === "active" && "border-primary text-primary",
                state === "next" && "text-muted-foreground",
              )}
              style={state === "done" ? { background: ACCENT } : undefined}
            >
              {state === "done" ? <Check className="size-3" /> : state === "active" ? "→" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">{level}</p>
              <p className="truncate text-sm font-medium">{title}</p>
              {state === "active" && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[62%] rounded-full bg-primary" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetsMock() {
  const targets: [string, string, string, number][] = [
    ["Emergency buffer", "3.0 months", "2.1 now", 70],
    ["Debt to income", "under 25%", "31% now", 45],
    ["Savings rate", "20%", "17% now", 85],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Target className="size-3.5" /> Targets
      </span>
      <div className="mt-3 space-y-3">
        {targets.map(([name, goal, now, pct]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {now} · goal {goal}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: pct >= 80 ? ACCENT : "var(--primary)" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Trophy className="size-3.5" style={{ color: ACCENT }} /> Reached targets stay on your record
      </div>
    </div>
  );
}

function NetWorthMock() {

  const nw = [30, 34, 33, 39, 44, 50, 58, 66];
  const W = 240;
  const H = 70;
  const nx = (i: number) => (i / (nw.length - 1)) * W;
  const ny = (v: number) => H - ((v - 25) / (75 - 25)) * H;
  const pts = nw.map((v, i) => `${nx(i).toFixed(0)},${ny(v).toFixed(0)}`).join(" ");
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <BarChart3 className="size-3.5" /> Net worth
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl tabular-nums">€48,200</span>
        <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: ACCENT }}>
          <TrendingUp className="size-3.5" /> +€3,100 this quarter
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 h-[70px] w-full">
        <path d={`M0,${H} L${pts.split(" ").join(" L")} L${W},${H} Z`} fill={ACCENT} opacity={0.14} />
        <polyline points={pts} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke={ACCENT} />
      </svg>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Assets", "Savings", "Minus debt"].map((t) => (
          <span key={t} className="rounded-full border bg-background px-2 py-0.5 text-[11px]">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlansMock() {
  const plans: [string, string, string, number, boolean][] = [
    ["Dec", "Car service", "-€600", 12, true],
    ["Apr", "Tax return", "+€8,000", 50, false],
    ["Jul", "Holiday", "-€1,300", 86, true],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <CalendarClock className="size-3.5" /> Plans ahead
      </span>
      <div className="relative mx-1 mb-1.5 mt-6 h-11">
        <div className="absolute inset-x-0 top-[7px] h-0.5 bg-border" />
        {plans.map(([month, name, amount, pos, neg]) => (
          <div key={month} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pos}%` }}>
            <div className="mx-auto size-3 rounded-full border-2 border-card bg-primary" />
            <div className="mt-1.5 whitespace-nowrap text-[11px] font-medium">{month}</div>
            <div className="whitespace-nowrap text-[10px] text-muted-foreground">{name}</div>
            <div
              className={cn("whitespace-nowrap text-[10px] font-medium", !neg && "text-[color:var(--color-success)]")}
              style={neg ? undefined : { color: ACCENT }}
            >
              {amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TipsMock() {
  const tips: [string, string][] = [
    ["primary", "€350 of surplus is not working yet"],
    ["warning", "Nice-to-haves are 47% of your spending"],
    ["primary", "Build an emergency fund to cover 3 months"],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Lightbulb className="size-3.5" /> Tips and issues
      </span>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {tips.map(([tone, text], i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className={cn("size-2 shrink-0 rounded-full", tone === "warning" ? "bg-warning" : "bg-primary")} />
            <span className="flex-1 text-sm">{text}</span>
            <MessageCircle className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareMock() {
  const rows: [string, number, number][] = [
    ["Savings rate", 72, 44],
    ["Housing", 56, 62],
    ["Eating out", 48, 36],
    ["Debt to income", 30, 52],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Scale className="size-3.5" /> How you compare
      </span>
      <div className="mt-2 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-primary" /> you
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-foreground/60" /> country median
        </span>
        <span className="ml-auto rounded-full border bg-background px-2 py-0.5 text-[11px]">
          relative shares, no amounts
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-6">
        {rows.map(([label, you, median]) => (
          <div key={label}>
            <div className="mb-1 text-xs">{label}</div>
            <div className="relative h-2 overflow-hidden rounded bg-border">
              <div className="absolute inset-y-0 left-0 rounded bg-primary" style={{ width: `${you}%` }} />
              <div className="absolute inset-y-[-3px] w-0.5 bg-foreground/60" style={{ left: `${median}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Static content ---------------------------------------------------------

const DIFFERENCE = [
  {
    icon: ShieldCheck,
    title: "We do not sell you products",
    body: "No commissions, no ads, no upsells. bynku's only job is to improve your financial position, not a bank's.",
  },
  {
    icon: MessageCircle,
    title: "AI that analyses, not sells",
    body: "The coach reads your real income, constraints, plans and projects, and reasons about your situation. It gives you options, never a sales pitch.",
  },
  {
    icon: Landmark,
    title: "Grounded in real principles",
    body: "Emergency fund first, clear expensive debt, keep a safe buffer, then invest the surplus. Time-tested rules, applied to your life.",
  },
  {
    icon: Gauge,
    title: "Private by design",
    body: "Your data is yours. Scores and comparisons stay relative, so nothing sensitive is exposed.",
  },
];

const STEPS = [
  {
    icon: ScanLine,
    title: "Tell bynku your money",
    body: "Add your income, bills and goals, or upload a bank statement covering 3 to 6 months and let bynku work most of it out.",
  },
  {
    icon: Wallet,
    title: "See your safe to spend",
    body: "One honest number for today and for the whole cycle, with bills, debt and goals already set aside.",
  },
  {
    icon: Receipt,
    title: "Record as you go",
    body: "Snap a photo, forward a receipt, or type a line. bynku files it in seconds, in any language.",
  },
  {
    icon: TrendingUp,
    title: "Watch it compound",
    body: "Your score, trends and projects show real progress building cycle after cycle.",
  },
];

const FEATURES = [
  { icon: Wallet, title: "Daily safe to spend", body: "The one number that already reserves bills, debt and goals." },
  { icon: Gauge, title: "Financial health score", body: "Nine factors, tracked over time, so you can see the needle move." },
  { icon: PiggyBank, title: "Projects", body: "Emergency fund, goals and investing, funded a little each cycle." },
  { icon: CalendarClock, title: "Plans", body: "Schedule known future costs, like yearly car maintenance." },
  { icon: BarChart3, title: "Analysis and benchmarks", body: "See where your money goes and how you compare, privately." },
  { icon: FastForward, title: "Fast forward", body: "Project your future and test what-if decisions before you make them." },
];

// ---- Waiting-list dialog ----------------------------------------------------

function WaitlistDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const emailOk = isValidEmail(email);
  const canSubmit = emailOk && consent && state !== "sending";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState("sending");
    setError("");
    try {
      const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
      await joinWaitlist(email, locale);
      setState("done");
    } catch {
      setState("error");
      setError("Something went wrong. Please try again in a moment.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join the waiting list"
    >
      <div
        className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border bg-card p-6 shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {state === "done" ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              <h2 className="font-display text-xl text-foreground">You are on the list</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you. We will email you at <span className="font-medium text-foreground">{email}</span> the
              moment your spot opens. You can ask to be removed at any time.
            </p>
            <Button className="mt-5 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3">
            <h2 className="font-display text-xl">Join the waiting list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              bynku is getting ready for prime time. Leave your email and we will let you know when a spot
              opens.
            </p>

            <label htmlFor="wl-email" className="mt-4 block text-sm font-medium">
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-muted-foreground">
                I agree that bynku may store my email address to notify me when a spot opens. I can ask to
                be removed at any time. See the{" "}
                <a href="/privacy" className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
                  Privacy notice
                </a>
                .
              </span>
            </label>

            {state === "error" && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <Button type="submit" className="mt-5 w-full" disabled={!canSubmit}>
              {state === "sending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Adding you
                </>
              ) : (
                <>Notify me when bynku is ready</>
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Your email is stored securely with our hosting processor and is never sold or shared for
              marketing.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Cookie / data consent banner -------------------------------------------

const CONSENT_KEY = "bynku-consent";

function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      /* storage unavailable, stay hidden */
    }
  }, []);
  function choose(choice: "accepted" | "rejected") {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border bg-card p-4 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          bynku uses only the storage needed to run this site and to remember this choice. We do not use
          advertising or third-party tracking cookies. If you join the waiting list, your email and your
          IP address are sent to our hosting processor to operate the list. See our{" "}
          <a href="/privacy" className="text-primary underline underline-offset-2">
            Privacy notice
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => choose("rejected")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------

export function LandingPage() {
  useDeviceTheme();
  const [joinOpen, setJoinOpen] = useState(false);
  const openJoin = () => setJoinOpen(true);

  return (
    <JoinContext.Provider value={openJoin}>
      <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Logo />
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#why" className="hover:text-foreground">Why bynku</a>
              <a href="#how" className="hover:text-foreground">How it works</a>
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
            </nav>
            <CtaRow />
          </div>
        </header>

        <main>
          {/* Hero banner */}
          <section className="px-5 pt-8 md:pt-12">
            <div
              className="mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-12 text-white shadow-xl md:px-12 md:py-16"
              style={{ backgroundColor: DEEP }}
            >
              <div className="grid items-center gap-10 md:grid-cols-2">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs">
                    <Sparkles className="size-3.5" /> For households and small businesses
                  </span>
                  <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
                    Hire bynku. Stay in control of your money.
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
                    bynku is the financial brain your household or company hires to bring clarity to every
                    decision, from saving and buying to borrowing and planning. Know what is safe to spend
                    today, and simulate the big moves before you commit, whether that is changing jobs,
                    overpaying a loan, retiring, or taking on staff.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      onClick={openJoin}
                      className="bg-white hover:bg-white/90"
                      style={{ color: DEEP }}
                    >
                      Join the waiting list <ArrowRight className="size-4" />
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      <Link to="/auth">Log in</Link>
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-white/70">
                    bynku is getting ready for prime time. Join the list and we will email you the moment
                    your spot opens.
                  </p>
                </div>
                <Reveal className="flex min-w-0 justify-center md:justify-end">
                  <SnapshotShowcase />
                </Reveal>
              </div>
            </div>
          </section>

          {/* Why bynku */}
          <section id="why" className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <h2 className="max-w-2xl font-display text-3xl">
                A budgeting tool that is actually on your side.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Most money apps make money by pointing you at a product. bynku is committed to one thing
                only: improving each household's or company's financial position.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIFFERENCE.map((d, i) => (
                <Reveal key={d.title} delay={i * 60} className="rounded-2xl border bg-card p-5">
                  <d.icon className="size-6 text-primary" />
                  <h3 className="mt-3 font-medium">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>
                </Reveal>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how" className="border-t bg-muted/30">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <Reveal>
                <h2 className="font-display text-3xl">Set it up once, then just live.</h2>
              </Reveal>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((s, i) => (
                  <Reveal key={s.title} delay={i * 60} className="rounded-2xl border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                        {i + 1}
                      </span>
                      <s.icon className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="mt-3 font-medium">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Coach */}
          <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
            <Reveal>
              <h2 className="font-display text-3xl">Your own financial analyst.</h2>
              <p className="mt-3 text-muted-foreground">
                Ask anything. bynku answers from your actual position, not a generic script. It knows your
                income, your fixed costs, your debts and their rates, your buffer and your goals, and it
                explains its reasoning so you learn as you go.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Personal to your numbers, never generic",
                  "Explains the why behind every suggestion",
                  "Speaks your language, in five to start",
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-primary" /> {li}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted-foreground">
                bynku is an educational tool that helps you understand and organise your finances. It is
                not regulated financial advice.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <CoachMock />
            </Reveal>
          </section>

          {/* Unique creations */}
          <section id="features" className="border-t bg-muted/30">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <Reveal>
                <h2 className="font-display text-3xl">Things you will not find elsewhere.</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  bynku turns your history into forward motion. See your estimates meet reality, watch net
                  worth build, schedule what is coming, and get tips and comparisons that stay private.
                </p>
              </Reveal>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <Reveal><EstimatesMock /></Reveal>
                <Reveal delay={60}><NetWorthMock /></Reveal>
                <Reveal delay={40}><FastForwardMock /></Reveal>
                <Reveal delay={100}><PlansMock /></Reveal>
                <Reveal delay={80}><TipsMock /></Reveal>
                <Reveal delay={120}><CompareMock /></Reveal>
              </div>
            </div>
          </section>

          {/* Feature grid */}
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <h2 className="font-display text-3xl">Everything in one calm place.</h2>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 50} className="rounded-2xl border bg-card p-5">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-2 font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Two modes */}
          <section className="border-t bg-muted/30">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <Reveal>
                <h2 className="font-display text-3xl">One product, two modes.</h2>
              </Reveal>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <Reveal className="rounded-2xl border bg-card p-6">
                  <Users className="size-6 text-primary" />
                  <h3 className="mt-3 font-medium">Households</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Shared budgeting anchored to payday. Safe to spend, projects, plans and a coach that
                    keeps the whole family on the same page.
                  </p>
                </Reveal>
                <Reveal delay={60} className="rounded-2xl border bg-card p-6">
                  <Building2 className="size-6 text-primary" />
                  <h3 className="mt-3 font-medium">Small businesses</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fiscal-period cashflow, runway, margin and sector benchmarks. The same clarity, in the
                    language a company runs on.
                  </p>
                </Reveal>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
            <Reveal className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
              <h2 className="font-display text-3xl">Pricing</h2>
              <p className="mt-3 text-muted-foreground">
                bynku is free while we are in beta. A simple subscription will come later. No ads, and we
                will never sell your data.
              </p>
              <div className="mt-6">
                <CtaRow size="lg" center />
              </div>
            </Reveal>
          </section>

          {/* Final CTA */}
          <section className="border-t">
            <div className="mx-auto max-w-6xl px-5 py-16 text-center">
              <Reveal>
                <h2 className="font-display text-3xl md:text-4xl">Be first through the door.</h2>
                <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                  Join the waiting list and we will let you know the moment bynku is ready for you.
                </p>
                <div className="mt-6">
                  <CtaRow size="lg" center />
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
            <Logo />
            <div className="flex items-center gap-5">
              <a href="/privacy" className="hover:text-foreground">Privacy</a>
              <Link to="/auth" className="hover:text-foreground">Log in</Link>
            </div>
            <p className="text-xs">Educational tool, not regulated financial advice.</p>
          </div>
        </footer>

        <WaitlistDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
        <ConsentBanner />
      </div>
    </JoinContext.Provider>
  );
}
