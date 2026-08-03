import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/route-meta";
import { GuideSection, GuideShell } from "@/components/guide-layout";

const TITLE = "Small business cash flow for freelancers & SMEs — bynku";
const DESCRIPTION =
  "How small businesses and freelancers separate owner pay from company money, plan for tax and VAT, and know what's genuinely safe to spend each month.";

export const Route = createFileRoute("/guides/small-business-cash-flow")({
  head: () => {
    const base = pageMeta({
      path: "/guides/small-business-cash-flow",
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
            headline: "Small business cash flow for freelancers and SMEs",
            description: DESCRIPTION,
            url: "https://bynku.app/guides/small-business-cash-flow",
            inLanguage: "en",
            publisher: { "@type": "Organization", name: "bynku", url: "https://bynku.app" },
          }),
        },
      ],
    };
  },
  component: SmeGuide,
});

function SmeGuide() {
  return (
    <GuideShell
      eyebrow="Guide · 7 min read"
      title="Small business cash flow"
      intro="Profitable businesses still run out of money. For freelancers and small teams the risk isn't margin — it's timing: invoices land late, tax lands on schedule, and the owner's household depends on both."
      current="/guides/small-business-cash-flow"
    >
      <GuideSection title="Profit is an opinion, cash is a fact">
        <p>
          An invoice raised in March may not be paid until May, but rent, salaries and software are
          due in April. Cash flow is the schedule of money actually moving. Almost every small
          business failure that surprises its owner is a timing failure, not a profitability one.
        </p>
      </GuideSection>

      <GuideSection title="Step 1 — Separate business and personal completely">
        <p>
          One business account, one personal account, and a deliberate transfer between them called{" "}
          <strong>owner pay</strong>. Not &ldquo;whatever is left&rdquo; — a fixed, boring amount that
          your household budget can rely on. Mixing the two makes it impossible to tell whether the
          business or the household is the thing under strain.
        </p>
      </GuideSection>

      <GuideSection title="Step 2 — Reserve tax and VAT the day money arrives">
        <p>
          The most common cash-flow shock is a tax bill spent months earlier. Treat tax as money that
          was never yours: the moment a payment lands, move the reserve out of the operating balance.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Invoice paid                     6,000
VAT collected (held for the state) -1,150
Income-tax / corporate reserve     -900
Social security reserve            -650
                                  ------
Usable operating cash              3,300`}</pre>
        <p>
          Percentages depend on your country and structure — ask your accountant once, then automate
          the split. Under-reserving is far more expensive than over-reserving.
        </p>
      </GuideSection>

      <GuideSection title="Step 3 — Know your fixed monthly burn">
        <p>
          List every cost that arrives whether or not you sell anything: rent or coworking, salaries
          and contractors, software, accountancy, insurance, loan repayments, phone and internet.
          That total is your <strong>burn</strong>. Divided into your reserves it tells you your{" "}
          <strong>runway</strong> — the number of months you can survive with zero new revenue.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-foreground">{`Fixed burn: 4,200 / month
Cash reserve: 12,600
Runway: 12,600 / 4,200 = 3 months`}</pre>
        <p>Three months is a floor for a solo business; six is where decisions stop being panicked.</p>
      </GuideSection>

      <GuideSection title="Step 4 — Manage the invoice gap">
        <p>Late payment is the single biggest lever a small business controls:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Invoice on delivery, not at month end — every day of delay is your money financing theirs.</li>
          <li>Shorten terms to 14 days for new clients; ask for a deposit on larger projects.</li>
          <li>Chase on day one past due, politely and automatically. Silence reads as flexibility.</li>
          <li>Track a concentration limit: no client should represent more than about 30% of revenue.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Step 5 — Smooth irregular income into steady owner pay">
        <p>
          Take twelve months of revenue, subtract reserves and burn, and set owner pay at a level a
          weak month can still support. Good months build a buffer inside the business; the buffer
          pays you in bad months. Your household then sees a predictable income even though the
          business does not.
        </p>
      </GuideSection>

      <GuideSection title="Step 6 — Watch four numbers, not forty">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Operating cash</strong> — balance after tax and VAT reserves are removed.
          </li>
          <li>
            <strong>Fixed burn</strong> — committed monthly outflow.
          </li>
          <li>
            <strong>Runway</strong> — months of survival at zero revenue.
          </li>
          <li>
            <strong>Overdue receivables</strong> — invoiced work not yet paid.
          </li>
        </ul>
        <p>
          If those four are healthy, most other problems are manageable. If runway is short,
          everything else is noise.
        </p>
      </GuideSection>

      <GuideSection title="How bynku handles this">
        <p>
          bynku supports business spaces alongside household ones, so a freelancer or small team can
          keep company money separate from personal money while using the same tool. Fixed costs and
          loans build the burn figure, income and invoices show what has actually landed versus what
          is expected, and the surplus becomes a safe-to-spend number with reserve buckets for tax and
          VAT. Business benchmarks and cycle reports show whether this month was genuinely better or
          just better timed.
        </p>
      </GuideSection>
    </GuideShell>
  );
}
