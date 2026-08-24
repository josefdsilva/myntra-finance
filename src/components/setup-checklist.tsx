import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ArrowRight, X, ListChecks } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";

type Hh = {
  age_band?: string | null;
} | null;

type SetupRoute = "/cashflow" | "/allocations" | "/settings" | "/loans" | "/assets";
type Item = {
  key: string;
  done: boolean;
  to: SetupRoute;
  label: MessageKey;
  hint?: MessageKey;
};

/**
 * Post-onboarding "finish setting up" checklist. Instead of a rigid tour, it
 * lands on the dashboard and deep-links into the REAL screens for whatever's
 * still missing. Auto-hides when done; dismissible.
 */
export function SetupChecklist({
  householdId,
  household,
}: {
  householdId: string;
  household: Hh;
}) {
  const t = useT();
  const dismissKey = `bynku.setup.dismissed.${householdId}`;
  const snoozeKey = `bynku.setup.snoozed.${householdId}`;
  const [dismissed, setDismissed] = useState(true);
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
      const raw = localStorage.getItem(snoozeKey);
      setSnoozed(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissed(false);
    }
  }, [dismissKey, snoozeKey]);


  const { data: counts } = useQuery({
    queryKey: ["setup-counts", householdId],
    queryFn: async () => {
      const tables = ["incomes", "fixed_expenses", "variable_estimates", "buckets", "debts", "assets"] as const;
      const [res, ests] = await Promise.all([
        Promise.all(
          tables.map((tb) =>
            supabase.from(tb).select("id", { count: "exact", head: true }).eq("household_id", householdId),
          ),
        ),
        Promise.all([
          supabase
            .from("fixed_expenses")
            .select("id", { count: "exact", head: true })
            .eq("household_id", householdId)
            .eq("is_estimated", true),
          supabase
            .from("variable_estimates")
            .select("id", { count: "exact", head: true })
            .eq("household_id", householdId)
            .eq("is_estimated", true),
        ]),
      ]);
      return {
        incomes: res[0].count ?? 0,
        fixed: res[1].count ?? 0,
        variable: res[2].count ?? 0,
        buckets: res[3].count ?? 0,
        debts: res[4].count ?? 0,
        assets: res[5].count ?? 0,
        estimated: (ests[0].count ?? 0) + (ests[1].count ?? 0),
      };
    },
  });

  if (!counts) return null;

  const items: Item[] = [
    {
      key: "income",
      done: counts.incomes > 0,
      to: "/cashflow",
      label: "setup.item.income",
    },
    {
      key: "fixed",
      done: counts.fixed > 0,
      to: "/cashflow",
      label: "setup.item.fixed",
    },
    {
      key: "variable",
      done: counts.variable > 0,
      to: "/cashflow",
      label: "setup.item.variable",
    },
    {
      key: "projects",
      done: counts.buckets > 0,
      to: "/allocations",
      label: "setup.item.projects",
    },
    {
      key: "debt",
      done: counts.debts > 0,
      to: "/loans",
      label: "setup.item.debt",
      hint: "setup.item.debtHint",
    },
    {
      key: "assets",
      done: counts.assets > 0,
      to: "/assets",
      label: "setup.item.assets",
      hint: "setup.item.assetsHint",
    },
    // Only while benchmark estimates are still unconfirmed.
    ...(counts.estimated > 0
      ? ([
          {
            key: "confirmEstimates",
            done: false,
            to: "/cashflow",
            label: "setup.item.confirmEstimates",
            hint: "setup.item.confirmEstimatesHint",
          },
        ] as Item[])
      : []),
    ...([
      {
        key: "ageBand",
        done: !!household?.age_band,
        to: "/settings",
        label: "setup.item.ageBand",
        hint: "setup.item.ageBandHint",
      },
    ] as Item[]),
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || doneCount === items.length) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
  }

  function snooze(key: string) {
    setSnoozed((s) => {
      const next = [...s, key];
      try {
        localStorage.setItem(snoozeKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const pending = items.filter((i) => !i.done);
  // Ask ONE thing at a time, in the coach's voice. "Not now" moves to the next
  // question instead of burying the household in a form.
  const question = pending.find((i) => !snoozed.includes(i.key)) ?? null;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" />
            <div>
              <p className="font-medium">{t("setup.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("setup.progress", { done: doneCount, total: items.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("setup.dismiss")}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {question && !showAll && (
          <div className="mt-3 rounded-lg border bg-card p-4">
            <p className="text-sm">{t(question.label)}</p>
            {question.hint && (
              <p className="mt-1 text-xs text-muted-foreground">{t(question.hint)}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to={question.to}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t("setup.answer")}
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => snooze(question.key)}
                className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("setup.notNow")}
              </button>
            </div>
          </div>
        )}

        {(!question || showAll) && (
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {items.map((it) =>
              it.done ? (
                <li
                  key={it.key}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                >
                  <Check className="size-4 shrink-0 text-primary" />
                  <span className="line-through">{t(it.label)}</span>
                </li>
              ) : (
                <li key={it.key}>
                  <Link
                    to={it.to}
                    className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="size-4 shrink-0 rounded-full border border-muted-foreground/40" />
                    <span className="min-w-0 flex-1">
                      <span>{t(it.label)}</span>
                      {it.hint && (
                        <span className="block text-xs text-muted-foreground">{t(it.hint)}</span>
                      )}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}

        {question && (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showAll ? t("setup.hideAll") : t("setup.showAll", { n: pending.length })}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

