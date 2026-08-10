import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Target, Check, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  listKpiTargets,
  createKpiTarget,
  updateKpiTarget,
  deleteKpiTarget,
  type KpiTarget,
} from "@/lib/kpi-targets.functions";
import {
  METRICS,
  metricMeta,
  computeMetrics,
  fetchMetricInputs,
  formatMetricValue,
  isTargetMet,
  targetProgress,
  type MetricKey,
} from "@/lib/metrics";

/**
 * KPI Targets tab — measured (not funded) goals. Each target picks a metric, an
 * operator and a value; progress is computed live from the shared metric registry.
 * Reach-only: a target is "reached" once met. Full CRUD lives here.
 */
export function KpiTargetsTab({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(listKpiTargets);
  const deleteFn = useServerFn(deleteKpiTarget);

  const targetsQ = useQuery({
    queryKey: ["kpi-targets", householdId],
    queryFn: () => listFn({ data: { household_id: householdId } }),
  });
  const metricsQ = useQuery({
    queryKey: ["kpi-metrics", householdId],
    queryFn: async () => computeMetrics(await fetchMetricInputs(householdId)),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KpiTarget | null>(null);

  const targets = targetsQ.data ?? [];
  const metrics = metricsQ.data;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["kpi-targets", householdId] });
    qc.invalidateQueries({ queryKey: ["kpi-metrics", householdId] });
  };

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      refresh();
    } catch {
      toast.error(t("kpi.saveFailed"));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t("kpi.title")}</CardTitle>
          <CardDescription>{t("kpi.subtitle")}</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> {t("kpi.new")}
        </Button>
      </CardHeader>
      <CardContent>
        {targets.length === 0 ? (
          <EmptyState icon={Target} title={t("kpi.empty.title")} description={t("kpi.empty.desc")} />
        ) : (
          <ul className="space-y-3">
            {targets.map((tg) => {
              const meta = metricMeta(tg.metric_key);
              const current = metrics ? (metrics[tg.metric_key as MetricKey] ?? null) : null;
              const met = isTargetMet(tg.op, current, Number(tg.target_value));
              const pct = Math.round(targetProgress(tg.op, current, Number(tg.target_value)) * 100);
              const targetStr = formatMetricValue(tg.metric_key as MetricKey, Number(tg.target_value), money);
              const currentStr = formatMetricValue(tg.metric_key as MetricKey, current, money);
              return (
                <li key={tg.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tg.title}</span>
                        {met && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                            <Check className="size-3" /> {t("kpi.reached")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {meta ? t(meta.labelKey) : tg.metric_key} {tg.op} {targetStr}
                      </p>
                      {tg.target_date && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                          <CalendarClock className="size-3" /> {fmtDate(tg.target_date)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.edit")}
                        onClick={() => {
                          setEditing(tg);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.delete")}
                        onClick={() => remove(tg.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <Progress value={pct} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {t("kpi.now")}: <span className="font-medium text-foreground">{currentStr}</span>
                      </span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <KpiTargetDialog
        key={editing?.id ?? "new"}
        householdId={householdId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        currentValue={(k) => (metrics ? (metrics[k] ?? null) : null)}
        onSaved={refresh}
      />
    </Card>
  );
}

function KpiTargetDialog({
  householdId,
  open,
  onOpenChange,
  editing,
  currentValue,
  onSaved,
}: {
  householdId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: KpiTarget | null;
  currentValue: (k: MetricKey) => number | null;
  onSaved: () => void;
}) {
  const t = useT();
  const createFn = useServerFn(createKpiTarget);
  const updateFn = useServerFn(updateKpiTarget);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [metricKey, setMetricKey] = useState<MetricKey>((editing?.metric_key as MetricKey) ?? "emergency_months");
  const [op, setOp] = useState<"<=" | ">=">(editing?.op ?? metricMeta("emergency_months")!.defaultOp);
  const [value, setValue] = useState(editing ? String(editing.target_value) : "");
  const [date, setDate] = useState(editing?.target_date ?? "");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const cur = currentValue(metricKey);
    return formatMetricValue(metricKey, cur, money);
  }, [metricKey, currentValue]);

  function pickMetric(k: MetricKey) {
    setMetricKey(k);
    // Default the operator to the metric's "good" direction.
    setOp(metricMeta(k)!.defaultOp);
  }

  async function save() {
    const num = Number(value);
    if (!title.trim() || !Number.isFinite(num)) {
      toast.error(t("kpi.validation"));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateFn({
          data: {
            id: editing.id,
            title: title.trim(),
            metric_key: metricKey,
            op,
            target_value: num,
            target_date: date || null,
          },
        });
      } else {
        await createFn({
          data: {
            household_id: householdId,
            title: title.trim(),
            metric_key: metricKey,
            op,
            target_value: num,
            target_date: date || null,
          },
        });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(t("kpi.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("kpi.edit") : t("kpi.new")}</DialogTitle>
          <DialogDescription>{t("kpi.dialog.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kpi-title">{t("kpi.field.title")}</Label>
            <Input
              id="kpi-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("kpi.field.title.ph")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("kpi.field.metric")}</Label>
            <Select value={metricKey} onValueChange={(v) => pickMetric(v as MetricKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {t(m.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(metricMeta(metricKey)!.descKey)}</p>
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label>{t("kpi.field.op")}</Label>
              <Select value={op} onValueChange={(v) => setOp(v as "<=" | ">=")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=">=">{t("kpi.op.atLeast")}</SelectItem>
                  <SelectItem value="<=">{t("kpi.op.atMost")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="kpi-value">{t("kpi.field.value")}</Label>
              <Input
                id="kpi-value"
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kpi-date">{t("kpi.field.date")}</Label>
            <Input id="kpi-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("kpi.field.date.hint")}</p>
          </div>

          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("kpi.currentIs", { value: preview })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {editing ? t("common.save") : t("kpi.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
