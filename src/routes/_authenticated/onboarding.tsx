import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold, updateHousehold, completeOnboarding } from "@/lib/household.functions";
import {
  upsertIncome,
  upsertFixedExpense,
  upsertVariableEstimate,
  upsertDebt,
  upsertBucket,
} from "@/lib/budget.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatementImportButton } from "@/components/statement-import-flow";
import { money } from "@/lib/format";
import { Plus, Loader2, Check, PiggyBank, Wallet, Receipt, Home, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome · Myntra" }] }),
  component: OnboardingPage,
});

const COUNTRIES = [
  ["PT", "Portugal"],
  ["ES", "Spain"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["IE", "Ireland"],
  ["BE", "Belgium"],
  ["AT", "Austria"],
  ["LU", "Luxembourg"],
] as const;

const STEPS = [
  "welcome",
  "country",
  "household",
  "income",
  "fixed",
  "variable",
  "debt",
  "projects",
] as const;

function OnboardingPage() {
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  if (!householdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Wizard householdId={householdId} initialCountry={hh?.household?.country ?? "PT"} />;
}

function Wizard({ householdId, initialCountry }: { householdId: string; initialCountry: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateHh = useServerFn(updateHousehold);
  const finishFn = useServerFn(completeOnboarding);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(initialCountry);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const key = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function next() {
    setBusy(true);
    try {
      if (key === "country") await updateHh({ data: { household_id: householdId, country } });
      if (key === "household")
        await updateHh({ data: { household_id: householdId, adults, children } });
      qc.invalidateQueries();
      if (isLast) {
        await finish();
        return;
      }
      setStep((s) => s + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await finishFn({ data: { household_id: householdId } });
      // Await the household refetch so onboarded_at is fresh before navigating,
      // otherwise the shell's guard could bounce us back to /onboarding.
      await qc.invalidateQueries({ queryKey: ["household"] });
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  const back = () => setStep((s) => Math.max(0, s - 1));
  const skip = () => (isLast ? finish() : setStep((s) => s + 1));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 py-8">
        <Progress value={(step / (STEPS.length - 1)) * 100} className="mb-8" />

        <div className="flex-1">
          {key === "welcome" && <Welcome />}
          {key === "country" && <CountryStep country={country} setCountry={setCountry} />}
          {key === "household" && (
            <HouseholdStep
              adults={adults}
              setAdults={setAdults}
              children={children}
              setChildren={setChildren}
            />
          )}
          {key === "income" && <IncomeStep householdId={householdId} />}
          {key === "fixed" && <FixedStep householdId={householdId} />}
          {key === "variable" && <VariableStep householdId={householdId} />}
          {key === "debt" && <DebtStep householdId={householdId} />}
          {key === "projects" && <ProjectsStep householdId={householdId} />}
        </div>

        <div className="mt-8 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={back} disabled={step === 0 || busy}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            {key !== "welcome" && (
              <Button variant="ghost" onClick={skip} disabled={busy}>
                Skip
              </Button>
            )}
            <Button onClick={next} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {key === "welcome" ? "Get started" : isLast ? "Finish" : "Continue"}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can skip anything and change it later in Settings.
        </p>
      </div>
    </div>
  );
}

// ---- Step chrome ----------------------------------------------------------

function StepHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Welcome() {
  return (
    <div className="space-y-4 pt-6">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <h1 className="font-display text-3xl">Welcome — let's set up your budget</h1>
      <p className="text-muted-foreground">
        A few quick questions to get you started. You can skip any of them and fill things in later
        in Settings — and you can even upload a bank statement to fill most of it automatically.
      </p>
    </div>
  );
}

function CountryStep({ country, setCountry }: { country: string; setCountry: (v: string) => void }) {
  return (
    <div>
      <StepHead icon={Home} title="Where are you based?" subtitle="Used for currency and to compare against national averages." />
      <Select value={country} onValueChange={setCountry}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map(([code, name]) => (
            <SelectItem key={code} value={code}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stepper({ label, value, setValue, min }: { label: string; value: number; setValue: (v: number) => void; min: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setValue(Math.max(min, value - 1))}>
          −
        </Button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <Button variant="outline" size="icon" onClick={() => setValue(value + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}

function HouseholdStep({
  adults,
  setAdults,
  children,
  setChildren,
}: {
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
}) {
  return (
    <div>
      <StepHead icon={Users} title="Tell us about your household" subtitle="This tailors budgets and comparisons to your size." />
      <div className="space-y-3">
        <Stepper label="Adults" value={adults} setValue={setAdults} min={1} />
        <Stepper label="Children" value={children} setValue={setChildren} min={0} />
      </div>
    </div>
  );
}

// ---- Entry-list steps -----------------------------------------------------

function EntryList({ items }: { items: Array<{ id: string; label: string; monthly_amount: number | string }> }) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 divide-y rounded-xl border">
      {items.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="tabular-nums font-medium">{money(Number(r.monthly_amount))}/mo</span>
        </li>
      ))}
    </ul>
  );
}

type ListRow = { id: string; label: string; monthly_amount: number };

function useList(table: "incomes" | "fixed_expenses" | "variable_estimates" | "debts", householdId: string) {
  return useQuery({
    queryKey: [`ob-${table}`, householdId],
    queryFn: async () => {
      // Dynamic table name — cast the read so the union doesn't trip the typings.
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => { order: (c: string) => Promise<{ data: ListRow[] | null }> };
          };
        };
      };
      const { data } = await client
        .from(table)
        .select("id, label, monthly_amount")
        .eq("household_id", householdId)
        .order("created_at");
      return (data ?? []) as ListRow[];
    },
  });
}

function IncomeStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(upsertIncome);
  const { data: items = [] } = useList("incomes", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({ data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 } });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-incomes", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead icon={Wallet} title="What comes in each month?" subtitle="Add your salary and any other regular income." />
      <div className="flex gap-2">
        <Input placeholder="e.g. Salary" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="w-28" inputMode="decimal" placeholder="€/mo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

function FixedStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(upsertFixedExpense);
  const { data: items = [] } = useList("fixed_expenses", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({ data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 } });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-fixed_expenses", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead icon={Home} title="Fixed monthly costs" subtitle="Rent, utilities, subscriptions, insurance — the bills that repeat. (Debts come next.)" />
      <div className="mb-3">
        <StatementImportButton householdId={householdId} />
        <span className="ml-2 text-xs text-muted-foreground">or add manually below</span>
      </div>
      <div className="flex gap-2">
        <Input placeholder="e.g. Rent" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="w-28" inputMode="decimal" placeholder="€/mo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

function VariableStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(upsertVariableEstimate);
  const { data: items = [] } = useList("variable_estimates", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({ data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 } });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-variable_estimates", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead icon={Receipt} title="Estimated variable spending" subtitle="Rough monthly averages — groceries, transport, dining. Or deduce them from a statement." />
      <div className="mb-3">
        <StatementImportButton householdId={householdId} />
        <span className="ml-2 text-xs text-muted-foreground">or estimate manually below</span>
      </div>
      <div className="flex gap-2">
        <Input placeholder="e.g. Groceries" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="w-28" inputMode="decimal" placeholder="€/mo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

function DebtStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(upsertDebt);
  const { data: items = [] } = useList("debts", householdId);
  const [label, setLabel] = useState("");
  const [monthly, setMonthly] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [maturity, setMaturity] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !monthly) return;
    setSaving(true);
    try {
      await add({
        data: {
          household_id: householdId,
          label,
          kind: "other",
          monthly_amount: parseFloat(monthly) || 0,
          taeg_pct: rate ? parseFloat(rate) : null,
          principal_remaining: principal ? parseFloat(principal) : null,
          maturity_date: maturity || null,
        },
      });
      setLabel("");
      setMonthly("");
      setPrincipal("");
      setRate("");
      setMaturity("");
      qc.invalidateQueries({ queryKey: ["ob-debts", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead icon={Wallet} title="Any loans or credit?" subtitle="Mortgage, car loan, credit lines. Add the monthly payment; principal, rate and maturity power the payoff tools." />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="e.g. Mortgage" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="w-28" inputMode="decimal" placeholder="€/mo" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Principal €" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          <Input className="w-24" inputMode="decimal" placeholder="Rate %" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} />
          <Button onClick={submit} disabled={saving || !label || !monthly}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
      </div>
      <EntryList items={items} />
    </div>
  );
}

// ---- Projects / allocations ----------------------------------------------

type Suggestion = { name: string; target_type: "pct_surplus" | "fixed_monthly"; target_value: number; why: string };

function ProjectsStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(upsertBucket);

  const { data } = useQuery({
    queryKey: ["ob-projects", householdId],
    queryFn: async () => {
      const [inc, fx, ve, dt, bk] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
        supabase.from("variable_estimates").select("monthly_amount").eq("household_id", householdId),
        supabase.from("debts").select("monthly_amount").eq("household_id", householdId),
        supabase.from("buckets").select("id, name").eq("household_id", householdId).order("sort_order"),
      ]);
      const sum = (rows: Array<{ monthly_amount: number | string }> | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
      const surplus = Math.max(
        0,
        sum(inc.data) - sum(fx.data) - sum(ve.data) - sum(dt.data),
      );
      const { data: hh } = await supabase.from("households").select("children").eq("id", householdId).maybeSingle();
      return { surplus, buckets: bk.data ?? [], children: hh?.children ?? 0 };
    },
  });

  const surplus = data?.surplus ?? 0;
  const existing = new Set((data?.buckets ?? []).map((b) => b.name.toLowerCase()));

  const suggestions: Suggestion[] = [
    { name: "Emergency fund", target_type: "pct_surplus", target_value: 30, why: "Aim for 3–6 months of expenses." },
    { name: "Investments", target_type: "pct_surplus", target_value: 20, why: "Long-term growth." },
    { name: "Holidays", target_type: "fixed_monthly", target_value: Math.max(25, Math.round((surplus * 0.1) / 5) * 5), why: "Set aside a little each month." },
    ...(data && data.children > 0
      ? [{ name: "Kids & education", target_type: "fixed_monthly" as const, target_value: Math.max(25, Math.round((surplus * 0.15) / 5) * 5), why: "For childcare, school and activities." }]
      : []),
  ];

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  async function addBucket(s: { name: string; target_type: Suggestion["target_type"]; target_value: number; initial_balance?: number }) {
    await add({
      data: {
        household_id: householdId,
        name: s.name,
        target_type: s.target_type,
        target_value: s.target_value,
        initial_balance: s.initial_balance ?? 0,
      },
    });
    qc.invalidateQueries({ queryKey: ["ob-projects", householdId] });
  }

  async function submitCustom() {
    if (!name) return;
    setSaving(true);
    try {
      await addBucket({
        name,
        target_type: "fixed_monthly",
        target_value: parseFloat(target) || 0,
        initial_balance: parseFloat(balance) || 0,
      });
      setName("");
      setBalance("");
      setTarget("");
    } finally {
      setSaving(false);
    }
  }

  const monthlyFor = (s: Suggestion) =>
    s.target_type === "pct_surplus" ? (surplus * s.target_value) / 100 : s.target_value;

  return (
    <div>
      <StepHead icon={PiggyBank} title="What are you saving for?" subtitle={`Projects hold money toward goals. You have about ${money(surplus)}/mo of surplus to allocate.`} />

      <p className="mb-2 text-sm font-medium">Suggested for you</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => {
          const added = existing.has(s.name.toLowerCase());
          return (
            <button
              key={s.name}
              disabled={added}
              onClick={() => addBucket(s)}
              className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                {added ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Plus className="size-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{s.why}</p>
              <p className="mt-1 text-xs tabular-nums">~{money(monthlyFor(s))}/mo</p>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-6 text-sm font-medium">Or add your own</p>
      <div className="space-y-2">
        <Input placeholder="Project name (e.g. New car)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Current balance €" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <Input inputMode="decimal" placeholder="Monthly target €" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Button onClick={submitCustom} disabled={saving || !name}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
      </div>

      {(data?.buckets.length ?? 0) > 0 && (
        <ul className="mt-4 divide-y rounded-xl border">
          {data!.buckets.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-4 py-2 text-sm">
              <PiggyBank className="size-4 text-muted-foreground" /> {b.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
