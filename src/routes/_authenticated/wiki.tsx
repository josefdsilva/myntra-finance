import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Calendar,
  Wallet,
  Receipt,
  PiggyBank,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
  Eye,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/wiki")({
  head: () => ({
    meta: [
      { title: "Wiki — Household Budget" },
      {
        name: "description",
        content:
          "Complete guide to the Household Budget app: pay cycles, safe-to-spend, allocations, analytics, notifications and more.",
      },
    ],
  }),
  component: WikiPage,
});

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="size-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      {children}
    </code>
  );
}

function WikiPage() {
  const toc = [
    { id: "overview", label: "Overview" },
    { id: "cycles", label: "Pay cycles" },
    { id: "baseline", label: "Baseline & safe-to-spend" },
    { id: "expenses", label: "Expenses & capture" },
    { id: "allocations", label: "Allocations & buckets" },
    { id: "analysis", label: "Analysis" },
    { id: "settings", label: "Settings" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Hidden mode & dark mode" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" />
            Wiki
          </div>
          <h1 className="font-display text-3xl md:text-4xl">How this app works</h1>
          <p className="text-muted-foreground">
            A complete guide to every screen, field and formula. Skim the table
            of contents or jump straight to the section you need.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Table of contents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 sm:grid-cols-2 text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="text-primary hover:underline"
                  >
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Section id="overview" icon={BookOpen} title="Overview">
          <p>
            Household Budget helps a couple (or small family) plan and manage
            monthly money together. Instead of tracking every cent against a
            calendar month, the app works in <Term>pay cycles</Term> — the
            window between two consecutive salary deposits — and answers one
            core question every day:
          </p>
          <p className="rounded-lg border bg-muted/40 p-3 text-foreground">
            <strong>“How much can I still spend today without breaking the
            baseline or putting a savings goal in jeopardy?”</strong>
          </p>
          <p>
            To do that it needs three things from you: your fixed monthly
            costs, your estimated variable costs (groceries, fuel…), and your
            allocation buckets (investments, savings, kids, projects). From
            there it computes a safe-to-spend value, tracks your actual
            expenses, and shows analytics.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">Shared household</Badge>
            <Badge variant="secondary">EUR</Badge>
            <Badge variant="secondary">DD/MM/YYYY HH:mm:ss</Badge>
            <Badge variant="secondary">Invite-only</Badge>
          </div>
        </Section>

        <Section id="cycles" icon={Calendar} title="Pay cycles">
          <p>
            A <Term>cycle</Term> starts the day the primary salary is received
            and ends the day before the next one. All budgets, safe-to-spend
            and allocations are computed against the current cycle — not the
            calendar month.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              The cycle anchor is the most recent record marked as a{" "}
              <Term>salary deposit</Term>.
            </li>
            <li>
              Use the <strong>Salary received · restart cycle</strong> button
              on the Dashboard when you get paid. It creates the salary record
              using the amount from Settings and starts a new cycle.
            </li>
            <li>
              If no salary has ever been registered, the app falls back to the
              current calendar month.
            </li>
            <li>
              On Expenses and Allocations you can navigate to previous cycles
              with the arrows.
            </li>
          </ul>
        </Section>

        <Section id="baseline" icon={Wallet} title="Baseline & safe-to-spend">
          <p>
            The <Term>baseline</Term> is your target monthly cost of living.
            It is a calculated value, not a number you type:
          </p>
          <pre className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto">
{`baseline = fixed_monthly_expenses
         + estimated_variable_costs
         + safety_margin (% of the two above)`}
          </pre>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>Fixed monthly expenses</Term> — rent, utilities,
              subscriptions, insurance. Things that hit every month at (roughly)
              the same amount.
            </li>
            <li>
              <Term>Estimated variable costs</Term> — categories you spend on
              regularly but with varying amounts: groceries, fuel,
              transportation, household goods…
            </li>
            <li>
              <Term>Safety margin</Term> — a percentage buffer on top, to
              absorb small surprises without alarms firing.
            </li>
          </ul>
          <p className="pt-2 font-medium text-foreground">Safe to spend today</p>
          <pre className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto">
{`variable_pool = baseline - fixed_expenses_in_cycle
remaining     = variable_pool - variable_spent_in_cycle + refunds_received
safe_today    = remaining / days_left_in_cycle`}
          </pre>
          <p>
            The Dashboard shows this as a large number with three tags:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent">Spent</Badge>{" "}
              variable expenses recorded this cycle.
            </li>
            <li>
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent">Received</Badge>{" "}
              money received during the cycle (refunds, reimbursements — not
              salary).
            </li>
            <li>
              <Badge variant="secondary">Balance</Badge> spent minus received:
              the net drain on the variable pool.
            </li>
          </ul>
          <p>
            The trend indicator (↑/↓) compares today's safe-to-spend against
            yesterday's. The <strong>Projected end of cycle</strong> card
            extrapolates using your last 7 days of spending — green if you'll
            finish under baseline, red if you'll blow through it.
          </p>
        </Section>

        <Section id="expenses" icon={Receipt} title="Expenses & capture">
          <p>
            Expenses are anything that is <em>not</em> a fixed monthly bill or
            the salary. Only these entries move the safe-to-spend needle.
            There are several ways to add them:
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="quick">
              <AccordionTrigger>Quick add (form)</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Type amount, category, note and date. Fastest for a single
                purchase you remember.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ai">
              <AccordionTrigger>AI text or voice memo</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Paste (or dictate) something like <em>“45 euros groceries at
                Continente yesterday”</em>. The AI extracts amount, category,
                merchant and date. Review and confirm before saving.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="photo">
              <AccordionTrigger>Photo of a receipt or bill</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Upload the image; the AI reads the total, merchant and date
                and pre-fills the form.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="stmt">
              <AccordionTrigger>Bank statement import</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Paste a statement export. Rows are parsed into candidate
                expenses. A duplicate check runs against the ±2-day window
                already in your log — likely duplicates are highlighted in
                amber and pre-unchecked. Use <em>Select all</em>,{" "}
                <em>Reset dupes</em> and <em>None</em> to move quickly.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="fields">
              <AccordionTrigger>What each field means</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <div><Term>Amount</Term> in EUR. Positive for outgoing money.</div>
                <div><Term>Type</Term> <em>expense</em> reduces the pool, <em>received</em> refunds it (not salary).</div>
                <div><Term>Category</Term> drives the Analysis pie chart and matches variable-estimate categories.</div>
                <div><Term>Date</Term> when the money actually moved — this determines which cycle it belongs to.</div>
                <div><Term>Note</Term> free text (merchant, purpose). Useful in the Analysis tooltips.</div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section id="allocations" icon={PiggyBank} title="Allocations & buckets">
          <p>
            A <Term>bucket</Term> represents a place your income should flow
            to every cycle: long-term investments, savings account, kids'
            savings, a house-project fund, etc. Each bucket has a target that
            determines how much the app <em>recommends</em> you move.
          </p>
          <p className="font-medium text-foreground">Target types</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>% of income</Term> — a share of the salary, e.g. 15% to
              investments.
            </li>
            <li>
              <Term>Fixed € per month</Term> — a flat monthly contribution.
            </li>
            <li>
              <Term>Goal € by date</Term> — you want <em>X €</em> in this
              bucket by a specific date. The app computes the monthly
              contribution needed from today, and re-computes every cycle
              based on what was actually allocated.
            </li>
          </ul>
          <p className="font-medium text-foreground pt-2">Mark as allocated</p>
          <p>
            When you move money into an account for a bucket, click{" "}
            <strong>Mark as allocated</strong> and enter the actual amount
            transferred. The impact panel shows:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Delta versus the recommendation for the cycle.</li>
            <li>
              Effect on the <Term>emergency pool</Term> (surplus / shortfall
              versus recommended totals).
            </li>
            <li>
              For goal buckets: updated progress percentage and the revised
              monthly rate needed to still hit the deadline.
            </li>
          </ul>
          <p>
            Allocating more than recommended pulls from the emergency pool;
            allocating less leaves surplus in it. Nothing forces you to hit
            the exact number — the app just keeps the math honest.
          </p>
        </Section>

        <Section id="analysis" icon={BarChart3} title="Analysis">
          <p>Two views help you understand where the money went and where it's heading.</p>
          <p className="font-medium text-foreground">Cycle burndown</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              The line starts at <strong>−fixed_total</strong> on day 1 —
              fixed costs are already reserved even before you spend anything
              variable.
            </li>
            <li>
              It drops with each expense and rises with each received entry
              and the salary event.
            </li>
            <li>
              Dashed reference lines show the funding thresholds (baseline
              and, when relevant, allocation requirements).
            </li>
            <li>
              Hover any point to see the exact transactions that moved the
              balance that day.
            </li>
          </ul>
          <p className="font-medium text-foreground pt-2">Category distribution</p>
          <p>
            A pie chart of variable spending in the selected window (day /
            week / month). Use it to spot categories drifting above their
            variable-estimate share.
          </p>
        </Section>

        <Section id="settings" icon={SettingsIcon} title="Settings">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>Household</Term> — name, primary salary amount and expected
              payday cadence. The salary amount is what the{" "}
              <em>Salary received</em> button will record.
            </li>
            <li>
              <Term>Members</Term> — invite your partner by email. Both members
              share the same data; there is no per-member wallet.
            </li>
            <li>
              <Term>Fixed monthly expenses</Term> — one row per recurring bill.
            </li>
            <li>
              <Term>Variable cost estimates</Term> — expected monthly spend per
              category. Sum feeds the baseline.
            </li>
            <li>
              <Term>Safety margin (%)</Term> — buffer applied on top of fixed
              + variable estimates.
            </li>
            <li>
              <Term>Allocation buckets</Term> — create/edit buckets, targets,
              and goal deadlines.
            </li>
            <li>
              <Term>Notifications</Term> — enable web push per device and
              toggle each alert individually.
            </li>
          </ul>
        </Section>

        <Section id="notifications" icon={Bell} title="Notifications">
          <p>
            All notifications are opt-in, per device and per type. Enable a
            device first (Settings → Notifications → Enable on this device),
            then toggle the ones you want.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Monday morning digest</strong> (08:00 Europe/Lisbon) — a
              summary of the previous week: total spent and received (excluding
              fixed costs and salary), top-3 expenses and received items, a
              comparison to the previous week, an AI commentary on pace, and
              how much room you still have in the baseline and emergency pool.
            </li>
            <li>
              <strong>Baseline approaching / reached</strong> — sent when the
              remaining variable pool crosses warning and breach thresholds.
            </li>
            <li>
              <strong>Emergency pool near depletion</strong> — sent when
              consumption of the surplus reaches a critical level.
            </li>
          </ul>
          <p>
            iOS Safari requires the app to be installed to the home screen
            before push works. Desktop Chrome / Firefox / Edge and Android
            work directly.
          </p>
        </Section>

        <Section id="privacy" icon={Eye} title="Hidden mode & dark mode">
          <p>
            <Term>Hidden mode</Term> (eye icon) blurs every monetary value in
            the app so you can open it in public without exposing balances.
            The toggle is remembered across sessions in this browser.
          </p>
          <p>
            <Term>Dark mode</Term> (sun/moon icon) follows your OS preference
            by default and remembers your explicit choice across sessions.
          </p>
          <p className="flex items-center gap-2 pt-1">
            <ShieldCheck className="size-4 text-primary" />
            <span>
              Access is restricted to allow-listed emails. Sign-ups are
              disabled; new members join by invitation only.
            </span>
          </p>
        </Section>

        <Section id="faq" icon={Sparkles} title="FAQ">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="why-cycles">
              <AccordionTrigger>Why cycles instead of months?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Salaries rarely land on the 1st. A cycle aligned to payday
                gives a truthful “how much do I have left before the next
                paycheck” answer.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="salary-in-list">
              <AccordionTrigger>Should I delete the salary entry from Recent expenses?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. That record is the anchor for the current cycle. Deleting
                it will make the app fall back to calendar-month mode until
                the next payday.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="under-allocated">
              <AccordionTrigger>What happens if I allocate less than recommended?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The shortfall stays in the emergency pool for the cycle. Goal
                buckets recompute the monthly rate needed to still hit the
                deadline.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="over-baseline">
              <AccordionTrigger>What if we go over baseline?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Safe-to-spend goes negative and the projected-end card turns
                red. The overrun is first absorbed by the safety margin, then
                by the emergency pool, then by cutting allocations.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ai-accuracy">
              <AccordionTrigger>Is the AI parsing always right?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No — always review the pre-filled form before saving. It's a
                head start, not an autopilot.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>
      </div>
    </AppShell>
  );
}
