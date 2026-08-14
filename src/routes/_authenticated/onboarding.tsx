import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateHousehold,
  updateHousehold,
  completeOnboarding,
} from "@/lib/household.functions";
import {
  upsertIncome,
  upsertFixedExpense,
  upsertVariableEstimate,
  upsertDebt,
  upsertBucket,
} from "@/lib/budget.functions";
import { upsertPlan } from "@/lib/plan.functions";
import { upsertAsset, ASSET_KINDS } from "@/lib/assets.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { CYCLES, type Cycle } from "@/lib/cadence";
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
import { CoachOnboarding } from "@/components/coach-onboarding";
import { money, currencySymbol } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { AGE_BANDS } from "@/lib/benchmarks";
import { groupSectors, NACE_SECTIONS } from "@/lib/business-benchmarks";
import { debtKindOptions, type DebtKind } from "@/lib/debt-kinds";
import { useCategories, useCategoryMutations } from "@/hooks/use-categories";
import { buildSetupPresets } from "@/lib/setup-presets";

import {
  Plus,
  Loader2,
  Check,
  PiggyBank,
  Wallet,
  Receipt,
  Home,
  Users,
  Sparkles,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Gem,
  Building2,
  Info,
  Tags,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () =>
    pageMeta({
      path: "/onboarding",
      title: "Get started · bynku",
      description:
        "Set up your cycle, income, bills and projects so bynku can compute your daily safe-to-spend.",
      noindex: true,
    }),
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
  "whereWho",
  "country",
  "business",
  "income",
  "cycle",
  "preset",
  "fixed",
  "variable",
  "margin",
  // Deferred to the dashboard checklist — these editors stay defined (and are
  // still referenced in the render switch so they keep compiling and can be
  // reached from the preset's "enter my own" path), but are filtered out of the
  // default flow so nobody is blocked by them.
  "categories",
  "debt",
  "assets",
  "projects",
  "plans",
  "household",
] as const;

// Steps no longer part of the guided flow (moved to the dashboard checklist).
const DEFERRED_STEPS = new Set(["categories", "debt", "assets", "projects", "plans", "household"]);

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
  return (
    <Wizard
      householdId={householdId}
      initialCountry={hh?.household?.country ?? "PT"}
      initialMargin={Number(hh?.household?.margin_pct ?? 10)}
      kind={(hh?.household?.kind as "personal" | "business") ?? "personal"}
    />
  );
}

function Wizard({
  householdId,
  initialCountry,
  initialMargin,
  kind,
}: {
  householdId: string;
  initialCountry: string;
  initialMargin: number;
  kind: "personal" | "business";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const updateHh = useServerFn(updateHousehold);
  const finishFn = useServerFn(completeOnboarding);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState(false);
  const [country, setCountry] = useState(initialCountry);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [ageBand, setAgeBand] = useState<string>("");
  const [cycleLen, setCycleLen] = useState<Cycle>(kind === "business" ? "quarterly" : "monthly");
  const [fiscalStart, setFiscalStart] = useState("");
  const [sector, setSector] = useState("");
  const [employees, setEmployees] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [margin, setMargin] = useState(initialMargin);
  const [cycleMode, setCycleMode] = useState<"event" | "time">("event");
  const [housing, setHousing] = useState("");

  const isBusiness = kind === "business";
  // A business space skips the household (adults/children) demographics step but
  // gets a fiscal-cycle step and an "about your business" step (sector, employees,
  // advisor) that power the benchmarks and accountant handoff; personal spaces are
  // the reverse (their cycle is payday-driven, so there's nothing to configure).
  const steps = STEPS.filter((s) => {
    if (DEFERRED_STEPS.has(s)) return false;
    // Personal-only: combined where/who step and the generated starting plan.
    if (s === "whereWho" || s === "preset") return !isBusiness;
    // Business-only: standalone country + "about your business".
    if (s === "country" || s === "business") return isBusiness;
    return true; // welcome, income, cycle, fixed, variable, margin
  });
  const key = steps[Math.min(step, steps.length - 1)];
  const isLast = step === steps.length - 1;

  // Remember where the user got to, so re-entering the wizard resumes there
  // instead of restarting at the welcome screen.
  const stepKey = `bynku.onboarding.step.${householdId}`;
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(stepKey));
      if (Number.isFinite(v) && v > 0 && v < steps.length) setStep(v);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(stepKey, String(step));
    } catch {
      /* ignore */
    }
  }, [step, stepKey]);

  async function next() {
    setBusy(true);
    try {
      if (key === "country") await updateHh({ data: { household_id: householdId, country } });
      if (key === "whereWho")
        await updateHh({
          data: {
            household_id: householdId,
            country,
            adults,
            children,
            age_band: (ageBand || null) as
              | "under35"
              | "35_44"
              | "45_54"
              | "55_64"
              | "65_74"
              | "75plus"
              | null,
          },
        });
      if (key === "cycle") {
        if (isBusiness) {
          await updateHh({
            data: {
              household_id: householdId,
              cycle_mode: "time",
              cycle: cycleLen,
              cycle_anchor_date: fiscalStart || null,
            },
          });
        } else if (cycleMode === "time") {
          // Personal, fixed day: a monthly time cycle anchored on the chosen date.
          await updateHh({
            data: {
              household_id: householdId,
              cycle_mode: "time",
              cycle: cycleLen,
              cycle_anchor_date: fiscalStart || null,
            },
          });
        } else {
          // Personal, payday-anchored: event mode (rolls when pay is recorded).
          await updateHh({
            data: {
              household_id: householdId,
              cycle_mode: "event",
              cycle: cycleLen,
              cycle_anchor_date: null,
            },
          });
        }
      }
      if (key === "business")
        await updateHh({
          data: {
            household_id: householdId,
            sector: sector || null,
            employees: employees ? Math.max(0, Math.round(parseFloat(employees))) : 0,
            advisor_email: advisorEmail.trim() || null,
          },
        });
      if (key === "margin")
        await updateHh({ data: { household_id: householdId, margin_pct: margin } });
      if (key === "household")
        await updateHh({
          data: {
            household_id: householdId,
            adults,
            children,
            age_band: (ageBand || null) as
              | "under35"
              | "35_44"
              | "45_54"
              | "55_64"
              | "65_74"
              | "75plus"
              | null,
          },
        });
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
      try {
        localStorage.removeItem(stepKey);
      } catch {
        /* ignore */
      }
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

  if (chat) {
    return (
      <CoachOnboarding
        householdId={householdId}
        isBusiness={isBusiness}
        onSwitchToForms={() => setChat(false)}
        onDone={finish}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 py-8">
        <Progress value={(step / (steps.length - 1)) * 100} className="mb-8" />

        <div className="flex-1">
          {key === "welcome" && (
            <div>
              <Welcome isBusiness={isBusiness} householdId={householdId} />
              <button
                type="button"
                onClick={() => setChat(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="size-4" /> {t("coachOb.entryTitle")}
              </button>
            </div>
          )}
          {key === "country" && (
            <CountryStep country={country} setCountry={setCountry} isBusiness={isBusiness} />
          )}
          {key === "whereWho" && (
            <WhereWhoStep
              country={country}
              setCountry={setCountry}
              adults={adults}
              setAdults={setAdults}
              children={children}
              setChildren={setChildren}
              ageBand={ageBand}
              setAgeBand={setAgeBand}
            />
          )}
          {key === "preset" && (
            <PresetStep
              householdId={householdId}
              country={country}
              adults={adults}
              children={children}
              housing={housing}
              onEnterOwn={() => setStep((s) => s + 1)}
              onFinish={finish}
            />
          )}
          {key === "cycle" && (
            <CycleStep
              isBusiness={isBusiness}
              cycleMode={cycleMode}
              setCycleMode={setCycleMode}
              cycleLen={cycleLen}
              setCycleLen={setCycleLen}
              fiscalStart={fiscalStart}
              setFiscalStart={setFiscalStart}
            />
          )}
          {key === "business" && (
            <BusinessStep
              sector={sector}
              setSector={setSector}
              employees={employees}
              setEmployees={setEmployees}
              advisorEmail={advisorEmail}
              setAdvisorEmail={setAdvisorEmail}
            />
          )}
          {key === "household" && (
            <HouseholdStep
              adults={adults}
              setAdults={setAdults}
              children={children}
              setChildren={setChildren}
              ageBand={ageBand}
              setAgeBand={setAgeBand}
            />
          )}
          {key === "categories" && (
            <CategoriesStep householdId={householdId} isBusiness={isBusiness} />
          )}
          {key === "income" && (
            <IncomeStep
              householdId={householdId}
              isBusiness={isBusiness}
              housing={housing}
              setHousing={setHousing}
            />
          )}
          {key === "fixed" && <FixedStep householdId={householdId} />}
          {key === "variable" && <VariableStep householdId={householdId} isBusiness={isBusiness} />}
          {key === "margin" && <MarginStep margin={margin} setMargin={setMargin} />}
          {key === "debt" && <DebtStep householdId={householdId} isBusiness={isBusiness} />}
          {key === "assets" && <AssetsStep householdId={householdId} isBusiness={isBusiness} />}
          {key === "projects" && <ProjectsStep householdId={householdId} isBusiness={isBusiness} />}
          {key === "plans" && <PlansStep householdId={householdId} isBusiness={isBusiness} />}
        </div>

        <div className="mt-8 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={back} disabled={step === 0 || busy}>
            {t("ob.back")}
          </Button>
          {key !== "preset" && (
            <div className="flex items-center gap-2">
              {key !== "welcome" && (
                <Button variant="ghost" onClick={skip} disabled={busy}>
                  {t("ob.skip")}
                </Button>
              )}
              <Button onClick={next} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {key === "welcome" ? t("ob.getStarted") : isLast ? t("ob.finish") : t("ob.continue")}
              </Button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">{t("ob.skipHint")}</p>
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

// A rich "why we ask this" note: what it is, why it helps bynku, and a nudge if
// unsure. Keeps the wizard instructive without cluttering the main input.
function StepInfo({ body }: { body: string }) {
  return (
    <div className="mb-5 flex gap-2 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{body}</p>
    </div>
  );
}

function CategoriesStep({
  householdId,
  isBusiness,
}: {
  householdId: string;
  isBusiness: boolean;
}) {
  const t = useT();
  const { data: cats = [] } = useCategories(householdId);
  const { add, remove } = useCategoryMutations(householdId);
  const [name, setName] = useState("");

  function submit() {
    const clean = name.trim();
    if (!clean) return;
    add.mutate(clean, { onSuccess: () => setName("") });
  }

  return (
    <div>
      <StepHead
        icon={Tags}
        title={t("ob.categories.title")}
        subtitle={t(isBusiness ? "ob.categories.subtitleBiz" : "ob.categories.subtitle")}
      />
      <StepInfo body={t("ob.categories.info")} />
      <div className="mb-4 flex gap-2">
        <Input
          placeholder={t("ob.categories.addPh")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button onClick={submit} disabled={!name.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      {cats.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ob.categories.empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm"
            >
              {c.name}
              <button
                type="button"
                aria-label={t("ob.categories.remove", { name: c.name })}
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => remove.mutate({ id: c.id, name: c.name })}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MarginStep({ margin, setMargin }: { margin: number; setMargin: (n: number) => void }) {
  const t = useT();
  return (
    <div>
      <StepHead icon={PiggyBank} title={t("ob.margin.title")} subtitle={t("ob.margin.subtitle")} />
      <StepInfo body={t("ob.margin.info")} />
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={margin}
          onChange={(e) => setMargin(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer accent-primary"
          aria-label={t("ob.margin.title")}
        />
        <span className="w-12 text-right font-display text-xl tabular-nums">{margin}%</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("ob.margin.hint")}</p>
    </div>
  );
}

function Welcome({ isBusiness, householdId }: { isBusiness: boolean; householdId: string }) {
  const t = useT();
  return (
    <div className="space-y-4 pt-6">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <h1 className="font-display text-3xl">
        {t(isBusiness ? "ob.welcome.titleBiz" : "ob.welcome.title")}
      </h1>
      <p className="text-muted-foreground">
        {t(isBusiness ? "ob.welcome.bodyBiz" : "ob.welcome.body")}
      </p>
      <StatementFastLane householdId={householdId} />
    </div>
  );
}

// The bank-statement fast lane, promoted plainly: upload instead of typing, and
// confirm everything before it's saved.
function StatementFastLane({ householdId }: { householdId: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-medium">{t("ob.statement.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("ob.statement.body")}</p>
      <div className="mt-3">
        <StatementImportButton householdId={householdId} />
      </div>
    </div>
  );
}

function CountryStep({
  country,
  setCountry,
  isBusiness,
}: {
  country: string;
  setCountry: (v: string) => void;
  isBusiness: boolean;
}) {
  const t = useT();
  return (
    <div>
      <StepHead
        icon={Home}
        title={t(isBusiness ? "ob.country.titleBiz" : "ob.country.title")}
        subtitle={t("ob.country.subtitle")}
      />
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

function CycleStep({
  isBusiness,
  cycleMode,
  setCycleMode,
  cycleLen,
  setCycleLen,
  fiscalStart,
  setFiscalStart,
}: {
  isBusiness: boolean;
  cycleMode: "event" | "time";
  setCycleMode: (v: "event" | "time") => void;
  cycleLen: Cycle;
  setCycleLen: (v: Cycle) => void;
  fiscalStart: string;
  setFiscalStart: (v: string) => void;
}) {
  const t = useT();

  if (isBusiness) {
    return (
      <div>
        <StepHead icon={CalendarClock} title={t("ob.cycle.title")} subtitle={t("ob.cycle.subtitle")} />
        <StepInfo body={t("ob.cycle.infoBiz")} />
        <div className="space-y-4">
          <div>
            <Label>{t("ob.cycle.lengthLabel")}</Label>
            <Select value={cycleLen} onValueChange={(v) => setCycleLen(v as Cycle)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`cadence.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("ob.cycle.fiscalLabel")}</Label>
            <Input type="date" value={fiscalStart} onChange={(e) => setFiscalStart(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{t("ob.cycle.fiscalHint")}</p>
          </div>
        </div>
      </div>
    );
  }

  const choiceClass = (active: boolean) =>
    `flex flex-col items-start gap-0.5 rounded-xl border p-4 text-left transition-colors ${
      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
    }`;

  return (
    <div>
      <StepHead
        icon={CalendarClock}
        title={t("ob.cycle.title")}
        subtitle={t("ob.cycle.subtitlePersonal")}
      />
      <StepInfo body={t("ob.cycle.infoPersonal")} />
      <div className="grid gap-3">
        <button type="button" onClick={() => setCycleMode("event")} className={choiceClass(cycleMode === "event")}>
          <span className="font-medium">{t("ob.cycle.eventTitle")}</span>
          <span className="text-xs text-muted-foreground">{t("ob.cycle.eventBody")}</span>
        </button>
        <button type="button" onClick={() => setCycleMode("time")} className={choiceClass(cycleMode === "time")}>
          <span className="font-medium">{t("ob.cycle.dateTitle")}</span>
          <span className="text-xs text-muted-foreground">{t("ob.cycle.dateBody")}</span>
        </button>
      </div>
      <div className="mt-4">
        <Label>{t("ob.cycle.lengthLabel")}</Label>
        <Select value={cycleLen} onValueChange={(v) => setCycleLen(v as Cycle)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CYCLES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`cadence.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">{t("ob.cycle.lengthHint")}</p>
      </div>
      {cycleMode === "time" && (
        <div className="mt-4">
          <Label>{t("ob.cycle.dateLabel")}</Label>
          <Input type="date" value={fiscalStart} onChange={(e) => setFiscalStart(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.cycle.dateHint")}</p>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  setValue,
  min,
}: {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
}) {
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

function BusinessStep({
  sector,
  setSector,
  employees,
  setEmployees,
  advisorEmail,
  setAdvisorEmail,
}: {
  sector: string;
  setSector: (v: string) => void;
  employees: string;
  setEmployees: (v: string) => void;
  advisorEmail: string;
  setAdvisorEmail: (v: string) => void;
}) {
  const t = useT();
  return (
    <div>
      <StepHead
        icon={Building2}
        title={t("ob.business.title")}
        subtitle={t("ob.business.subtitle")}
      />
      <div className="space-y-4">
        <div>
          <Label>{t("ob.business.sectorLabel")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="">{t("ob.business.sectorPh")}</option>
            {groupSectors().map(([section, sectors]) => (
              <optgroup key={section} label={NACE_SECTIONS[section] ?? section}>
                {sectors.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.business.sectorHint")}</p>
        </div>
        <div>
          <Label>{t("ob.business.employeesLabel")}</Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.business.employeesHint")}</p>
        </div>
        <div>
          <Label>{t("ob.business.advisorLabel")}</Label>
          <Input
            type="email"
            value={advisorEmail}
            onChange={(e) => setAdvisorEmail(e.target.value)}
            placeholder="advisor@firm.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.business.advisorHint")}</p>
        </div>
      </div>
    </div>
  );
}

function HouseholdStep({
  adults,
  setAdults,
  children,
  setChildren,
  ageBand,
  setAgeBand,
}: {
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
  ageBand: string;
  setAgeBand: (v: string) => void;
}) {
  const t = useT();
  // "none" is the sentinel for "prefer not to say" (Select can't hold "").
  return (
    <div>
      <StepHead
        icon={Users}
        title={t("ob.household.title")}
        subtitle={t("ob.household.subtitle")}
      />
      <div className="space-y-3">
        <Stepper label={t("ob.household.adults")} value={adults} setValue={setAdults} min={1} />
        <Stepper
          label={t("ob.household.children")}
          value={children}
          setValue={setChildren}
          min={0}
        />
        <div>
          <Label>{t("hh.ageBand")}</Label>
          <Select
            value={ageBand || "none"}
            onValueChange={(v) => setAgeBand(v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("hh.ageBandNone")}</SelectItem>
              {AGE_BANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {t(`hh.ageBand.${b}` as MessageKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t("hh.ageBandHint")}</p>
        </div>
      </div>
    </div>
  );
}

// Combined "where & who" step — country + household size + age band in one.
function WhereWhoStep({
  country,
  setCountry,
  adults,
  setAdults,
  children,
  setChildren,
  ageBand,
  setAgeBand,
}: {
  country: string;
  setCountry: (v: string) => void;
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
  ageBand: string;
  setAgeBand: (v: string) => void;
}) {
  const t = useT();
  return (
    <div>
      <StepHead icon={Users} title={t("ob.whereWho.title")} subtitle={t("ob.whereWho.subtitle")} />
      <div className="space-y-4">
        <div>
          <Label>{t("ob.country.title")}</Label>
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
        <Stepper label={t("ob.household.adults")} value={adults} setValue={setAdults} min={1} />
        <Stepper label={t("ob.household.children")} value={children} setValue={setChildren} min={0} />
        <div>
          <Label>{t("hh.ageBand")}</Label>
          <Select value={ageBand || "none"} onValueChange={(v) => setAgeBand(v === "none" ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("hh.ageBandNone")}</SelectItem>
              {AGE_BANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {t(`hh.ageBand.${b}` as MessageKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t("hh.ageBandHint")}</p>
        </div>
      </div>
    </div>
  );
}

type PresetEditRow = {
  key: string;
  kind: "fixed" | "variable";
  category: string;
  amount: string;
  intent?: "essential" | "important" | "nice_to_have" | "treat";
  estimated: boolean;
};

// The generated "here's your starting plan" step: a benchmark-derived, editable
// budget the user accepts or swaps for manual entry. Rows are written flagged as
// estimates (except a housing figure the user typed).
function PresetStep({
  householdId,
  country,
  adults,
  children,
  housing,
  onEnterOwn,
  onFinish,
}: {
  householdId: string;
  country: string;
  adults: number;
  children: number;
  housing: string;
  onEnterOwn: () => void;
  onFinish: () => void;
}) {
  const t = useT();
  const incomesQ = useList("incomes", householdId);
  const incomes = incomesQ.data ?? [];
  const monthlyIncome = incomes.reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
  const addFixed = useServerFn(upsertFixedExpense);
  const addVariable = useServerFn(upsertVariableEstimate);
  const setHh = useServerFn(updateHousehold);

  const preset = useMemo(
    () =>
      buildSetupPresets({
        country,
        adults,
        children,
        monthlyIncome,
        housingMonthly: housing ? parseFloat(housing) : null,
      }),
    [country, adults, children, monthlyIncome, housing],
  );

  const [rows, setRows] = useState<PresetEditRow[]>([]);
  const [marginPct, setMarginPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || !preset.estimated) return;
    seededRef.current = true;
    setRows([
      ...preset.fixed.map((r) => ({
        key: `f-${r.category}`,
        kind: "fixed" as const,
        category: r.category,
        amount: String(r.monthly_amount),
        intent: r.intent,
        estimated: r.estimated,
      })),
      ...preset.variable.map((r) => ({
        key: `v-${r.category}`,
        kind: "variable" as const,
        category: r.category,
        amount: String(r.monthly_amount),
        estimated: r.estimated,
      })),
    ]);
    setMarginPct(preset.marginPct);
  }, [preset]);

  const catLabel = (c: string) => t(`ob.cat.${c}` as MessageKey);
  const setAmount = (key: string, v: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, amount: v } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  async function useThese() {
    setBusy(true);
    try {
      for (const r of rows) {
        const amt = parseFloat(r.amount) || 0;
        if (amt <= 0) continue;
        if (r.kind === "fixed") {
          await addFixed({
            data: {
              household_id: householdId,
              label: catLabel(r.category),
              category: r.category,
              monthly_amount: amt,
              intent: r.intent,
              is_estimated: r.estimated,
            },
          });
        } else {
          await addVariable({
            data: {
              household_id: householdId,
              label: catLabel(r.category),
              category: r.category,
              monthly_amount: amt,
              is_estimated: r.estimated,
            },
          });
        }
      }
      await setHh({ data: { household_id: householdId, margin_pct: marginPct } });
      onFinish();
    } finally {
      setBusy(false);
    }
  }

  async function enterOwn() {
    setBusy(true);
    try {
      const h = housing ? parseFloat(housing) : 0;
      if (h > 0) {
        await addFixed({
          data: {
            household_id: householdId,
            label: catLabel("housing"),
            category: "housing",
            monthly_amount: h,
            intent: "essential",
            is_estimated: false,
          },
        });
      }
      onEnterOwn();
    } finally {
      setBusy(false);
    }
  }

  if (incomesQ.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No benchmark for this country (or no income entered) — go straight to manual.
  if (!preset.estimated) {
    return (
      <div>
        <StepHead icon={Sparkles} title={t("ob.preset.title")} subtitle={t("ob.preset.subtitleManual")} />
        <StepInfo body={t("ob.preset.manualInfo")} />
        <Button onClick={enterOwn} disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("ob.preset.enterOwn")}
        </Button>
      </div>
    );
  }

  const fixedRows = rows.filter((r) => r.kind === "fixed");
  const variableRows = rows.filter((r) => r.kind === "variable");
  const fixedTotal = fixedRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const variableTotal = variableRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const marginAmt = Math.round((monthlyIncome * marginPct) / 100);

  const renderRow = (r: PresetEditRow) => (
    <li key={r.key} className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{catLabel(r.category)}</span>
      {r.estimated && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {t("ob.preset.estimated")}
        </span>
      )}
      <Input
        className="w-24"
        inputMode="decimal"
        value={r.amount}
        onChange={(e) => setAmount(r.key, e.target.value)}
      />
      <button
        type="button"
        aria-label={t("common.delete")}
        onClick={() => remove(r.key)}
        className="text-muted-foreground transition-colors hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </li>
  );

  return (
    <div>
      <StepHead icon={Sparkles} title={t("ob.preset.title")} subtitle={t("ob.preset.subtitle")} />
      <StepInfo body={t("ob.preset.info")} />
      <div className="mb-5">
        <StatementFastLane householdId={householdId} />
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("ob.preset.fixedHead")}
      </p>
      <ul className="divide-y rounded-xl border">{fixedRows.map(renderRow)}</ul>

      <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("ob.preset.variableHead")}
      </p>
      <ul className="divide-y rounded-xl border">{variableRows.map(renderRow)}</ul>

      <div className="mt-4 space-y-1 rounded-xl border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ob.preset.fixedTotal")}</span>
          <span className="tabular-nums font-medium">{money(fixedTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ob.preset.variableTotal")}</span>
          <span className="tabular-nums font-medium">{money(variableTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ob.preset.marginLine", { pct: String(marginPct) })}</span>
          <span className="tabular-nums font-medium">{money(marginAmt)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={useThese} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}
          {t("ob.preset.useThese")}
        </Button>
        <Button variant="ghost" onClick={enterOwn} disabled={busy}>
          {t("ob.preset.enterOwn")}
        </Button>
      </div>
    </div>
  );
}

// ---- Entry-list steps -----------------------------------------------------

function EntryList({
  items,
}: {
  items: Array<{ id: string; label: string; monthly_amount: number | string }>;
}) {
  const t = useT();
  if (!items.length) return null;
  return (
    <ul className="mt-4 divide-y rounded-xl border">
      {items.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="tabular-nums font-medium">
            {money(Number(r.monthly_amount))}
            {t("common.perMonthShort")}
          </span>
        </li>
      ))}
    </ul>
  );
}

type ListRow = { id: string; label: string; monthly_amount: number };

function useList(
  table: "incomes" | "fixed_expenses" | "variable_estimates" | "debts",
  householdId: string,
) {
  return useQuery({
    queryKey: [`ob-${table}`, householdId],
    queryFn: async () => {
      // Dynamic table name — cast the read so the union doesn't trip the typings.
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => { order: (c: string) => Promise<{ data: ListRow[] | null }> };
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

function IncomeStep({
  householdId,
  isBusiness,
  housing,
  setHousing,
}: {
  householdId: string;
  isBusiness: boolean;
  housing?: string;
  setHousing?: (v: string) => void;
}) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertIncome);
  const { data: items = [] } = useList("incomes", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({
        data: {
          household_id: householdId,
          label,
          monthly_amount: parseFloat(amount) || 0,
          // Tag the first personal income as salary (the usual case) so payday
          // cycles, the coach and retirement planning have a salary signal from
          // the start. It can be re-typed later in Money In.
          type: isBusiness ? undefined : items.length === 0 ? "salary" : "other",
        },
      });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-incomes", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead
        icon={Wallet}
        title={t(isBusiness ? "ob.income.titleBiz" : "ob.income.title")}
        subtitle={t(isBusiness ? "ob.income.subtitleBiz" : "ob.income.subtitle")}
      />
      <StepInfo body={t("ob.income.info")} />
      <div className="mb-3">
        <StatementImportButton householdId={householdId} />
        <span className="ml-2 text-xs text-muted-foreground">{t("ob.orAddManually")}</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={t(isBusiness ? "ob.income.namePhBiz" : "ob.income.namePh")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          className="w-28"
          inputMode="decimal"
          placeholder={t("ob.amountPh", { sym })}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
      {!isBusiness && setHousing && (
        <div className="mt-6">
          <Label htmlFor="ob-housing">{t("ob.income.housingLabel")}</Label>
          <Input
            id="ob-housing"
            className="mt-1 w-40"
            inputMode="decimal"
            placeholder={t("ob.amountPh", { sym })}
            value={housing ?? ""}
            onChange={(e) => setHousing(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.income.housingHint")}</p>
        </div>
      )}
    </div>
  );
}

function FixedStep({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertFixedExpense);
  const { data: items = [] } = useList("fixed_expenses", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({
        data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 },
      });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-fixed_expenses", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead icon={Home} title={t("ob.fixed.title")} subtitle={t("ob.fixed.subtitle")} />
      <StepInfo body={t("ob.fixed.info")} />
      <div className="mb-3">
        <StatementImportButton householdId={householdId} />
        <span className="ml-2 text-xs text-muted-foreground">{t("ob.orAddManually")}</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={t("ob.fixed.namePh")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          className="w-28"
          inputMode="decimal"
          placeholder={t("ob.amountPh", { sym })}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

function VariableStep({ householdId, isBusiness }: { householdId: string; isBusiness: boolean }) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertVariableEstimate);
  const { data: items = [] } = useList("variable_estimates", householdId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({
        data: { household_id: householdId, label, monthly_amount: parseFloat(amount) || 0 },
      });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-variable_estimates", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead
        icon={Receipt}
        title={t("ob.variable.title")}
        subtitle={t(isBusiness ? "ob.variable.subtitleBiz" : "ob.variable.subtitle")}
      />
      <StepInfo body={t("ob.variable.info")} />
      <div className="mb-3">
        <StatementImportButton householdId={householdId} />
        <span className="ml-2 text-xs text-muted-foreground">{t("ob.orEstimateManually")}</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={t(isBusiness ? "ob.variable.namePhBiz" : "ob.variable.namePh")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          className="w-28"
          inputMode="decimal"
          placeholder={t("ob.amountPh", { sym })}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button onClick={submit} disabled={saving || !label || !amount}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

function DebtStep({ householdId, isBusiness }: { householdId: string; isBusiness: boolean }) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertDebt);
  const { data: items = [] } = useList("debts", householdId);
  const [label, setLabel] = useState("");
  const [monthly, setMonthly] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [maturity, setMaturity] = useState("");
  const [dkind, setDkind] = useState<DebtKind>(isBusiness ? "business_loan" : "other");
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const kindOptions = debtKindOptions(t, isBusiness);

  async function submit() {
    if (!label || !monthly) return;
    setSaving(true);
    try {
      await add({
        data: {
          household_id: householdId,
          label,
          kind: dkind,
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
      setDkind(isBusiness ? "business_loan" : "other");
      qc.invalidateQueries({ queryKey: ["ob-debts", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead
        icon={Wallet}
        title={t(isBusiness ? "ob.debt.titleBiz" : "ob.debt.title")}
        subtitle={t(isBusiness ? "ob.debt.subtitleBiz" : "ob.debt.subtitle")}
      />
      <StepInfo body={t("ob.debt.info")} />
      <div className="space-y-3">
        <div>
          <Label className="text-xs">{t("ob.debt.whatLabel")}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={t(isBusiness ? "ob.debt.namePhBiz" : "ob.debt.namePh")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Input
              className="w-28"
              inputMode="decimal"
              placeholder={t("ob.debt.monthlyPh", { sym })}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">{t("ob.debt.kindLabel")}</Label>
          <Select value={dkind} onValueChange={(v) => setDkind(v as DebtKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showDetails ? t("ob.debt.hideDetails") : t("ob.debt.moreDetails")}
        </button>
        {showDetails && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t("ob.debt.balanceLabel")}</Label>
              <Input
                inputMode="decimal"
                placeholder={t("ob.amountPh", { sym })}
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("ob.debt.rateLabel")}</Label>
              <Input
                inputMode="decimal"
                placeholder={t("ob.debt.ratePh")}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("ob.debt.maturityLabel")}</Label>
              <Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} />
            </div>
          </div>
        )}
        <Button className="w-full" onClick={submit} disabled={saving || !label || !monthly}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Plus className="size-4" /> {t("ob.debt.addBtn")}
            </>
          )}
        </Button>
      </div>
      <EntryList items={items} />
    </div>
  );
}

// ---- Assets ---------------------------------------------------------------

function AssetsStep({ householdId, isBusiness }: { householdId: string; isBusiness: boolean }) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertAsset);
  const { data: items = [] } = useQuery({
    queryKey: ["ob-assets", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, name, kind, current_value")
        .eq("household_id", householdId)
        .order("created_at");
      return (data ?? []) as Array<{
        id: string;
        name: string;
        kind: string;
        current_value: number;
      }>;
    },
  });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof ASSET_KINDS)[number]>("property");
  const [current, setCurrent] = useState("");
  const [acquired, setAcquired] = useState("");
  const [acquiredOn, setAcquiredOn] = useState("");
  const [deprYears, setDeprYears] = useState("");
  const [saving, setSaving] = useState(false);

  const KIND_LABEL: Record<string, string> = {
    cash: t("assets.kindCash"),
    property: t("assets.kindProperty"),
    land: t("assets.kindLand"),
    vehicle: t("assets.kindVehicle"),
    stocks: t("assets.kindStocks"),
    bonds: t("assets.kindBonds"),
    fund: t("assets.kindFund"),
    business: t("assets.kindBusiness"),
    other: t("assets.kindOther"),
  };

  async function submit() {
    if (!name || !current) return;
    setSaving(true);
    try {
      await add({
        data: {
          household_id: householdId,
          name,
          kind,
          acquired_value: acquired ? parseFloat(acquired.replace(",", ".")) : null,
          acquired_on: acquiredOn || null,
          current_value: parseFloat(current.replace(",", ".")) || 0,
          ...(isBusiness && deprYears && parseFloat(deprYears) > 0
            ? {
                depreciation_method: "straight_line" as const,
                useful_life_months: Math.round(parseFloat(deprYears) * 12),
                depreciation_start: acquiredOn || null,
              }
            : {}),
        },
      });
      setName("");
      setCurrent("");
      setAcquired("");
      setAcquiredOn("");
      setDeprYears("");
      qc.invalidateQueries({ queryKey: ["ob-assets", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead
        icon={Gem}
        title={t(isBusiness ? "ob.assets.titleBiz" : "ob.assets.title")}
        subtitle={t(isBusiness ? "ob.assets.subtitleBiz" : "ob.assets.subtitle")}
      />
      <div className="space-y-2">
        <Input
          placeholder={t(isBusiness ? "ob.assets.namePhBiz" : "ob.assets.namePh")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={t("ob.assets.acquiredValuePh", { sym })}
            value={acquired}
            onChange={(e) => setAcquired(e.target.value)}
          />
          <Input
            type="date"
            aria-label={t("ob.assets.acquiredOnLabel")}
            value={acquiredOn}
            onChange={(e) => setAcquiredOn(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Input
            className="w-40"
            inputMode="decimal"
            placeholder={t("ob.assets.valuePh", { sym })}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
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
          <Button onClick={submit} disabled={saving || !name || !current}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
        {isBusiness && (
          <div>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder={t("ob.assets.deprYearsPh")}
              value={deprYears}
              onChange={(e) => setDeprYears(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("ob.assets.deprHint")}</p>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <ul className="mt-4 divide-y rounded-xl border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
              </span>
              <span className="tabular-nums font-medium">{money(Number(r.current_value))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Projects / allocations ----------------------------------------------

type BucketKind = "savings" | "emergency" | "investment";
type Suggestion = {
  name: string;
  target_type: "pct_surplus" | "fixed_monthly";
  target_value: number;
  why: string;
  kind: BucketKind;
};

function ProjectsStep({ householdId, isBusiness }: { householdId: string; isBusiness: boolean }) {
  const qc = useQueryClient();
  const t = useT();
  const sym = currencySymbol();
  const add = useServerFn(upsertBucket);

  const { data } = useQuery({
    queryKey: ["ob-projects", householdId],
    queryFn: async () => {
      const [inc, fx, ve, dt, bk] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
        supabase
          .from("variable_estimates")
          .select("monthly_amount")
          .eq("household_id", householdId),
        supabase.from("debts").select("monthly_amount").eq("household_id", householdId),
        supabase
          .from("buckets")
          .select("id, name")
          .eq("household_id", householdId)
          .order("sort_order"),
      ]);
      const sum = (rows: Array<{ monthly_amount: number | string }> | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
      const surplus = Math.max(0, sum(inc.data) - sum(fx.data) - sum(ve.data) - sum(dt.data));
      const { data: hh } = await supabase
        .from("households")
        .select("children")
        .eq("id", householdId)
        .maybeSingle();
      return { surplus, buckets: bk.data ?? [], children: hh?.children ?? 0 };
    },
  });

  const surplus = data?.surplus ?? 0;
  const existing = new Set((data?.buckets ?? []).map((b) => b.name.toLowerCase()));

  const suggestions: Suggestion[] = [
    {
      name: t("ob.projects.sug.emergency"),
      target_type: "pct_surplus",
      target_value: 30,
      why: t("ob.projects.sug.emergencyWhy"),
      kind: "emergency",
    },
    {
      name: t("ob.projects.sug.invest"),
      target_type: "pct_surplus",
      target_value: 20,
      why: t("ob.projects.sug.investWhy"),
      kind: "investment",
    },
    // Holidays and kids are personal-only suggestions.
    ...(isBusiness
      ? []
      : [
          {
            name: t("ob.projects.sug.holidays"),
            target_type: "fixed_monthly" as const,
            target_value: Math.max(25, Math.round((surplus * 0.1) / 5) * 5),
            why: t("ob.projects.sug.holidaysWhy"),
            kind: "savings" as const,
          },
          ...(data && data.children > 0
            ? [
                {
                  name: t("ob.projects.sug.kids"),
                  target_type: "fixed_monthly" as const,
                  target_value: Math.max(25, Math.round((surplus * 0.15) / 5) * 5),
                  why: t("ob.projects.sug.kidsWhy"),
                  kind: "savings" as const,
                },
              ]
            : []),
        ]),
  ];

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  async function addBucket(s: {
    name: string;
    target_type: Suggestion["target_type"];
    target_value: number;
    initial_balance?: number;
    kind?: BucketKind;
  }) {
    await add({
      data: {
        household_id: householdId,
        name: s.name,
        target_type: s.target_type,
        target_value: s.target_value,
        initial_balance: s.initial_balance ?? 0,
        kind: s.kind ?? "savings",
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
      <StepHead
        icon={PiggyBank}
        title={t(isBusiness ? "ob.projects.titleBiz" : "ob.projects.title")}
        subtitle={t("ob.projects.subtitle", { amount: money(surplus) })}
      />
      <StepInfo body={t("ob.projects.info")} />

      <p className="mb-2 text-sm font-medium">{t("ob.projects.suggested")}</p>
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
              <p className="mt-1 text-xs tabular-nums">
                ~{money(monthlyFor(s))}
                {t("common.perMonthShort")}
              </p>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-6 text-sm font-medium">{t("ob.projects.orCustom")}</p>
      <div className="space-y-2">
        <Input
          placeholder={t(isBusiness ? "ob.projects.namePhBiz" : "ob.projects.namePh")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={t("ob.projects.balancePh", { sym })}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <Input
            inputMode="decimal"
            placeholder={t("ob.projects.targetPh", { sym })}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
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

// ---- Plans (future costs / income the user already knows about) -----------

function PlansStep({ householdId, isBusiness }: { householdId: string; isBusiness: boolean }) {
  const qc = useQueryClient();
  const t = useT();
  const add = useServerFn(upsertPlan);
  const { data: plans = [] } = useQuery({
    queryKey: ["ob-plans", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, label, amount, direction, month")
        .eq("household_id", householdId)
        .order("month");
      return data ?? [];
    },
  });

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"spend" | "income">("spend");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [recurrence, setRecurrence] = useState<"one_off" | "annual" | "ongoing">("one_off");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label || !amount) return;
    setSaving(true);
    try {
      await add({
        data: {
          household_id: householdId,
          label,
          amount: parseFloat(amount) || 0,
          direction,
          month: `${month}-01`,
          recurrence,
        },
      });
      setLabel("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["ob-plans", householdId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHead
        icon={CalendarClock}
        title={t("ob.plans.title")}
        subtitle={t(isBusiness ? "ob.plans.subtitleBiz" : "ob.plans.subtitle")}
      />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={t("ob.plans.labelPh")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            className="w-28"
            inputMode="decimal"
            placeholder={t("ob.plans.amountPh")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">{t("ob.plans.spend")}</SelectItem>
              <SelectItem value="income">{t("ob.plans.income")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="month"
            className="w-40"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as typeof recurrence)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_off">{t("ob.plans.once")}</SelectItem>
              <SelectItem value="annual">{t("ob.plans.annual")}</SelectItem>
              <SelectItem value="ongoing">{t("ob.plans.ongoing")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={submit} disabled={saving || !label || !amount}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
      </div>

      {plans.length > 0 && (
        <ul className="mt-4 divide-y rounded-xl border">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {p.direction === "income" ? (
                  <TrendingUp className="size-4 text-emerald-600 shrink-0" />
                ) : (
                  <TrendingDown className="size-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{p.label}</span>
              </span>
              <span className="tabular-nums font-medium shrink-0">
                {p.direction === "income" ? "+" : ""}
                {money(Number(p.amount))} · {String(p.month).slice(0, 7)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
