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
} from "lucide-react";
import { Button } from "@/components/ui/button";

// The public marketing page shown at "/" to visitors who are not signed in.
// English-first by design; localised once the copy settles. Faithful in-app
// mockups stand in for real screenshots until those are supplied.

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

function CtaRow({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size={size}>
        <Link to="/auth" search={{ mode: "signup" }}>
          Get started free <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size={size}>
        <Link to="/auth">Log in</Link>
      </Button>
    </div>
  );
}

// ---- Faithful, theme-matched mockups (placeholders for real screenshots) ----

function SafeToSpendMock() {
  const pts = [22, 20, 24, 30, 26, 34, 28];
  const w = 260;
  const h = 44;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Safe to spend, next 7 days
      </p>
      <p className="mt-1 font-display text-5xl text-primary tabular-nums">€805.70</p>
      <div className="mt-3 inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
        <span className="rounded-md px-2.5 py-1 text-muted-foreground">Today</span>
        <span className="rounded-md bg-background px-2.5 py-1 font-medium text-foreground shadow-sm">
          Next 7 days
        </span>
        <span className="rounded-md px-2.5 py-1 text-muted-foreground">Rest of cycle</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full text-primary">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Available this cycle</span>
        <span className="font-semibold tabular-nums">€1,156.19</span>
      </div>
    </div>
  );
}

function ScoreRingMock() {
  const value = 74;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="relative size-32">
        <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={`${(value / 100) * c} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">of 100</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {["Emergency ready", "Debt slayer", "Investing"].map((b) => (
          <span
            key={b}
            className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendMock() {
  const pts = [48, 52, 51, 58, 62, 66, 71, 74];
  const w = 240;
  const h = 90;
  const max = 100;
  const min = 40;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Score over time</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl tabular-nums">74</span>
        <span className="inline-flex items-center gap-0.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-4" /> +3 vs last cycle
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full text-primary">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={3.5} className="fill-primary" />
      </svg>
    </div>
  );
}

function CoachMock() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        I have about €350 spare this cycle. What should I do with it?
      </div>
      <div className="self-start max-w-[88%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">
        Your emergency fund is at 2.4 months, short of your 3 month target. I would top it up first
        (about €260), then send the rest to your car loan, which is your most expensive debt at 9.1%.
      </div>
    </div>
  );
}

// ---- Sections ---------------------------------------------------------------

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

// ---- Page -------------------------------------------------------------------

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> For households and small businesses
            </span>
            <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
              Always know what is safe to spend.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              bynku turns your income, bills, debt and goals into one honest number, then helps you
              turn what is left into real progress. No products to sell you. No ads. Just your money,
              working for you.
            </p>
            <div className="mt-6">
              <CtaRow size="lg" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Free while in beta. No card required.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <SafeToSpendMock />
          </div>
        </section>

        <section id="why" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="max-w-2xl font-display text-3xl">
              A budgeting tool that is actually on your side.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Most money apps make money by pointing you at a product. bynku is committed to one
              thing only: improving each household's or company's financial position.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIFFERENCE.map((d) => (
                <div key={d.title} className="rounded-2xl border bg-card p-5">
                  <d.icon className="size-6 text-primary" />
                  <h3 className="mt-3 font-medium">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl">Set it up once, then just live.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl">Your own financial analyst.</h2>
              <p className="mt-3 text-muted-foreground">
                Ask anything. bynku answers from your actual position, not a generic script. It knows
                your income, your fixed costs, your debts and their rates, your buffer and your goals,
                and it explains its reasoning so you learn as you go.
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
                bynku is an educational tool that helps you understand and organise your finances. It
                is not regulated financial advice.
              </p>
            </div>
            <CoachMock />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl">Everything in one calm place.</h2>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ScoreRingMock />
            </div>
            <div className="lg:col-span-1">
              <TrendMock />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
              {FEATURES.slice(0, 2).map((f) => (
                <div key={f.title} className="rounded-2xl border bg-card p-5">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-2 font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.slice(2).map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-5">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-2 font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl">One product, two modes.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6">
                <Users className="size-6 text-primary" />
                <h3 className="mt-3 font-medium">Households</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared budgeting anchored to payday. Safe to spend, projects, plans and a coach that
                  keeps the whole family on the same page.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <Building2 className="size-6 text-primary" />
                <h3 className="mt-3 font-medium">Small businesses</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fiscal-period cashflow, runway, margin and sector benchmarks. The same clarity, in
                  the language a company runs on.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
            <h2 className="font-display text-3xl">Pricing</h2>
            <p className="mt-3 text-muted-foreground">
              bynku is free while we are in beta. A simple subscription will come later. No ads, and we
              will never sell your data.
            </p>
            <div className="mt-6 flex justify-center">
              <CtaRow size="lg" />
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center">
            <h2 className="font-display text-3xl md:text-4xl">Take control of your money today.</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              A few minutes to set up. A clearer financial life from your very first cycle.
            </p>
            <div className="mt-6 flex justify-center">
              <CtaRow size="lg" />
            </div>
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
    </div>
  );
}
