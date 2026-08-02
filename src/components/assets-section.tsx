import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Trash2, Gem, Sparkles, Pencil, TrendingDown } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  upsertAsset,
  deleteAsset,
  setAssetLinks,
  linkAssetBucket,
  ASSET_KINDS,
  liquidityForKind,
} from "@/lib/assets.functions";
import {
  computeDepreciation,
  deriveUsefulLifeMonths,
  type DepreciationMethod,
} from "@/lib/depreciation";

type AssetRow = {
  id: string;
  name: string;
  kind: string;
  acquired_value: number | null;
  acquired_on: string | null;
  current_value: number;
  liquidity: string;
  income_id: string | null;
  bucket_id: string | null;
  depreciation_method: string;
  useful_life_months: number | null;
  salvage_value: number | null;
  depreciation_start: string | null;
};

const LIQ_TONE: Record<string, string> = {
  liquid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  semi_liquid: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  illiquid: "bg-muted text-muted-foreground",
};

// Asset kinds that commonly generate rent — show the rent-link affordance on
// these even before a rent income exists, so the connection is discoverable.
const RENTAL_KINDS = new Set(["property", "land", "business"]);

// Depreciation form state. Useful life is captured in years (friendlier than
// months) and converted on save.
type DeprState = {
  method: DepreciationMethod;
  years: string;
  salvage: string;
  start: string;
};
const emptyDepr: DeprState = { method: "none", years: "", salvage: "", start: "" };

/** Convert the depreciation form state into the server fn's fields. */
function deprFields(d: DeprState) {
  if (d.method !== "straight_line") {
    return {
      depreciation_method: "none" as const,
      useful_life_months: null,
      salvage_value: null,
      depreciation_start: null,
    };
  }
  const years = parseFloat(d.years.replace(",", "."));
  const months = isFinite(years) && years > 0 ? Math.round(years * 12) : null;
  const salvage = d.salvage ? parseFloat(d.salvage.replace(",", ".")) || 0 : 0;
  return {
    depreciation_method: "straight_line" as const,
    useful_life_months: months,
    salvage_value: salvage,
    depreciation_start: d.start || null,
  };
}

/** Build a DeprState from a saved asset row (for the edit form). */
function deprFromRow(r: AssetRow): DeprState {
  return {
    method: r.depreciation_method === "straight_line" ? "straight_line" : "none",
    years: r.useful_life_months ? String(Math.round((r.useful_life_months / 12) * 10) / 10) : "",
    salvage: r.salvage_value != null && Number(r.salvage_value) > 0 ? String(r.salvage_value) : "",
    start: r.depreciation_start ? r.depreciation_start.slice(0, 10) : "",
  };
}

export function AssetsSection({
  householdId,
  isBusiness = false,
}: {
  householdId: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsert = useServerFn(upsertAsset);
  const del = useServerFn(deleteAsset);

  const linkFn = useServerFn(setAssetLinks);
  const { data: rows, refetch } = useQuery({
    queryKey: ["assets", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id, name, kind, acquired_value, acquired_on, current_value, liquidity, income_id, bucket_id, depreciation_method, useful_life_months, salvage_value, depreciation_start",
        )
        .eq("household_id", householdId)
        .order("current_value", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetRow[];
    },
  });

  // Rent-type incomes available to attach to an asset, so we can show which
  // assets generate recurring income and their rent-to-value (gross yield).
  const { data: rentIncomes = [] } = useQuery({
    queryKey: ["assets-rent-incomes", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incomes")
        .select("id, label, monthly_amount")
        .eq("household_id", householdId)
        .eq("type", "rent");
      return (data ?? []) as Array<{ id: string; label: string; monthly_amount: number }>;
    },
  });

  async function linkIncome(assetId: string, incomeId: string | null) {
    await linkFn({ data: { id: assetId, household_id: householdId, income_id: incomeId } });
    refetch();
  }

  // Investment projects that can fund an asset. Contributions into a linked
  // project automatically raise the asset's value and cost basis.
  const { data: investmentBuckets = [] } = useQuery({
    queryKey: ["assets-investment-buckets", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("buckets")
        .select("id, name")
        .eq("household_id", householdId)
        .eq("kind", "investment");
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  const bucketLinkFn = useServerFn(linkAssetBucket);
  async function linkBucket(assetId: string, bucketId: string | null) {
    await bucketLinkFn({ data: { id: assetId, household_id: householdId, bucket_id: bucketId } });
    refetch();
    qc.invalidateQueries({ queryKey: ["net-worth", householdId] });
  }

  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof ASSET_KINDS)[number]>("property");
  const [current, setCurrent] = useState("");
  const [acquired, setAcquired] = useState("");
  const [acquiredOn, setAcquiredOn] = useState("");
  const [depr, setDepr] = useState<DeprState>(emptyDepr);

  // Inline edit of an existing asset (one row at a time).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eKind, setEKind] = useState<(typeof ASSET_KINDS)[number]>("property");
  const [eCurrent, setECurrent] = useState("");
  const [eAcquired, setEAcquired] = useState("");
  const [eAcquiredOn, setEAcquiredOn] = useState("");
  const [eDepr, setEDepr] = useState<DeprState>(emptyDepr);

  const KIND_LABEL: Record<string, string> = {
    property: t("assets.kindProperty"),
    land: t("assets.kindLand"),
    vehicle: t("assets.kindVehicle"),
    stocks: t("assets.kindStocks"),
    bonds: t("assets.kindBonds"),
    fund: t("assets.kindFund"),
    business: t("assets.kindBusiness"),
    other: t("assets.kindOther"),
  };
  const LIQ_LABEL: Record<string, string> = {
    liquid: t("assets.liqLiquid"),
    semi_liquid: t("assets.liqSemi"),
    illiquid: t("assets.liqIlliquid"),
  };

  const formLiquidity = liquidityForKind(kind);

  function askCoach(a: { name: string; kind: string; acquired_value: number | null; acquired_on: string | null }) {
    const ask = t("assets.estimatePrompt", {
      name: a.name,
      kind: (KIND_LABEL[a.kind] ?? a.kind).toLowerCase(),
      acquired: a.acquired_value != null ? money(a.acquired_value) : "—",
      date: a.acquired_on ? fmtDate(a.acquired_on) : "—",
    });
    navigate({ to: "/analysis", search: { ask } as never });
  }

  async function add() {
    if (!name || !current) return;
    await upsert({
      data: {
        household_id: householdId,
        name,
        kind,
        current_value: parseFloat(current.replace(",", ".")) || 0,
        acquired_value: acquired ? parseFloat(acquired.replace(",", ".")) || 0 : null,
        acquired_on: acquiredOn || null,
        ...deprFields(depr),
      },
    });
    setName("");
    setCurrent("");
    setAcquired("");
    setAcquiredOn("");
    setDepr(emptyDepr);
    refetch();
    qc.invalidateQueries({ queryKey: ["net-worth", householdId] });
  }

  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
    qc.invalidateQueries({ queryKey: ["net-worth", householdId] });
  }

  function startEdit(r: AssetRow) {
    setEditingId(r.id);
    setEName(r.name);
    setEKind(
      (ASSET_KINDS as readonly string[]).includes(r.kind)
        ? (r.kind as (typeof ASSET_KINDS)[number])
        : "other",
    );
    setECurrent(String(r.current_value));
    setEAcquired(r.acquired_value != null ? String(r.acquired_value) : "");
    setEAcquiredOn(r.acquired_on ? r.acquired_on.slice(0, 10) : "");
    setEDepr(deprFromRow(r));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !eName || !eCurrent) return;
    await upsert({
      data: {
        id: editingId,
        household_id: householdId,
        name: eName,
        kind: eKind,
        current_value: parseFloat(eCurrent.replace(",", ".")) || 0,
        acquired_value: eAcquired ? parseFloat(eAcquired.replace(",", ".")) || 0 : null,
        acquired_on: eAcquiredOn || null,
        ...deprFields(eDepr),
      },
    });
    setEditingId(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["net-worth", householdId] });
  }

  const list = rows ?? [];
  const totalCurrent = list.reduce((s, r) => s + Number(r.current_value), 0);
  const linkedBuckets = new Set(list.map((a) => a.bucket_id).filter((x): x is string => !!x));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gem className="size-4" /> {t("assets.title")}
        </CardTitle>
        <CardDescription>
          {t("assets.totalValue")}:{" "}
          <span className="font-medium text-foreground">{money(totalCurrent)}</span>
          {list.length > 0 ? ` · ${t("assets.count", { count: list.length })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.length > 0 && (
          <ul className="divide-y">
            {list.map((r) => {
              if (editingId === r.id) {
                return (
                  <li key={r.id} className="py-2.5">
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr]">
                        <Input
                          placeholder={t("assets.namePlaceholder")}
                          value={eName}
                          onChange={(e) => setEName(e.target.value)}
                        />
                        <Select value={eKind} onValueChange={(v) => setEKind(v as typeof eKind)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {KIND_LABEL[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("assets.currentValue")}
                          </Label>
                          <Input
                            inputMode="decimal"
                            value={eCurrent}
                            onChange={(e) => setECurrent(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("assets.acquiredValue")}
                          </Label>
                          <Input
                            inputMode="decimal"
                            value={eAcquired}
                            onChange={(e) => setEAcquired(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("assets.acquiredOn")}
                          </Label>
                          <Input
                            type="date"
                            value={eAcquiredOn}
                            onChange={(e) => setEAcquiredOn(e.target.value)}
                          />
                        </div>
                      </div>
                      {isBusiness && (
                        <DepreciationEditor
                          value={eDepr}
                          onChange={setEDepr}
                          acquired={eAcquired}
                          acquiredOn={eAcquiredOn}
                          current={eCurrent}
                        />
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          {t("common.cancel")}
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={!eName || !eCurrent}>
                          {t("common.save")}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              }
              const gain =
                r.acquired_value != null
                  ? Number(r.current_value) - Number(r.acquired_value)
                  : null;
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${LIQ_TONE[r.liquidity] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {LIQ_LABEL[r.liquidity] ?? r.liquidity}
                      </span>
                    </div>
                    {r.acquired_value != null && (
                      <p className="text-xs text-muted-foreground">
                        {t("assets.acquiredLine", {
                          value: money(r.acquired_value),
                          date: r.acquired_on ? fmtDate(r.acquired_on) : "—",
                        })}
                      </p>
                    )}
                    {(() => {
                      if (!isBusiness || r.depreciation_method !== "straight_line") return null;
                      const dep = computeDepreciation({
                        method: "straight_line",
                        acquiredValue: r.acquired_value,
                        salvageValue: Number(r.salvage_value ?? 0),
                        usefulLifeMonths: r.useful_life_months,
                        start: r.depreciation_start ?? r.acquired_on,
                      });
                      if (!dep) return null;
                      return (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <TrendingDown className="size-3 shrink-0" />
                          {dep.fullyDepreciated
                            ? t("assets.deprFully", { book: money(dep.bookValue) })
                            : t("assets.deprLine", {
                                annual: money(dep.annual),
                                pct: dep.pctDepreciated,
                                years: Math.round((dep.remainingMonths / 12) * 10) / 10,
                              })}
                        </p>
                      );
                    })()}
                    {(rentIncomes.length > 0 || r.income_id || RENTAL_KINDS.has(r.kind)) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {rentIncomes.length > 0 || r.income_id ? (
                          <>
                            <Select
                              value={r.income_id ?? "none"}
                              onValueChange={(v) => linkIncome(r.id, v === "none" ? null : v)}
                            >
                              <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs">
                                <SelectValue placeholder={t("assets.rentLabel")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t("assets.rentNone")}</SelectItem>
                                {rentIncomes.map((inc) => (
                                  <SelectItem key={inc.id} value={inc.id}>
                                    {inc.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(() => {
                              const inc = rentIncomes.find((i) => i.id === r.income_id);
                              if (!inc || Number(r.current_value) <= 0) return null;
                              const cur = Number(r.current_value);
                              const annual = Number(inc.monthly_amount) * 12;
                              const yieldPct = (annual / cur) * 100;
                              const ratio = annual > 0 ? cur / annual : 0;
                              return (
                                <span className="text-[11px] text-muted-foreground">
                                  {t("assets.rentYield", {
                                    pct: yieldPct.toFixed(1),
                                    annual: money(annual),
                                  })}
                                  {annual > 0
                                    ? ` · ${t("assets.priceToRent", { ratio: ratio.toFixed(1) })}`
                                    : ""}
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {t("assets.rentHint")}
                          </span>
                        )}
                      </div>
                    )}
                    {(investmentBuckets.length > 0 || r.bucket_id) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Select
                          value={r.bucket_id ?? "none"}
                          onValueChange={(v) => linkBucket(r.id, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs">
                            <SelectValue placeholder={t("assets.projectLabel")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("assets.projectNone")}</SelectItem>
                            {investmentBuckets
                              .filter((b) => !linkedBuckets.has(b.id) || b.id === r.bucket_id)
                              .map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {r.bucket_id && (
                          <span className="text-[11px] text-muted-foreground">
                            {t("assets.projectSynced")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end sm:shrink-0">
                    <div>
                      <span className="tabular-nums font-medium">{money(r.current_value)}</span>
                      {gain != null && Math.abs(gain) >= 0.005 && (
                        <span
                          className={`ml-2 text-xs tabular-nums ${gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                        >
                          {gain >= 0 ? "▲" : "▼"} {money(Math.abs(gain))}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
        <Button aria-label={t("common.edit")}
                        variant="ghost"
                        size="icon"
                        title={t("common.edit")}
                        onClick={() => startEdit(r)}
                      >
                        <Pencil className="size-4" />
                      </Button>
        <Button aria-label={t("assets.askCoach")}
                        variant="ghost"
                        size="icon"
                        title={t("assets.askCoach")}
                        onClick={() => askCoach(r)}
                      >
                        <Sparkles className="size-4" />
                      </Button>
        <Button aria-label={t("common.delete")} variant="ghost" size="icon" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr]">
            <Input
              placeholder={t("assets.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="space-y-1">
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground px-1">
                {t("assets.liquidityAuto", { level: LIQ_LABEL[formLiquidity] })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("assets.currentValue")}</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("assets.acquiredValue")}</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={acquired}
                onChange={(e) => setAcquired(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("assets.acquiredOn")}</Label>
              <Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={add} disabled={!name || !current}>
                <Plus /> {t("common.add")}
              </Button>
            </div>
          </div>
          {isBusiness && (
            <DepreciationEditor
              value={depr}
              onChange={setDepr}
              acquired={acquired}
              acquiredOn={acquiredOn}
              current={current}
            />
          )}
          <button
            type="button"
            disabled={!name}
            onClick={() =>
              askCoach({
                name,
                kind,
                acquired_value: acquired ? parseFloat(acquired.replace(",", ".")) || 0 : null,
                acquired_on: acquiredOn || null,
              })
            }
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
          >
            <Sparkles className="size-3.5" /> {t("assets.askCoachHelp")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Straight-line depreciation controls for a business asset. Captures useful life
 * (years), salvage value and the start date, shows a live preview of the annual
 * charge and current book value, and can back-calculate the useful life from the
 * acquired and current values ("calculate it from initial and current value").
 */
function DepreciationEditor({
  value,
  onChange,
  acquired,
  acquiredOn,
  current,
}: {
  value: DeprState;
  onChange: (d: DeprState) => void;
  acquired: string;
  acquiredOn: string;
  current: string;
}) {
  const t = useT();
  const set = (patch: Partial<DeprState>) => onChange({ ...value, ...patch });
  const acquiredNum = parseFloat(acquired.replace(",", "."));
  const currentNum = parseFloat(current.replace(",", "."));
  // Depreciation start falls back to the acquisition date when left blank.
  const start = value.start || acquiredOn || null;
  const salvageNum = value.salvage ? parseFloat(value.salvage.replace(",", ".")) || 0 : 0;

  const preview =
    value.method === "straight_line"
      ? (() => {
          const years = parseFloat(value.years.replace(",", "."));
          const months = isFinite(years) && years > 0 ? Math.round(years * 12) : null;
          return computeDepreciation({
            method: "straight_line",
            acquiredValue: isFinite(acquiredNum) ? acquiredNum : null,
            salvageValue: salvageNum,
            usefulLifeMonths: months,
            start,
          });
        })()
      : null;

  const canDerive =
    isFinite(acquiredNum) && isFinite(currentNum) && currentNum < acquiredNum && !!start;

  function derive() {
    if (!canDerive) return;
    const months = deriveUsefulLifeMonths({
      acquiredValue: acquiredNum,
      currentValue: currentNum,
      salvageValue: salvageNum,
      start,
    });
    if (months) set({ years: String(Math.round((months / 12) * 10) / 10) });
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-xs font-medium">
          <TrendingDown className="size-3.5" /> {t("assets.depreciation")}
        </Label>
        <Select
          value={value.method}
          onValueChange={(v) => set({ method: v as DepreciationMethod })}
        >
          <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("assets.deprNone")}</SelectItem>
            <SelectItem value="straight_line">{t("assets.deprStraight")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.method === "straight_line" && (
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">{t("assets.usefulLife")}</Label>
              <Input
                inputMode="decimal"
                placeholder="5"
                value={value.years}
                onChange={(e) => set({ years: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("assets.salvageValue")}
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={value.salvage}
                onChange={(e) => set({ salvage: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">{t("assets.deprStart")}</Label>
              <Input
                type="date"
                value={value.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={derive}
              disabled={!canDerive}
              className="text-[11px] text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {t("assets.deriveLife")}
            </button>
            {preview ? (
              <span className="text-right text-[11px] text-muted-foreground">
                {t("assets.deprPreview", {
                  annual: money(preview.annual),
                  book: money(preview.bookValue),
                  pct: preview.pctDepreciated,
                })}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {start ? t("assets.deprNeedInputs") : t("assets.deprNeedStart")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
