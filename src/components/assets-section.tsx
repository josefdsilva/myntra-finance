import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Plus, Trash2, Gem } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { upsertAsset, deleteAsset, ASSET_KINDS, ASSET_LIQUIDITY } from "@/lib/assets.functions";

type AssetRow = {
  id: string;
  name: string;
  kind: string;
  acquired_value: number | null;
  acquired_on: string | null;
  current_value: number;
  liquidity: string;
};

const LIQ_TONE: Record<string, string> = {
  liquid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  semi_liquid: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  illiquid: "bg-muted text-muted-foreground",
};

export function AssetsSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertAsset);
  const del = useServerFn(deleteAsset);

  const { data: rows, refetch } = useQuery({
    queryKey: ["assets", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, kind, acquired_value, acquired_on, current_value, liquidity")
        .eq("household_id", householdId)
        .order("current_value", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetRow[];
    },
  });

  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof ASSET_KINDS)[number]>("property");
  const [liquidity, setLiquidity] = useState<(typeof ASSET_LIQUIDITY)[number]>("illiquid");
  const [current, setCurrent] = useState("");
  const [acquired, setAcquired] = useState("");
  const [acquiredOn, setAcquiredOn] = useState("");

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

  async function add() {
    if (!name || !current) return;
    await upsert({
      data: {
        household_id: householdId,
        name,
        kind,
        liquidity,
        current_value: parseFloat(current.replace(",", ".")) || 0,
        acquired_value: acquired ? parseFloat(acquired.replace(",", ".")) || 0 : null,
        acquired_on: acquiredOn || null,
      },
    });
    setName("");
    setCurrent("");
    setAcquired("");
    setAcquiredOn("");
    refetch();
  }

  async function remove(id: string) {
    await del({ data: { id } });
    refetch();
  }

  const list = rows ?? [];
  const totalCurrent = list.reduce((s, r) => s + Number(r.current_value), 0);

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
              const gain =
                r.acquired_value != null
                  ? Number(r.current_value) - Number(r.acquired_value)
                  : null;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
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
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="tabular-nums font-medium">{money(r.current_value)}</span>
                      {gain != null && Math.abs(gain) >= 0.005 && (
                        <p
                          className={`text-xs tabular-nums ${gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                        >
                          {gain >= 0 ? "▲" : "▼"} {money(Math.abs(gain))}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr]">
            <Input
              placeholder={t("assets.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            <Select value={liquidity} onValueChange={(v) => setLiquidity(v as typeof liquidity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_LIQUIDITY.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LIQ_LABEL[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
      </CardContent>
    </Card>
  );
}
