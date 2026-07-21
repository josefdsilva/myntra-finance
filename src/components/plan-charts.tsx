import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { planAppliesToMonth, monthKey, type Plan } from "@/lib/plan";

export type Horizon = 3 | 6 | 12 | 24;

const shortLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

/** Segmented 3 / 6 / 12 month horizon control. */
export function HorizonToggle({
  horizon,
  onChange,
}: {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
}) {
  return (
    <div className="flex gap-1 shrink-0">
      {([3, 6, 12, 24] as const).map((h) => (
        <Button
          key={h}
          size="sm"
          variant={horizon === h ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(h)}
        >
          {h}
        </Button>
      ))}
    </div>
  );
}

/** Gantt-style timeline of the upcoming plans over the horizon. */
export function PlanTimeline({ plans, horizon }: { plans: Plan[]; horizon: Horizon }) {
  const t = useT();
  const now = useMemo(() => new Date(), []);

  const timelineMonths = useMemo(
    () =>
      Array.from({ length: horizon }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        return { ym: monthKey(d), label: shortLabel(d) };
      }),
    [horizon, now],
  );

  const timelineRows = useMemo(() => {
    const startYm = timelineMonths[0]?.ym ?? monthKey(now);
    return plans
      .filter((p) => !p.done)
      .filter((p) => timelineMonths.some((m) => planAppliesToMonth(p, m.ym)))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((p) => {
        const dueYm = String(p.month).slice(0, 7);
        const cells = timelineMonths.map((m) => {
          const applies = planAppliesToMonth(p, m.ym);
          const saving =
            !!p.bucket_id && p.recurrence === "one_off" && m.ym >= startYm && m.ym < dueYm;
          return { applies, saving };
        });
        return { plan: p, cells };
      });
  }, [plans, timelineMonths, now]);

  if (timelineRows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{t("plan.timelineEmpty")}</p>;
  }

  const gridCols = `minmax(7rem, 1.3fr) repeat(${horizon}, minmax(2.25rem, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <TooltipProvider delayDuration={80}>
        <div className="min-w-[30rem] space-y-1">
          <div
            className="grid items-center gap-1 text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span />
            {timelineMonths.map((m) => (
              <span key={m.ym} className="text-center capitalize">
                {m.label}
              </span>
            ))}
          </div>
          {timelineRows.map(({ plan, cells }) => {
            const dueYm = String(plan.month).slice(0, 7);
            const recKey =
              plan.recurrence === "annual"
                ? "plan.annual"
                : plan.recurrence === "ongoing"
                  ? "plan.ongoing"
                  : "plan.once";
            return (
              <UiTooltip key={plan.id}>
                <TooltipTrigger asChild>
                  <div
                    className="grid items-center gap-1 cursor-default rounded-sm hover:bg-muted/40"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <span className="truncate text-xs pr-1">{plan.label}</span>
                    {cells.map((c, i) => (
                      <div key={i} className="h-5 rounded-sm bg-muted/40">
                        {c.applies ? (
                          <div
                            className={`h-full rounded-sm ${plan.direction === "income" ? "bg-emerald-500" : "bg-amber-500"}`}
                          />
                        ) : c.saving ? (
                          <div className="h-full rounded-sm bg-emerald-500/25" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{plan.label}</p>
                  <p>
                    {plan.direction === "income" ? "+" : ""}
                    {money(Math.abs(Number(plan.amount) || 0))} ·{" "}
                    <span className="capitalize">{shortLabel(new Date(`${dueYm}-01T00:00:00`))}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {t(recKey)} · {plan.bucket_id ? t("plan.funded") : t("plan.payFromLeftover")}
                  </p>
                </TooltipContent>
              </UiTooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
