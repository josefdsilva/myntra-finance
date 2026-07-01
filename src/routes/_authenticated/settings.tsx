import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateHousehold,
  updateHousehold,
  inviteMember,
} from "@/lib/household.functions";
import {
  upsertIncome, deleteIncome,
  upsertFixedExpense, deleteFixedExpense,
  upsertVariableEstimate, deleteVariableEstimate,
  upsertBucket, deleteBucket,
} from "@/lib/budget.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Household Budget" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHh() });
  const householdId = hh?.household?.id;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your household budget.</p>
      </header>

      {householdId && (
        <>
          <HouseholdSection household={hh!.household!} onChange={() => qc.invalidateQueries({ queryKey: ["household"] })} />
          <IncomesSection householdId={householdId} />
          <FixedExpensesSection householdId={householdId} />
          <VariableEstimatesSection householdId={householdId} />
          <BucketsSection householdId={householdId} />
          <MembersSection householdId={householdId} />
        </>
      )}
    </div>
  );
}


function HouseholdSection({ household, onChange }: { household: { id: string; name: string; baseline_budget: number | string; margin_pct: number | string }; onChange: () => void }) {
  const update = useServerFn(updateHousehold);
  const qc = useQueryClient();
  const [name, setName] = useState(household.name);
  const [margin, setMargin] = useState(Number(household.margin_pct));

  const { data: fixedRows } = useQuery({
    queryKey: ["fixed", household.id],
    queryFn: async () => {
      const { data } = await supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", household.id);
      return data ?? [];
    },
  });
  const { data: varRows } = useQuery({
    queryKey: ["variable-estimates", household.id],
    queryFn: async () => {
      const { data } = await supabase.from("variable_estimates").select("monthly_amount").eq("household_id", household.id);
      return data ?? [];
    },
  });

  const fixedTotal = (fixedRows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const varTotal = (varRows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const safetyReserve = ((fixedTotal + varTotal) * margin) / 100;
  const baseline = fixedTotal + varTotal + safetyReserve;
  const storedBaseline = Number(household.baseline_budget);

  // Auto-persist computed baseline whenever the inputs change
  useEffect(() => {
    if (!fixedRows || !varRows) return;
    if (Math.abs(baseline - storedBaseline) < 0.005 && margin === Number(household.margin_pct)) return;
    update({
      data: { household_id: household.id, baseline_budget: Number(baseline.toFixed(2)), margin_pct: margin },
    }).then(() => {
      onChange();
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["allocations"] });
    }).catch(() => {});
  }, [baseline, margin, storedBaseline, fixedRows, varRows]);

  async function saveName() {
    try {
      await update({ data: { household_id: household.id, name } });
      toast.success("Saved");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household</CardTitle>
        <CardDescription>The monthly baseline is calculated from your fixed expenses, variable estimates and safety margin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Household name</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveName} variant="outline">Save</Button>
            </div>
          </div>
          <div>
            <Label>Safety margin: {margin}%</Label>
            <Slider value={[margin]} min={0} max={30} step={1} onValueChange={(v) => setMargin(v[0])} className="mt-3" />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Fixed monthly expenses</span><span className="tabular-nums">{money(fixedTotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Estimated variable costs</span><span className="tabular-nums">{money(varTotal)}</span></div>
          <div className="flex justify-between text-sm text-muted-foreground"><span>Safety margin ({margin}%)</span><span className="tabular-nums">{money(safetyReserve)}</span></div>
          <div className="border-t pt-2 flex justify-between font-medium"><span>Monthly baseline</span><span className="tabular-nums text-lg">{money(baseline)}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function VariableEstimatesSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertVariableEstimate);
  const del = useServerFn(deleteVariableEstimate);
  const { data: rows, refetch } = useQuery({
    queryKey: ["variable-estimates", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("variable_estimates").select("*").eq("household_id", householdId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("groceries");

  async function add() {
    if (!label || !amount) return;
    await upsert({ data: { household_id: householdId, label, category, monthly_amount: parseFloat(amount) || 0 } });
    setLabel(""); setAmount("");
    refetch(); qc.invalidateQueries({ queryKey: ["household"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch(); qc.invalidateQueries({ queryKey: ["household"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimated variable costs</CardTitle>
        <CardDescription>Groceries, fuel, transport, goods — what you typically spend per month. Total: <span className="font-medium text-foreground">{money(total)}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p>{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
          <Input placeholder="e.g. Groceries" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["groceries", "fuel", "transport", "goods", "eating_out", "leisure", "kids", "health", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button onClick={add}><Plus /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}


function IncomesSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertIncome);
  const del = useServerFn(deleteIncome);
  const { data: rows, refetch } = useQuery({
    queryKey: ["incomes", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("*").eq("household_id", householdId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  async function add() {
    if (!label || !amount) return;
    await upsert({ data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 } });
    setLabel(""); setAmount("");
    refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["allocations"] });
  }
  async function remove(id: string) {
    await del({ data: { id } });
    refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["allocations"] });
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly income</CardTitle>
        <CardDescription>Total: <span className="font-medium text-foreground">{money(total)}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>{r.label}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
          <Input placeholder="e.g. Alex salary" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button onClick={add}><Plus /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FixedExpensesSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertFixedExpense);
  const del = useServerFn(deleteFixedExpense);
  const { data: rows, refetch } = useQuery({
    queryKey: ["fixed", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_expenses").select("*").eq("household_id", householdId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("housing");

  async function add() {
    if (!label || !amount) return;
    await upsert({ data: { household_id: householdId, label, category, monthly_amount: parseFloat(amount) || 0 } });
    setLabel(""); setAmount("");
    refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(id: string) {
    await del({ data: { id } }); refetch(); qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fixed monthly expenses</CardTitle>
        <CardDescription>Rent, loans, utilities, subscriptions. Total: <span className="font-medium text-foreground">{money(total)}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p>{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{money(r.monthly_amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
          <Input placeholder="e.g. Rent" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["housing", "utilities", "subscriptions", "transport", "health", "kids", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button onClick={add}><Plus /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BucketsSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertBucket);
  const del = useServerFn(deleteBucket);
  const { data: rows, refetch } = useQuery({
    queryKey: ["buckets-settings", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("buckets").select("*").eq("household_id", householdId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  async function save(b: typeof rows extends (infer T)[] | null | undefined ? T : never) {
    await upsert({
      data: {
        id: b.id,
        household_id: householdId,
        name: b.name,
        target_type: b.target_type,
        target_value: Number(b.target_value),
        target_deadline: b.target_deadline ?? null,
        color: b.color,
        sort_order: b.sort_order,
      },
    });
    qc.invalidateQueries({ queryKey: ["allocations"] });
    refetch();
  }
  async function remove(id: string) {
    await del({ data: { id } }); refetch(); qc.invalidateQueries({ queryKey: ["allocations"] });
  }
  async function addNew() {
    await upsert({
      data: {
        household_id: householdId,
        name: "New bucket",
        target_type: "pct_surplus",
        target_value: 10,
        color: "#2c6e6b",
        sort_order: (rows?.length ?? 0),
      },
    });
    refetch();
  }

  const pctTotal = (rows ?? []).filter((r) => r.target_type === "pct_surplus").reduce((s, r) => s + Number(r.target_value), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation buckets</CardTitle>
        <CardDescription>
          Distribute your surplus (income − baseline). % buckets currently total <span className={`font-medium ${pctTotal > 100 ? "text-destructive" : "text-foreground"}`}>{pctTotal}%</span> of surplus.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(rows ?? []).map((b) => <BucketRow key={b.id} bucket={b} onSave={save} onRemove={() => remove(b.id)} />)}
        <Button variant="outline" onClick={addNew}><Plus /> Add bucket</Button>
      </CardContent>
    </Card>
  );
}

function BucketRow({ bucket, onSave, onRemove }: { bucket: any; onSave: (b: any) => void; onRemove: () => void }) {
  const [b, setB] = useState(bucket);
  const dirty = JSON.stringify(b) !== JSON.stringify(bucket);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <Label>Name</Label>
          <Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
        </div>
        <div>
          <Label>Color</Label>
          <Input type="color" value={b.color ?? "#2c6e6b"} onChange={(e) => setB({ ...b, color: e.target.value })} className="w-16 p-1 h-9" />
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Target type</Label>
          <Select value={b.target_type} onValueChange={(v) => setB({ ...b, target_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pct_surplus">% of monthly surplus</SelectItem>
              <SelectItem value="fixed_monthly">Fixed € per month</SelectItem>
              <SelectItem value="fixed_yearly">Fixed € per year</SelectItem>
              <SelectItem value="goal_by_date">Goal € by date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>
            {b.target_type === "pct_surplus"
              ? `Target: ${b.target_value}%`
              : b.target_type === "goal_by_date"
              ? "Goal amount (€)"
              : "Target amount (€)"}
          </Label>
          {b.target_type === "pct_surplus" ? (
            <Slider value={[Number(b.target_value)]} min={0} max={100} step={1} onValueChange={(v) => setB({ ...b, target_value: v[0] })} className="mt-3" />
          ) : (
            <Input inputMode="decimal" value={b.target_value} onChange={(e) => setB({ ...b, target_value: parseFloat(e.target.value) || 0 })} />
          )}
        </div>
        {b.target_type === "goal_by_date" && (
          <div>
            <Label>Reach by</Label>
            <Input
              type="date"
              value={b.target_deadline ?? ""}
              onChange={(e) => setB({ ...b, target_deadline: e.target.value || null })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Monthly contribution = goal ÷ months remaining.
            </p>
          </div>
        )}
      </div>
      {dirty && <Button size="sm" onClick={() => onSave(b)}>Save changes</Button>}
    </div>
  );
}

function MembersSection({ householdId }: { householdId: string }) {
  const invite = useServerFn(inviteMember);
  const { data: members } = useQuery({
    queryKey: ["members", householdId],
    queryFn: async () => {
      const { data: hm } = await supabase.from("household_members").select("user_id, role, joined_at").eq("household_id", householdId);
      if (!hm?.length) return [];
      const ids = hm.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      return hm.map((m) => ({ ...m, profile: profiles?.find((p) => p.user_id === m.user_id) }));
    },
  });
  const { data: invites, refetch } = useQuery({
    queryKey: ["invites", householdId],
    queryFn: async () => {
      const { data } = await supabase.from("household_invitations").select("*").eq("household_id", householdId).is("accepted_at", null).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function send() {
    if (!email) return;
    try {
      await invite({ data: { household_id: householdId, email } });
      setEmail("");
      toast.success("Invitation created — share the link below");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household members</CardTitle>
        <CardDescription>Both adults see the same budget. Invite your partner with a shareable link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex justify-between py-2">
              <span>{m.profile?.display_name ?? "Member"}</span>
              <span className="text-xs uppercase text-muted-foreground">{m.role}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <Input type="email" placeholder="partner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={send}><Mail /> Create invite link</Button>
        </div>
        {!!invites?.length && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pending invites</p>
            <ul className="space-y-2">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{i.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{inviteLink(i.token)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(i.token)}>
                    {copied === i.token ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
