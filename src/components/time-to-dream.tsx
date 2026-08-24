import { Clock } from "lucide-react";
import { timeToDream } from "@/lib/pace";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * The "time to dream" lever, shown under any goal, rung or project: how long it
 * takes at the household's current pace, and how much sooner it lands if they
 * free a little more each month. Renders nothing when the pace is unknowable —
 * an honest silence beats an invented date.
 */
export function TimeToDreamLine({
  gapEur,
  paceEur,
  compact = false,
}: {
  gapEur: number;
  paceEur: number;
  compact?: boolean;
}) {
  const t = useT();
  const r = timeToDream(gapEur, paceEur);
  if (gapEur <= 0) return null;

  if (r.months == null) {
    return (
      <span className="mt-0.5 block text-xs text-muted-foreground">{t("pace.noPace")}</span>
    );
  }

  const when = r.etaIso
    ? new Date(r.etaIso).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <Clock className="size-3.5" aria-hidden />
        {t("pace.atThisPace", { months: r.months, when })}
      </span>
      {!compact && r.monthsSaved > 0 && (
        <span>
          {t("pace.swap", { amount: money(r.swapEur), months: r.monthsSaved })}
        </span>
      )}
    </span>
  );
}
