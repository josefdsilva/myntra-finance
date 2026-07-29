import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Calendar,
  CalendarClock,
  Wallet,
  Receipt,
  PiggyBank,
  BarChart3,
  Calculator,
  Settings as SettingsIcon,
  Bell,
  ShieldCheck,
  Sparkles,
  Search,
  CreditCard,
  MessageCircle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { useLocale } from "@/lib/i18n";
import { WIKI_META, wikiSectionsFor, type WikiIcon } from "@/lib/wiki-content";
import { pageShellClass } from "@/components/page-shell";
import {
  BaselineDiagram,
  CycleDiagram,
  WaterfallDiagram,
  LadderDiagram,
} from "@/components/wiki-diagrams";

export const Route = createFileRoute("/_authenticated/wiki")({
  head: () => ({
    meta: [
      { title: "Manual · bynku" },
      {
        name: "description",
        content:
          "A plain-language guide to bynku: pay cycles, safe-to-spend, projects, loans, plans, analysis and privacy.",
      },
    ],
  }),
  component: WikiPage,
});

const ICONS: Record<WikiIcon, LucideIcon> = {
  BookOpen,
  Calendar,
  Wallet,
  Receipt,
  Calculator,
  Sparkles,
  PiggyBank,
  CreditCard,
  CalendarClock,
  BarChart3,
  MessageCircle,
  Settings: SettingsIcon,
  Bell,
  ShieldCheck,
  HelpCircle,
};

function SectionCard({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
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

function WikiPage() {
  const locale = useLocale();
  const meta = WIKI_META[locale] ?? WIKI_META.en;
  const diag = meta.diagrams;

  // Show the manual for the space you're in: a company space hides household-only
  // sections (and vice versa) and surfaces the business notes.
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const isBusiness = hh?.household?.kind === "business";
  const kind: "personal" | "business" = isBusiness ? "business" : "personal";
  const sections = useMemo(() => wikiSectionsFor(kind), [kind]);

  const [query, setQuery] = useState("");
  const [noResults, setNoResults] = useState(false);

  // Per-section text index (title + paragraphs + bullets + callout) for search.
  const searchIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    for (const s of sections) {
      const title = s.title[locale] ?? s.title.en;
      const paras = (s.paragraphs[locale] ?? s.paragraphs.en).join(" ");
      const bullets = (s.bullets?.[locale] ?? s.bullets?.en ?? [])
        .map((b) => `${b.label} ${b.body}`)
        .join(" ");
      const callout = s.callout?.[locale] ?? s.callout?.en ?? "";
      idx[s.id] = `${title} ${paras} ${bullets} ${callout}`.toLowerCase();
    }
    return idx;
  }, [locale, sections]);

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

  return (
    <div className={pageShellClass("4xl")}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="size-3.5" />
          {meta.eyebrow}
        </div>
        <h1 className="font-display text-3xl md:text-4xl">{meta.title}</h1>
        <p className="text-muted-foreground">{meta.subtitle}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={meta.searchPlaceholder}
          aria-label={meta.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {noResults && (
        <p className="text-sm text-muted-foreground">
          {meta.noResults} “{query.trim()}”.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{meta.tocTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 sm:grid-cols-2 text-sm">
            {sections.map((s) => (
              <li key={s.id} data-wiki-toc={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">
                  {s.title[locale] ?? s.title.en}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {sections.map((s) => {
        const Icon = ICONS[s.icon];
        const title = s.title[locale] ?? s.title.en;
        const paras = s.paragraphs[locale] ?? s.paragraphs.en;
        const bullets = s.bullets?.[locale] ?? s.bullets?.en ?? [];
        const callout = s.callout?.[locale] ?? s.callout?.en;
        const businessNote = isBusiness ? (s.businessNote?.[locale] ?? s.businessNote?.en) : null;

        return (
          <SectionCard key={s.id} id={s.id} icon={Icon} title={title}>
            {s.diagram === "cycle" && (
              <CycleDiagram
                salary={diag.salary}
                today={diag.today}
                nextSalary={diag.nextSalary}
                cycle={diag.cycle}
                caption={diag.cycleCap}
              />
            )}
            {s.diagram === "baseline" && (
              <BaselineDiagram
                fixed={diag.fixed}
                debt={diag.debt}
                variable={diag.variable}
                margin={diag.margin}
                baseline={diag.baseline}
                caption={diag.baselineCap}
              />
            )}
            {s.diagram === "waterfall" && (
              <WaterfallDiagram
                surplus={diag.surplus}
                realAlloc={diag.realAlloc}
                realSurplus={diag.realSurplus}
                caption={diag.waterfallCap}
              />
            )}
            {s.diagram === "ladder" && (
              <LadderDiagram
                step1={diag.step1}
                step2={diag.step2}
                step3={diag.step3}
                caption={diag.ladderCap}
              />
            )}

            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}

            {s.formula && (
              <pre className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto">
                {s.formula}
              </pre>
            )}

            {bullets.length > 0 &&
              (s.faq ? (
                <Accordion type="single" collapsible className="w-full">
                  {bullets.map((b, i) => (
                    <AccordionItem key={i} value={`q-${i}`}>
                      <AccordionTrigger className="text-left text-foreground">
                        {b.label}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {b.body}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <ul className="space-y-1.5 pt-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>
                        <strong className="text-foreground">{b.label}.</strong> {b.body}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}

            {callout && (
              <p className="rounded-lg border bg-muted/40 p-3 text-foreground">{callout}</p>
            )}

            {businessNote && (
              <p className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-foreground">
                {businessNote}
              </p>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
