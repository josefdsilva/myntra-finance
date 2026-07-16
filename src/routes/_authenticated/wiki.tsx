import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Calculator,
  Settings as SettingsIcon,
  Bell,
  Eye,
  Sparkles,
  ShieldCheck,
  Search,
} from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { WIKI_STRINGS } from "@/lib/wiki-content";
import { pageShellClass } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/wiki")({
  head: () => ({
    meta: [
      { title: "Wiki · bynku" },
      {
        name: "description",
        content:
          "Complete guide to the bynku app: pay cycles, safe-to-spend, allocations, analytics, notifications and more.",
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
    <Card id={id} data-wiki-section={id} className="scroll-mt-20">
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
  const locale = useLocale();
  const w = (key: string) => WIKI_STRINGS[locale]?.[key] ?? WIKI_STRINGS.en[key] ?? key;

  const [query, setQuery] = useState("");
  const [noResults, setNoResults] = useState(false);

  // Per-section search index from the current locale's strings. Keys are
  // namespaced by section (overview.*, cycles.*, ...) and toc.<id> supplies the
  // title, so grouping by key prefix yields searchable text for each section.
  const searchIndex = useMemo(() => {
    const dict = WIKI_STRINGS[locale] ?? WIKI_STRINGS.en;
    const idx: Record<string, string> = {};
    for (const [key, val] of Object.entries(dict)) {
      const parts = key.split(".");
      const bucket = parts[0] === "toc" ? parts[1] : parts[0];
      if (!bucket) continue;
      idx[bucket] = (idx[bucket] ? idx[bucket] + " " : "") + String(val).toLowerCase();
    }
    return idx;
  }, [locale]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    let anyVisible = false;
    document.querySelectorAll<HTMLElement>("[data-wiki-section]").forEach((el) => {
      const id = el.dataset.wikiSection ?? "";
      const match = !q || (searchIndex[id]?.includes(q) ?? false);
      el.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    document.querySelectorAll<HTMLElement>("[data-wiki-toc]").forEach((el) => {
      const id = el.dataset.wikiToc ?? "";
      el.style.display = !q || (searchIndex[id]?.includes(q) ?? false) ? "" : "none";
    });
    setNoResults(q.length > 0 && !anyVisible);
  }, [query, searchIndex]);

  const toc = [
    { id: "overview", label: w("toc.overview") },
    { id: "cycles", label: w("toc.cycles") },
    { id: "baseline", label: w("toc.baseline") },
    { id: "expenses", label: w("toc.expenses") },
    { id: "allocations", label: w("toc.allocations") },
    { id: "glossary", label: w("toc.glossary") },
    { id: "principles", label: w("toc.principles") },
    { id: "analysis", label: w("toc.analysis") },
    { id: "settings", label: w("toc.settings") },
    { id: "notifications", label: w("toc.notifications") },
    { id: "privacy", label: w("toc.privacy") },
    { id: "credits", label: w("toc.credits") },
    { id: "faq", label: w("toc.faq") },
  ];

  const glossary: Array<{ id: string; formula: string }> = [
    { id: "income", formula: "Income = Σ Settings incomes" },
    { id: "fixed", formula: "Fixed Costs = Σ Settings fixed expenses" },
    { id: "debt", formula: "Debt Payments = Σ Settings debts (monthly)" },
    { id: "variable", formula: "Variable Estimate = Σ Settings variable estimates" },
    { id: "margin", formula: "Margin = margin% × (Fixed + Debt + Variable)" },
    { id: "baseline", formula: "Baseline = Fixed + Debt + Variable + Margin" },
    { id: "surplus", formula: "Surplus = Income − Baseline" },
    { id: "plannedAlloc", formula: "Planned Allocations = Σ per-project monthly target" },
    { id: "plannedSurplus", formula: "Planned Surplus = Surplus − Planned Allocations" },
    { id: "realAlloc", formula: "Real Allocations = confirmed allocations + movements in − out" },
    { id: "realSurplus", formula: "Real Surplus = Surplus − Real Allocations" },
    { id: "received", formula: "Received = Σ money-in operations (this cycle)" },
    { id: "realExpenses", formula: "Real Expenses = Σ money-out operations (this cycle)" },
    { id: "projectType", formula: "Project type ∈ Savings | Emergency | Investment" },
    { id: "emergencyFund", formula: "Coverage (months) = liquid reserve ÷ monthly essentials" },
    { id: "moneyPriority", formula: "Priority: emergency fund → high-interest debt → invest" },
  ];

  return (
    <>
      <div className={pageShellClass("4xl")}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" />
            {w("header.eyebrow")}
          </div>
          <h1 className="font-display text-3xl md:text-4xl">{w("header.title")}</h1>
          <p className="text-muted-foreground">{w("header.subtitle")}</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={w("search.placeholder")}
            aria-label={w("search.placeholder")}
            className="pl-9"
          />
        </div>

        {noResults && (
          <p className="text-sm text-muted-foreground">
            {w("search.noResults")} “{query.trim()}”.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{w("header.tocTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 sm:grid-cols-2 text-sm">
              {toc.map((t) => (
                <li key={t.id} data-wiki-toc={t.id}>
                  <a href={`#${t.id}`} className="text-primary hover:underline">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Section id="overview" icon={BookOpen} title={w("toc.overview")}>
          <p>
            {w("overview.p1a")}
            <Term>{w("overview.term1")}</Term>
            {w("overview.p1b")}
          </p>
          <p className="rounded-lg border bg-muted/40 p-3 text-foreground">
            <strong>{w("overview.callout")}</strong>
          </p>
          <p>{w("overview.p2")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{w("overview.badge1")}</Badge>
            <Badge variant="secondary">{w("overview.badge2")}</Badge>
            <Badge variant="secondary">{w("overview.badge3")}</Badge>
            <Badge variant="secondary">{w("overview.badge4")}</Badge>
          </div>
        </Section>

        <Section id="cycles" icon={Calendar} title={w("toc.cycles")}>
          <p>
            {w("cycles.p1a")}
            <Term>{w("cycles.term1")}</Term>
            {w("cycles.p1b")}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {w("cycles.li1a")}
              <Term>{w("cycles.li1term")}</Term>
              {w("cycles.li1b")}
            </li>
            <li>
              {w("cycles.li2a")}
              <strong>{w("cycles.li2strong")}</strong>
              {w("cycles.li2b")}
            </li>
            <li>{w("cycles.li3")}</li>
            <li>{w("cycles.li4")}</li>
          </ul>
        </Section>

        <Section id="baseline" icon={Wallet} title={w("toc.baseline")}>
          <p>
            {w("baseline.p1a")}
            <Term>{w("baseline.term1")}</Term>
            {w("baseline.p1b")}
          </p>
          <pre className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto">
            {`baseline = fixed_monthly_expenses
         + estimated_variable_costs
         + safety_margin (% of the two above)`}
          </pre>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>{w("baseline.li1term")}</Term>
              {w("baseline.li1")}
            </li>
            <li>
              <Term>{w("baseline.li2term")}</Term>
              {w("baseline.li2")}
            </li>
            <li>
              <Term>{w("baseline.li3term")}</Term>
              {w("baseline.li3")}
            </li>
          </ul>
          <p className="pt-2 font-medium text-foreground">{w("baseline.safeTodayHeading")}</p>
          <pre className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto">
            {`variable_pool = baseline - fixed_expenses_in_cycle
remaining     = variable_pool - variable_spent_in_cycle + refunds_received
safe_today    = remaining / days_left_in_cycle`}
          </pre>
          <p>{w("baseline.p3")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent">
                {w("baseline.badgeSpent")}
              </Badge>{" "}
              {w("baseline.li4After")}
            </li>
            <li>
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent">
                {w("baseline.badgeReceived")}
              </Badge>{" "}
              {w("baseline.li5After")}
            </li>
            <li>
              <Badge variant="secondary">{w("baseline.badgeBalance")}</Badge>{" "}
              {w("baseline.li6After")}
            </li>
          </ul>
          <p>
            {w("baseline.p4a")}
            <strong>{w("baseline.p4strong")}</strong>
            {w("baseline.p4b")}
          </p>
        </Section>

        <Section id="expenses" icon={Receipt} title={w("toc.expenses")}>
          <p>
            {w("expenses.p1a")}
            <em>{w("expenses.p1em")}</em>
            {w("expenses.p1b")}
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="quick">
              <AccordionTrigger>{w("expenses.acc1Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("expenses.acc1Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ai">
              <AccordionTrigger>{w("expenses.acc2Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("expenses.acc2BodyA")}
                <em>{w("expenses.acc2BodyEm")}</em>
                {w("expenses.acc2BodyB")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="photo">
              <AccordionTrigger>{w("expenses.acc3Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("expenses.acc3Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="stmt">
              <AccordionTrigger>{w("expenses.acc4Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("expenses.acc4BodyA")}
                <em>{w("expenses.acc4Em1")}</em>
                {w("expenses.acc4Mid")}
                <em>{w("expenses.acc4Em2")}</em>
                {w("expenses.acc4Mid2")}
                <em>{w("expenses.acc4Em3")}</em>
                {w("expenses.acc4End")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="fields">
              <AccordionTrigger>{w("expenses.acc5Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <div>
                  <Term>{w("expenses.fieldAmountTerm")}</Term>
                  {w("expenses.fieldAmount")}
                </div>
                <div>
                  <Term>{w("expenses.fieldTypeTerm")}</Term> <em>{w("expenses.fieldTypeEm1")}</em>
                  {w("expenses.fieldTypeMid")}
                  <em>{w("expenses.fieldTypeEm2")}</em>
                  {w("expenses.fieldTypeEnd")}
                </div>
                <div>
                  <Term>{w("expenses.fieldCategoryTerm")}</Term>
                  {w("expenses.fieldCategory")}
                </div>
                <div>
                  <Term>{w("expenses.fieldDateTerm")}</Term>
                  {w("expenses.fieldDate")}
                </div>
                <div>
                  <Term>{w("expenses.fieldNoteTerm")}</Term>
                  {w("expenses.fieldNote")}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section id="allocations" icon={PiggyBank} title={w("toc.allocations")}>
          <p>
            {w("allocations.p1a")}
            <Term>{w("allocations.term1")}</Term>
            {w("allocations.p1b")}
            <em>{w("allocations.p1em")}</em>
            {w("allocations.p1c")}
          </p>
          <p className="font-medium text-foreground">{w("allocations.targetTypesHeading")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>{w("allocations.tt1term")}</Term>
              {w("allocations.tt1")}
            </li>
            <li>
              <Term>{w("allocations.tt2term")}</Term>
              {w("allocations.tt2")}
            </li>
            <li>
              <Term>{w("allocations.tt3term")}</Term>
              {w("allocations.tt3a")}
              <em>{w("allocations.tt3em")}</em>
              {w("allocations.tt3b")}
            </li>
          </ul>
          <p className="font-medium text-foreground pt-2">{w("allocations.markHeading")}</p>
          <p>
            {w("allocations.markP1a")}
            <strong>{w("allocations.markStrong")}</strong>
            {w("allocations.markP1b")}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{w("allocations.li1")}</li>
            <li>
              {w("allocations.li2a")}
              <Term>{w("allocations.li2term")}</Term>
              {w("allocations.li2b")}
            </li>
            <li>{w("allocations.li3")}</li>
          </ul>
          <p>{w("allocations.p2")}</p>
        </Section>

        <Section id="glossary" icon={Calculator} title={w("toc.glossary")}>
          <p>{w("glossary.intro")}</p>
          <div className="space-y-3">
            {glossary.map((g) => (
              <div key={g.id}>
                <p>
                  <strong className="text-foreground">{w(`glossary.${g.id}.term`)}</strong>:{" "}
                  {w(`glossary.${g.id}.desc`)}
                </p>
                <pre className="mt-1 rounded-lg border bg-muted/40 p-2 text-xs text-foreground overflow-x-auto">
                  {g.formula}
                </pre>
              </div>
            ))}
          </div>
        </Section>

        <Section id="principles" icon={Sparkles} title={w("toc.principles")}>
          <p>{w("principles.intro")}</p>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <p className="font-medium text-foreground">{w(`principles.p${n}.h`)}</p>
                <p>{w(`principles.p${n}.b`)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs">{w("principles.note")}</p>
        </Section>

        <Section id="analysis" icon={BarChart3} title={w("toc.analysis")}>
          <p>{w("analysis.p1")}</p>
          <p className="font-medium text-foreground">{w("analysis.burndownHeading")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {w("analysis.li1a")}
              <strong>{w("analysis.li1strong")}</strong>
              {w("analysis.li1b")}
            </li>
            <li>{w("analysis.li2")}</li>
            <li>{w("analysis.li3")}</li>
            <li>{w("analysis.li4")}</li>
          </ul>
          <p className="font-medium text-foreground pt-2">{w("analysis.categoryHeading")}</p>
          <p>{w("analysis.p2")}</p>
        </Section>

        <Section id="settings" icon={SettingsIcon} title={w("toc.settings")}>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Term>{w("settings.li1term")}</Term>
              {w("settings.li1a")}
              <em>{w("settings.li1em")}</em>
              {w("settings.li1b")}
            </li>
            <li>
              <Term>{w("settings.li2term")}</Term>
              {w("settings.li2")}
            </li>
            <li>
              <Term>{w("settings.li3term")}</Term>
              {w("settings.li3")}
            </li>
            <li>
              <Term>{w("settings.li4term")}</Term>
              {w("settings.li4")}
            </li>
            <li>
              <Term>{w("settings.li5term")}</Term>
              {w("settings.li5")}
            </li>
            <li>
              <Term>{w("settings.li6term")}</Term>
              {w("settings.li6")}
            </li>
            <li>
              <Term>{w("settings.li7term")}</Term>
              {w("settings.li7")}
            </li>
          </ul>
        </Section>

        <Section id="notifications" icon={Bell} title={w("toc.notifications")}>
          <p>{w("notifications.p1")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>{w("notifications.li1strong")}</strong>
              {w("notifications.li1")}
            </li>
            <li>
              <strong>{w("notifications.li2strong")}</strong>
              {w("notifications.li2")}
            </li>
            <li>
              <strong>{w("notifications.li3strong")}</strong>
              {w("notifications.li3")}
            </li>
          </ul>
          <p>{w("notifications.p2")}</p>
        </Section>

        <Section id="privacy" icon={Eye} title={w("toc.privacy")}>
          <p>
            <Term>{w("privacy.p1term")}</Term>
            {w("privacy.p1")}
          </p>
          <p>
            <Term>{w("privacy.p2term")}</Term>
            {w("privacy.p2")}
          </p>
          <p className="flex items-center gap-2 pt-1">
            <ShieldCheck className="size-4 text-primary" />
            <span>{w("privacy.p3")}</span>
          </p>
        </Section>

        <Section id="credits" icon={Sparkles} title={w("toc.credits")}>
          <p>
            {w("credits.p1a")}
            <strong>{w("credits.p1strong")}</strong>
            {w("credits.p1b")}
            <strong>{w("credits.p1strong2")}</strong>
            {w("credits.p1c")}
            <em>{w("credits.p1em")}</em>
            {w("credits.p1d")}
          </p>

          <h3 className="font-medium text-foreground mt-4">{w("credits.tokenHeading")}</h3>
          <p>
            {w("credits.tokenP1a")}
            <strong>{w("credits.tokenStrong")}</strong>
            {w("credits.tokenP1b")}
            <em>{w("credits.tokenEm")}</em>
            {w("credits.tokenP1c")}
          </p>
          <p>
            {w("credits.tokenP2a")}
            <strong>{w("credits.tokenP2strong1")}</strong>
            {w("credits.tokenP2mid")}
            <strong>{w("credits.tokenP2strong2")}</strong>
            {w("credits.tokenP2end")}
          </p>

          <h3 className="font-medium text-foreground mt-4">{w("credits.howHeading")}</h3>
          <p>
            {w("credits.howP1a")}
            <code>{w("credits.howCode")}</code>
            {w("credits.howP1b")}
            <strong>{w("credits.howStrong")}</strong>
            {w("credits.howP1c")}
          </p>
          <p>{w("credits.typicalCosts")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>{w("credits.cost1strong")}</strong>
              {w("credits.cost1")}
            </li>
            <li>
              <strong>{w("credits.cost2strong")}</strong>
              {w("credits.cost2")}
            </li>
            <li>
              <strong>{w("credits.cost3strong")}</strong>
              {w("credits.cost3")}
            </li>
            <li>
              <strong>{w("credits.cost4strong")}</strong>
              {w("credits.cost4a")}
              <em>{w("credits.cost4em")}</em>
              {w("credits.cost4b")}
            </li>
          </ul>

          <h3 className="font-medium text-foreground mt-4">{w("credits.saveHeading")}</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {w("credits.save1a")}
              <strong>{w("credits.save1strong")}</strong>
              {w("credits.save1b")}
            </li>
            <li>{w("credits.save2")}</li>
            <li>
              {w("credits.save3a")}
              <strong>{w("credits.save3strong")}</strong>
              {w("credits.save3b")}
            </li>
            <li>
              {w("credits.save4a")}
              <em>{w("credits.save4em")}</em>
              {w("credits.save4b")}
            </li>
            <li>{w("credits.save5")}</li>
            <li>{w("credits.save6")}</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">{w("credits.footnote")}</p>
        </Section>

        <Section id="faq" icon={Sparkles} title={w("toc.faq")}>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="why-cycles">
              <AccordionTrigger>{w("faq.q1Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("faq.q1Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="salary-in-list">
              <AccordionTrigger>{w("faq.q2Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("faq.q2Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="under-allocated">
              <AccordionTrigger>{w("faq.q3Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("faq.q3Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="over-baseline">
              <AccordionTrigger>{w("faq.q4Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("faq.q4Body")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ai-accuracy">
              <AccordionTrigger>{w("faq.q5Trigger")}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {w("faq.q5Body")}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>
      </div>
    </>
  );
}
