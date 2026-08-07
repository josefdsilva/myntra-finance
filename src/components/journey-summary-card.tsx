import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Map, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { journeySummary } from "@/lib/journey.functions";
import { useT, type MessageKey } from "@/lib/i18n";

/** Compact "your journey" entry point on the dashboard — current stage + level. */
export function JourneySummaryCard({ householdId }: { householdId: string }) {
  const t = useT();
  const fn = useServerFn(journeySummary);
  const { data } = useQuery({
    queryKey: ["journey-summary", householdId],
    queryFn: () => fn({ data: { household_id: householdId } }),
  });
  if (!data) return null;

  const active = data.active;
  const activeTitle = active
    ? active.title ?? (active.template_key ? t(`journey.stage.${active.template_key}.title` as MessageKey) : t("journey.heading"))
    : null;

  return (
    <Card className="border-primary/20">
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Map className="size-4" />
          </span>
          {data.hasStages && active ? (
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t("journey.level", { n: data.level })} ·{" "}
                {t(`journey.role.${active.template_key ?? "custom"}` as MessageKey)}
              </p>
              <p className="truncate font-medium">{activeTitle}</p>
              <div className="mt-1.5 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.round(active.progress * 100)}%` }} />
              </div>
            </div>
          ) : data.hasStages ? (
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("journey.level", { n: data.level })}</p>
              <p className="truncate font-medium">{t("journey.allDone")}</p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="font-medium">{t("journey.heading")}</p>
              <p className="truncate text-xs text-muted-foreground">{t("journey.subtitle")}</p>
            </div>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/journey">
            {t("journey.card.open")} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
