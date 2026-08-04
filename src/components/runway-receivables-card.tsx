import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gauge, Pencil, Check, X, TrendingDown, Wallet } from "lucide-react";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { getRunwayReceivables, setCashOverride } from "@/lib/sme-cash.functions";
import type { AgeBucket } from "@/lib/receivables";

const SEV_TONE: Record<string, string> = {
  ok: "text-success",
  warn: "text-warning",
  critical: "text-destructive",
};

const BUCKET_KEY: Record<AgeBucket, MessageKey> = {
  not_due: "sme.bucket.notDue",
  d0_30: "sme.bucket.d0_30",
  d31_60: "sme.bucket.d31_60",
  d61_90: "sme.bucket.d61_90",
  d90_plus: "sme.bucket.d90_plus",
};

export function RunwayReceivablesCard({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getRunwayReceivables);
  const setFn = useServerFn(setCashOverride);

  const { data } = useQuery({
    queryKey: ["runway-receivables", householdId],
    queryFn: () => fetchFn({ data: { household_id: householdId } }),
  });

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  async function save(amount: number | null) {
    await setFn({ data: { household_id: householdId, amount } });
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["runway-receivables", householdId] });
  }

  if (!data) return null;
  const { runway, receivables } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4" /> {t("sme.title")}
        </CardTitle>
        <CardDescription>{t("sme.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Runway */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("sme.runway")}</p>
            {runway.cashFlowPositive ? (
              <>
                <p className="mt-1 font-display text-2xl text-success">
                  {t("sme.cashFlowPositive")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("sme.cashFlowPositiveDesc")}
                </p>
              </>
            ) : (
              <>
                <p className={cn("mt-1 font-display text-3xl tabular-nums", SEV_TONE[runway.severity])}>
                  {runway.months!.toFixed(1)}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    {t("sme.months")}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("sme.burnLine", { burn: money(runway.monthlyBurn) })}
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border p-4">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Wallet className="size-3.5" /> {t("sme.cashOnHand")}
            </p>
            {editing ? (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Input
                  autoFocus
                  inputMode="decimal"
                  placeholder="0.00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-8"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={t("common.save")}
                  onClick={() => save(parseFloat(value.replace(",", ".")) || 0)}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={t("common.cancel")}
                  onClick={() => setEditing(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl tabular-nums">{money(data.cashOnHand)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setValue(String(data.cashOnHand));
                    setEditing(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("common.edit")}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.override != null ? (
                <>
                  {t("sme.manualFigure")}{" "}
                  <button
                    type="button"
                    onClick={() => save(null)}
                    className="text-primary hover:underline"
                  >
                    {t("sme.useEstimate", { amount: money(data.computedCash) })}
                  </button>
                </>
              ) : (
                t("sme.estimateDesc")
              )}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("sme.monthlyFlow")}
            </p>
            <p className="mt-1 text-sm">
              {t("sme.in")}{" "}
              <span className="font-medium tabular-nums">{money(data.monthlyIncome)}</span>
            </p>
            <p className="text-sm">
              {t("sme.out")}{" "}
              <span className="font-medium tabular-nums">{money(data.monthlyOutgoings)}</span>
            </p>
          </div>
        </div>

        {/* Receivables */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">{t("sme.receivables")}</p>
            <p className="text-xs text-muted-foreground">
              {t("sme.outstanding", { amount: money(receivables.total) })}
              {receivables.overdueTotal > 0 && (
                <span className="text-warning">
                  {" · "}
                  {t("sme.overdueAmount", { amount: money(receivables.overdueTotal) })}
                </span>
              )}
            </p>
          </div>

          {receivables.items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              {t("sme.receivablesEmpty")}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(BUCKET_KEY) as AgeBucket[]).map((k) => {
                  const b = receivables.buckets[k];
                  const overdue = k !== "not_due" && b.amount > 0;
                  return (
                    <div
                      key={k}
                      className={cn(
                        "rounded-lg border p-2 text-center",
                        overdue && "border-warning/40 bg-warning/5",
                      )}
                    >
                      <p className="text-[10px] uppercase text-muted-foreground">{t(BUCKET_KEY[k])}</p>
                      <p className={cn("mt-0.5 text-xs font-medium tabular-nums", overdue && "text-warning")}>
                        {money(b.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <ul className="mt-3 divide-y">
                {receivables.items.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.daysOverdue > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                          <TrendingDown className="size-3" /> {t("sme.daysOverdue", { days: r.daysOverdue })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {t("sme.dueOn", { date: r.dueDate })}
                        </span>
                      )}
                      <span className="tabular-nums font-medium">{money(r.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
