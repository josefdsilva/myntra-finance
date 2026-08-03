import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/route-meta";
import { GuideSection, GuideShell } from "@/components/guide-layout";

const TITLE = "Budgeting for couples: a fair, simple system that lasts — bynku";
const DESCRIPTION =
  "How couples can budget together without merging their whole lives: split bills fairly, keep personal spending money, and agree on one safe-to-spend number.";

export const Route = createFileRoute("/guides/budgeting-for-couples")({
  head: () => {
    const base = pageMeta({
      path: "/guides/budgeting-for-couples",
      title: TITLE,
      description: DESCRIPTION,
      ogType: "article",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Budgeting for couples: a fair, simple system that lasts",
            description: DESCRIPTION,
            url: "https://bynku.app/guides/budgeting-for-couples",
            inLanguage: "en",
            publisher: { "@type": "Organization", name: "bynku", url: "https://bynku.app" },
          }),
        },
      ],
    };
  },
  component: CouplesGuide,
});

function CouplesGuide() {
  return (
    <GuideShell
      eyebrow="Guide · 8 min read"
      title="Budgeting for couples"
      intro="Two people, two paydays, one set of bills. This guide walks through a system that stays fair when incomes are unequal, survives an expensive month, and doesn't require either of you to justify every coffee."
      current="/guides/budgeting-for-couples"
    >
      <GuideSection title="Why couples' budgets fail">
        <p>
          Most couples don't fail at budgeting because they overspend. They fail because they never
          agreed on <strong>who owns which cost</strong>, and because the plan lives in one person's
          head. Two common patterns:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>The silent accountant.</strong> One partner tracks everything and quietly
            resents it. The other has no idea whether spending €60 tonight is fine, so they either
            avoid asking or spend anyway.
          </li>
          <li>
            <strong>The 50/50 trap.</strong> Splitting every bill down the middle looks fair but
            isn't when one person earns €1,800 and the other €3,400 — the lower earner ends up with
            no discretionary money at all.
          </li>
        </ul>
        <p>
          The fix isn't more discipline. It's a shared structure where both people can see the same
          number without asking each other.
        </p>
      </GuideSection>

      <GuideSection title="Step 1 — Pick a money model">
        <p>There are three workable models. Pick one deliberately.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Fully joint.</strong> All income in, all costs out, no personal accounts.
            Simplest maths, requires the most trust and the most similar spending values.
          </li>
          <li>
            <strong>Yours, mine, ours (recommended for most).</strong> Both contribute to a shared
            pot that covers all joint costs and joint savings. Whatever remains stays personal — no
            explanation owed.
          </li>
          <li>
            <strong>Fully separate with a settle-up.</strong> Each pays certain bills and you square
            up monthly. Works for new relationships; gets fragile once there are children or a
            mortgage.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Step 2 — Split contributions by income, not by head">
        <p>
          If you use a shared pot, size each contribution as a percentage of income rather than a
          flat half. Add both net incomes, work out what share each person brings, and apply that
          share to the joint total.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Net income A: 1,800    Net income B: 3,400    Total: 5,200
A's share: 1,800 / 5,200 = 35%
B's share: 3,400 / 5,200 = 65%

Joint costs (rent, utilities, food, loans, joint savings): 2,600
A contributes: 910      B contributes: 1,690`}</pre>
        <p>
          Both people are left with the same <em>proportion</em> of their income as personal money,
          which is the practical definition of fair. Revisit the percentages whenever either income
          changes — a raise, parental leave, or a job change.
        </p>
      </GuideSection>

      <GuideSection title="Step 3 — Separate fixed, variable and shared goals">
        <p>Write the joint pot down in three layers, because they behave differently:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Fixed costs</strong> — rent or mortgage, utilities, insurance, subscriptions,
            loan repayments. Predictable, and the number you should always know by heart.
          </li>
          <li>
            <strong>Variable costs</strong> — groceries, transport, eating out, kids' extras.
            Estimate these from the last three months, not from optimism.
          </li>
          <li>
            <strong>Shared goals</strong> — emergency fund, holiday, deposit, car replacement. Treat
            these as bills paid to your future selves, not as leftovers.
          </li>
        </ul>
        <p>
          Fixed costs plus a realistic variable estimate is your <strong>baseline</strong>: the
          minimum the household needs each cycle. Income minus baseline is your surplus, and the
          surplus is the only money that's genuinely available to allocate.
        </p>
      </GuideSection>

      <GuideSection title="Step 4 — Convert the surplus into one safe-to-spend number">
        <p>
          A budget that only exists monthly is useless on a Tuesday. Turn the surplus into a daily
          figure across the days remaining until the next income arrives.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Surplus this cycle: 640
Days until next payday: 16
Safe to spend today: 640 / 16 = 40`}</pre>
        <p>
          Now the conversation changes. Instead of &ldquo;can we afford this?&rdquo;, both partners
          look at the same number and decide together. Overspend one day and the figure drops
          tomorrow — the system self-corrects without anyone policing anyone.
        </p>
      </GuideSection>

      <GuideSection title="Step 5 — Use buckets so saving isn't a single blob">
        <p>
          &ldquo;Savings&rdquo; as one number is demotivating and easy to raid. Split the surplus
          into named buckets with percentages — for example 40% emergency fund, 30% holiday, 20%
          home, 10% fun. Percentages scale automatically with a good or bad month, and naming a
          bucket makes it much harder for either partner to spend it on something else.
        </p>
        <p>
          Fill the emergency fund first: three months of fixed costs is the point at which a broken
          boiler stops becoming a fight.
        </p>
      </GuideSection>

      <GuideSection title="Step 6 — Hold a 15-minute money date">
        <p>
          Once per cycle, both of you look at the same screen and answer three questions: did we
          land above or below the estimate, what surprised us, and does anything change next cycle.
          Fifteen minutes, no blame, no spreadsheets recreated from memory. This single habit does
          more than any budgeting app feature.
        </p>
      </GuideSection>

      <GuideSection title="What debt does to the plan">
        <p>
          If you carry consumer debt, decide the order before emotions get involved.{" "}
          <strong>Avalanche</strong> pays the highest interest rate first and costs the least money.{" "}
          <strong>Snowball</strong> pays the smallest balance first and gives faster visible wins,
          which matters if motivation is the binding constraint. Either is far better than paying
          minimums on everything — just pick one together and keep it.
        </p>
      </GuideSection>

      <GuideSection title="How bynku handles this">
        <p>
          bynku was built for exactly this shape of problem. A household is shared between both
          partners, so there is one plan and no silent accountant. Fixed costs, loans and variable
          estimates produce a baseline; the leftover surplus becomes a daily safe-to-spend figure
          that both people see. Allocation buckets split that surplus by percentage, the payoff
          simulator compares avalanche against snowball on your actual loans, and expenses can be
          captured from a photo of a receipt or a voice note so tracking doesn't fall on one person.
        </p>
      </GuideSection>
    </GuideShell>
  );
}
