import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/route-meta";
import { GuideSection, GuideShell } from "@/components/guide-layout";

const TITLE = "Family budgeting: a plan that survives a real month — bynku";
const DESCRIPTION =
  "How families budget around childcare, school costs and irregular bills: build a realistic baseline, smooth lumpy costs, and keep one shared safe-to-spend number.";

export const Route = createFileRoute("/guides/family-budgeting")({
  head: () => {
    const base = pageMeta({
      path: "/guides/family-budgeting",
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
            headline: "Family budgeting: a plan that survives a real month",
            description: DESCRIPTION,
            url: "https://bynku.app/guides/family-budgeting",
            inLanguage: "en",
            publisher: { "@type": "Organization", name: "bynku", url: "https://bynku.app" },
          }),
        },
      ],
    };
  },
  component: FamilyGuide,
});

function FamilyGuide() {
  return (
    <GuideShell
      eyebrow="Guide · 7 min read"
      title="Family budgeting"
      intro="Families don't break their budget on luxuries — they break it on the school trip, the dentist and the shoes that stopped fitting. This guide shows how to build a plan that already expects those things."
      current="/guides/family-budgeting"
    >
      <GuideSection title="The real problem: lumpy costs">
        <p>
          A family's spending isn't a smooth line. It's a flat baseline with spikes: back-to-school
          in September, insurance renewals, birthdays, a holiday, a medical bill. Budgets fail
          because they're built from a quiet month and then measured against a loud one.
        </p>
        <p>
          The goal is not to predict every spike. It's to make the spikes boring by pre-funding them
          from months where nothing happens.
        </p>
      </GuideSection>

      <GuideSection title="Step 1 — Build an honest baseline">
        <p>List every recurring cost, then convert everything to a monthly equivalent:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Housing &amp; utilities</strong> — rent or mortgage, energy, water, internet,
            council/municipal taxes.
          </li>
          <li>
            <strong>Children</strong> — childcare or nursery, school meals, transport, clubs,
            uniform, tutoring.
          </li>
          <li>
            <strong>Protection</strong> — health, home, life and car insurance.
          </li>
          <li>
            <strong>Debt</strong> — mortgage, car finance, personal loans, credit cards. Record the
            interest rate, not just the payment.
          </li>
          <li>
            <strong>Variable essentials</strong> — groceries, fuel, pharmacy. Use a three-month
            average, not your best month.
          </li>
        </ul>
        <p>
          Annual costs get divided by twelve and treated as monthly. A €600 insurance renewal is a
          €50 monthly cost that you happen to pay once a year.
        </p>
      </GuideSection>

      <GuideSection title="Step 2 — Create sinking funds for the spikes">
        <p>
          A sinking fund is a named pot you add to every month so a known future cost never feels
          like an emergency. Typical family set:
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Back to school      480 / year   =  40 / month
Car service + tyres 600 / year   =  50 / month
Birthdays + holidays 720 / year  =  60 / month
Dentist / health     360 / year  =  30 / month
                                  ---------------
                                   180 / month`}</pre>
        <p>
          That €180 is not spare money — it's a bill. Once these funds exist, September stops being a
          crisis month.
        </p>
      </GuideSection>

      <GuideSection title="Step 3 — Emergency fund before extras">
        <p>
          Aim for three months of fixed costs, then extend towards six if income is variable or a
          single earner carries the household. This fund is for loss of income, not for holidays —
          keep it in a separate, boring, instantly accessible account so it isn't accidentally spent.
        </p>
      </GuideSection>

      <GuideSection title="Step 4 — One safe-to-spend number for the whole family">
        <p>
          After baseline, sinking funds and savings goals, what's left is genuinely discretionary.
          Divide it by the days remaining until the next income and you get one number that any adult
          in the household can check before saying yes to a Saturday plan.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Income this cycle           3,900
Fixed costs                -2,150
Variable estimate            -820
Sinking funds + savings      -430
                            ------
Surplus                       500  ->  over 20 days = 25 / day`}</pre>
      </GuideSection>

      <GuideSection title="Step 5 — Bring the children in, at their level">
        <p>
          Children who see how money is decided grow into adults who budget. Younger children can
          own a small allowance with one saving goal. Teenagers can be shown the household variable
          categories — not the salaries — and be part of choosing between two options. The lesson is
          trade-offs, not scarcity.
        </p>
      </GuideSection>

      <GuideSection title="Step 6 — Review each cycle, adjust the estimate">
        <p>
          Compare what you actually spent to what you estimated, category by category. If groceries
          come in 15% over three cycles in a row, the estimate is wrong — not the family. Fix the
          number rather than repeatedly failing against a fantasy.
        </p>
      </GuideSection>

      <GuideSection title="How bynku handles this">
        <p>
          In bynku, a household is shared by every adult who needs it. Fixed costs and loans accept
          any cadence — weekly, monthly, annual — and are converted to a monthly equivalent
          automatically, so annual renewals stop ambushing you. Allocation buckets act as sinking
          funds and emergency fund, splitting the surplus by percentage. Spending is compared against
          your estimate and against benchmark spending shares for your country, and the payoff
          simulator shows what happens if you put a spare €100 against a loan instead.
        </p>
      </GuideSection>
    </GuideShell>
  );
}
