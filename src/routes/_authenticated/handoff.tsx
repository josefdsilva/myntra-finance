import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Building2 } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/handoff")({
  head: () => ({ meta: [{ title: "Accountant handoff · bynku" }] }),
  component: HandoffPage,
});

function quarterRange(year: number, q: number) {
  const startMonth = (q - 1) * 3;
  return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1) };
}

function HandoffPage() {
  const t = useT();
  const activeId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeId],
    queryFn: () => fetchHh({ data: activeId ? { household_id: activeId } : {} }),
  });
  const household = hh?.household;
  const householdId = household?.id;
  const isBusiness = household?.kind === "business";

  const now = new Date();
  const year = now.getFullYear();
  const currentQ = Math.floor(now.getMonth() / 3) + 1;
  const [quarter, setQuarter] = useState(String(currentQ));
  const q = Number(quarter);
  const { start, end } = quarterRange(year, q);

  const { data: summary } = useQuery({
    enabled: !!householdId && isBusiness,
    queryKey: ["handoff-summary", householdId, year, q],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, kind")
        .eq("household_id", householdId!)
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString());
      const rows = data ?? [];
      let costCount = 0;
      let incomeCount = 0;
      let spent = 0;
      let received = 0;
      for (const r of rows) {
        if (r.kind === "income") {
          incomeCount++;
          received += Number(r.amount);
        } else {
          costCount++;
          spent += Number(r.amount);
        }
      }
      return { costCount, incomeCount, spent, received, total: rows.length };
    },
  });

  const advisor = household?.advisor_email?.trim() || "";

  function send() {
    if (!advisor) {
      toast.error(t("handoff.noAdvisor"));
      return;
    }
    toast.success(t("handoff.sentToast", { count: summary?.total ?? 0, email: advisor }));
  }

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("handoff.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("handoff.subtitle")}</p>
      </header>

      {!isBusiness ? (
        <EmptyState
          icon={Building2}
          title={t("handoff.businessOnly")}
          description={t("handoff.businessOnlyBody")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("handoff.periodTitle")}</CardTitle>
            <CardDescription>{t("handoff.periodDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-[220px] gap-1.5">
              <Label className="text-xs text-muted-foreground">{t("handoff.quarter")}</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {t("handoff.qLabel", { q: n, year })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t("handoff.costs")} value={String(summary?.costCount ?? 0)} />
              <Stat label={t("handoff.income")} value={String(summary?.incomeCount ?? 0)} />
              <Stat label={t("handoff.spent")} value={money(summary?.spent ?? 0)} />
              <Stat label={t("handoff.received")} value={money(summary?.received ?? 0)} />
            </div>

            <p className="text-xs text-muted-foreground">{t("handoff.note")}</p>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                {advisor ? t("handoff.advisorIs", { email: advisor }) : t("handoff.noAdvisorSet")}
              </p>
              <Button onClick={send} disabled={!summary}>
                <Send className="size-4" /> {t("handoff.send")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
