// Synthetic test personas ("AI personas"): fully-formed fake households you can
// sign into to experience bynku from a different financial angle. Everything
// here is pure and deterministic — the same persona key always produces the
// same numbers, so screenshots and bug reports are reproducible.
//
// SAFETY: personas are always flagged. Their household carries
// `households.is_synthetic = true`, their profile carries
// `profiles.is_synthetic = true`, their auth user carries
// `user_metadata.synthetic = true`, and every generated row is traceable to the
// persona through the `synthetic_personas` registry. Never treat this data as
// real: exclude it from benchmarks, analytics and any published numbers.

import { buildSetupPresets } from "./setup-presets";
import { defaultIntentForCategory, type IntentLevel } from "./intent";

export const SYNTHETIC_EMAIL_DOMAIN = "bynku.app";
export const SYNTHETIC_LABEL = "Synthetic test persona";

export type PersonaIncome = { label: string; monthly_amount: number; type: string };
export type PersonaDebt = {
  label: string;
  kind: string;
  monthly_amount: number;
  principal_remaining: number;
  taeg_pct: number;
  months_left: number;
};

export type PersonaAsset = {
  name: string;
  kind: "cash" | "property" | "land" | "vehicle" | "stocks" | "bonds" | "fund" | "business" | "other";
  current_value: number;
  acquired_value?: number;
  /** Months ago the asset was acquired (kept relative so re-seeds stay fresh). */
  acquired_months_ago?: number;
  /** Links the asset to one of the persona's debts, by debt label. */
  debtLabel?: string;
  note?: string;
  /** Business assets only: straight-line depreciation over this many months. */
  useful_life_months?: number;
  salvage_value?: number;
};

export type PersonaDef = {
  key: string;
  /** persona1@bynku.app style login. */
  email: string;
  /** Short human label shown in the admin list. */
  label: string;
  /** One-line description of the financial angle this persona covers. */
  angle: string;
  displayName: string;
  householdName: string;
  kind: "personal";
  country: string;
  currency: "EUR";
  adults: number;
  children: number;
  ageBand: "under35" | "35_44" | "45_54" | "55_64" | "65_74" | "75plus" | null;
  incomes: PersonaIncome[];
  debts: PersonaDebt[];
  /** Things the household owns (home, car, savings account, portfolio…). */
  assets: PersonaAsset[];
  /** Extra fixed costs on top of the benchmark preset (labelled, real-looking). */
  extraFixed?: Array<{ label: string; category: string; monthly_amount: number }>;
  /** Real housing cost, overrides the benchmark housing estimate. */
  housingMonthly?: number | null;
  /** Fixed/variable rows for spaces with no bundled benchmark (or business). */
  manualFixed?: Array<{ label: string; category: string; monthly_amount: number }>;
  manualVariable?: Array<{ label: string; category: string; monthly_amount: number }>;
  /** How disciplined the spending is: 1 = on plan, >1 = overspends. */
  spendBias: number;
  /** Months of expense history to generate. */
  historyMonths: number;
  /** Starting balances for the seeded projects (savings buckets). */
  bucketSeed: { emergency: number; investment: number; savings: number };
  cycleMode: "event" | "time";
};

export const PERSONAS: PersonaDef[] = [
  {
    key: "pt-squeezed-family",
    email: `persona1@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Ana & Rui, Porto",
    angle: "Two incomes, two kids, no buffer — every cycle ends tight.",
    displayName: "Ana (test persona)",
    householdName: "Ana & Rui (test)",
    kind: "personal",
    country: "PT",
    currency: "EUR",
    adults: 2,
    children: 2,
    ageBand: "35_44",
    incomes: [
      { label: "Ana — salary", monthly_amount: 1050, type: "salary" },
      { label: "Rui — salary", monthly_amount: 980, type: "salary" },
    ],
    debts: [
      {
        label: "Car loan",
        kind: "auto",
        monthly_amount: 219,
        principal_remaining: 7400,
        taeg_pct: 8.9,
        months_left: 38,
      },
      {
        label: "Credit card plan",
        kind: "credit_card",
        monthly_amount: 85,
        principal_remaining: 1450,
        taeg_pct: 17.5,
        months_left: 18,
      },
    ],
    housingMonthly: 620,
    extraFixed: [{ label: "School meals", category: "kids", monthly_amount: 96 }],
    spendBias: 1.12,
    historyMonths: 4,
    bucketSeed: { emergency: 380, investment: 0, savings: 120 },
    assets: [
      { name: "Family car", kind: "vehicle", current_value: 8200, acquired_value: 13500, acquired_months_ago: 34, debtLabel: "Car loan" },
      { name: "Current account", kind: "cash", current_value: 410 },
    ],
    cycleMode: "event",
  },
  {
    key: "pt-pensioner",
    email: `persona2@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Maria, 68, Coimbra",
    angle: "Single pension, low income, cautious — tests plain language and small numbers.",
    displayName: "Maria (test persona)",
    householdName: "Maria (test)",
    kind: "personal",
    country: "PT",
    currency: "EUR",
    adults: 1,
    children: 0,
    ageBand: "65_74",
    incomes: [{ label: "State pension", monthly_amount: 720, type: "pension" }],
    debts: [],
    housingMonthly: 180,
    extraFixed: [{ label: "Pharmacy plan", category: "health", monthly_amount: 42 }],
    spendBias: 0.95,
    historyMonths: 4,
    bucketSeed: { emergency: 2400, investment: 0, savings: 300 },
    assets: [
      { name: "Apartment (owned)", kind: "property", current_value: 118000, acquired_value: 42000, acquired_months_ago: 300 },
      { name: "Savings account", kind: "cash", current_value: 2400 },
    ],
    cycleMode: "time",
  },
  {
    key: "es-mortgaged-mid",
    email: `persona3@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Carlos & Lucía, Valencia",
    angle: "Comfortable middle, big mortgage — most of the surplus is already spoken for.",
    displayName: "Carlos (test persona)",
    householdName: "Carlos & Lucía (test)",
    kind: "personal",
    country: "ES",
    currency: "EUR",
    adults: 2,
    children: 1,
    ageBand: "45_54",
    incomes: [
      { label: "Carlos — salary", monthly_amount: 2100, type: "salary" },
      { label: "Lucía — salary", monthly_amount: 1650, type: "salary" },
    ],
    debts: [
      {
        label: "Mortgage",
        kind: "mortgage",
        monthly_amount: 742,
        principal_remaining: 143000,
        taeg_pct: 3.4,
        months_left: 258,
      },
    ],
    housingMonthly: 0,
    extraFixed: [
      { label: "Home insurance", category: "insurance", monthly_amount: 34 },
      { label: "Gym (both)", category: "subscriptions", monthly_amount: 58 },
    ],
    spendBias: 1.0,
    historyMonths: 5,
    bucketSeed: { emergency: 6200, investment: 4100, savings: 900 },
    assets: [
      { name: "Family home", kind: "property", current_value: 268000, acquired_value: 215000, acquired_months_ago: 102, debtLabel: "Mortgage" },
      { name: "Car", kind: "vehicle", current_value: 11500, acquired_value: 22000, acquired_months_ago: 60 },
      { name: "Index fund", kind: "fund", current_value: 14800 },
    ],
    cycleMode: "event",
  },
  {
    key: "de-wealthy-couple",
    email: `persona4@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Katrin & Jonas, Munich",
    angle: "High income, no debt, lots of surplus — does the app still say anything useful?",
    displayName: "Katrin (test persona)",
    householdName: "Katrin & Jonas (test)",
    kind: "personal",
    country: "DE",
    currency: "EUR",
    adults: 2,
    children: 0,
    ageBand: "45_54",
    incomes: [
      { label: "Katrin — salary", monthly_amount: 6400, type: "salary" },
      { label: "Jonas — salary", monthly_amount: 3900, type: "salary" },
      { label: "Apartment rent received", monthly_amount: 1150, type: "rent" },
    ],
    debts: [],
    housingMonthly: 1850,
    extraFixed: [{ label: "Private health cover", category: "insurance", monthly_amount: 420 }],
    spendBias: 1.05,
    historyMonths: 5,
    bucketSeed: { emergency: 24000, investment: 96000, savings: 8000 },
    assets: [
      { name: "Rented-out apartment", kind: "property", current_value: 420000, acquired_value: 310000, acquired_months_ago: 120 },
      { name: "Share portfolio", kind: "stocks", current_value: 186000 },
      { name: "Bond ladder", kind: "bonds", current_value: 64000 },
      { name: "Company car (private)", kind: "vehicle", current_value: 38000, acquired_value: 58000, acquired_months_ago: 26 },
      { name: "Current account", kind: "cash", current_value: 21500 },
    ],
    cycleMode: "event",
  },
  {
    key: "fr-single-parent",
    email: `persona5@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Nadia, Lyon",
    angle: "One income, two children, benefits top-up — highest stress, least time.",
    displayName: "Nadia (test persona)",
    householdName: "Nadia (test)",
    kind: "personal",
    country: "FR",
    currency: "EUR",
    adults: 1,
    children: 2,
    ageBand: "35_44",
    incomes: [
      { label: "Salary", monthly_amount: 1780, type: "salary" },
      { label: "Family allowance", monthly_amount: 240, type: "benefits" },
    ],
    debts: [
      {
        label: "Consumer loan",
        kind: "personal",
        monthly_amount: 148,
        principal_remaining: 3900,
        taeg_pct: 11.2,
        months_left: 29,
      },
    ],
    housingMonthly: 780,
    extraFixed: [{ label: "After-school care", category: "kids", monthly_amount: 165 }],
    spendBias: 1.08,
    historyMonths: 4,
    bucketSeed: { emergency: 640, investment: 0, savings: 0 },
    assets: [
      { name: "Small car", kind: "vehicle", current_value: 4300, acquired_value: 9000, acquired_months_ago: 52 },
      { name: "Livret A", kind: "cash", current_value: 640 },
    ],
    cycleMode: "event",
  },
  {
    key: "nl-young-saver",
    email: `persona6@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Sven, Utrecht",
    angle: "Young, single, student debt, wants to invest — the growth-minded user.",
    displayName: "Sven (test persona)",
    householdName: "Sven (test)",
    kind: "personal",
    country: "NL",
    currency: "EUR",
    adults: 1,
    children: 0,
    ageBand: "under35",
    incomes: [{ label: "Salary", monthly_amount: 2750, type: "salary" }],
    debts: [
      {
        label: "Student loan",
        kind: "student",
        monthly_amount: 96,
        principal_remaining: 12400,
        taeg_pct: 2.1,
        months_left: 168,
      },
    ],
    housingMonthly: 1050,
    extraFixed: [{ label: "Bike lease", category: "transport", monthly_amount: 32 }],
    spendBias: 1.15,
    historyMonths: 4,
    bucketSeed: { emergency: 3100, investment: 5400, savings: 450 },
    assets: [
      { name: "Broker account (ETFs)", kind: "fund", current_value: 5400 },
      { name: "Savings account", kind: "cash", current_value: 3100 },
      { name: "E-bike", kind: "other", current_value: 900, acquired_value: 1600, acquired_months_ago: 22 },
    ],
    cycleMode: "event",
  },
  {
    key: "it-large-household",
    email: `persona7@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Famiglia Ricci, Bari",
    angle: "Six people, three earners, one roof — stress-tests household size scaling.",
    displayName: "Giulia (test persona)",
    householdName: "Famiglia Ricci (test)",
    kind: "personal",
    country: "IT",
    currency: "EUR",
    adults: 3,
    children: 3,
    ageBand: "55_64",
    incomes: [
      { label: "Giulia — salary", monthly_amount: 1600, type: "salary" },
      { label: "Marco — salary", monthly_amount: 1500, type: "salary" },
      { label: "Nonna — pension", monthly_amount: 810, type: "pension" },
    ],
    debts: [
      {
        label: "Mortgage",
        kind: "mortgage",
        monthly_amount: 505,
        principal_remaining: 61000,
        taeg_pct: 4.1,
        months_left: 142,
      },
    ],
    housingMonthly: 0,
    extraFixed: [{ label: "School transport", category: "kids", monthly_amount: 120 }],
    spendBias: 1.1,
    historyMonths: 5,
    bucketSeed: { emergency: 2900, investment: 700, savings: 400 },
    assets: [
      { name: "Family house", kind: "property", current_value: 165000, acquired_value: 120000, acquired_months_ago: 190, debtLabel: "Mortgage" },
      { name: "Van", kind: "vehicle", current_value: 6800, acquired_value: 17000, acquired_months_ago: 84 },
      { name: "Postal savings", kind: "cash", current_value: 2900 },
    ],
    cycleMode: "event",
  },
  {
    key: "pl-unsupported-country",
    email: `persona8@${SYNTHETIC_EMAIL_DOMAIN}`,
    label: "Ola & Piotr, Kraków (PL)",
    angle: "A country with no bundled benchmark — shows how the app degrades.",
    displayName: "Ola (test persona)",
    householdName: "Ola & Piotr (test)",
    kind: "personal",
    country: "PL",
    currency: "EUR",
    adults: 2,
    children: 1,
    ageBand: "35_44",
    incomes: [
      { label: "Ola — salary", monthly_amount: 1250, type: "salary" },
      { label: "Piotr — freelance", monthly_amount: 900, type: "other" },
    ],
    debts: [],
    manualFixed: [
      { label: "Rent", category: "housing", monthly_amount: 620 },
      { label: "Utilities", category: "utilities", monthly_amount: 165 },
      { label: "Internet & phone", category: "subscriptions", monthly_amount: 38 },
      { label: "Nursery", category: "kids", monthly_amount: 180 },
    ],
    manualVariable: [
      { label: "Groceries", category: "groceries", monthly_amount: 420 },
      { label: "Transport", category: "transport", monthly_amount: 90 },
      { label: "Eating out", category: "dining", monthly_amount: 110 },
      { label: "Everything else", category: "other", monthly_amount: 120 },
    ],
    spendBias: 1.05,
    historyMonths: 4,
    bucketSeed: { emergency: 900, investment: 0, savings: 150 },
    assets: [
      { name: "Car", kind: "vehicle", current_value: 5600, acquired_value: 11000, acquired_months_ago: 48 },
      { name: "Savings account", kind: "cash", current_value: 900 },
    ],
    cycleMode: "event",
  },
];

export function personaByKey(key: string): PersonaDef | undefined {
  return PERSONAS.find((p) => p.key === key);
}

export function personaMonthlyIncome(p: PersonaDef): number {
  return p.incomes.reduce((s, i) => s + i.monthly_amount, 0);
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness (mulberry32 seeded from the persona key), so
// a persona's expense history is stable across re-seeds.
// ---------------------------------------------------------------------------

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seedText: string): () => number {
  let a = hashSeed(seedText);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PersonaBudget = {
  fixed: Array<{ label: string; category: string; monthly_amount: number; intent: IntentLevel }>;
  variable: Array<{ label: string; category: string; monthly_amount: number }>;
  marginPct: number;
  fromBenchmark: boolean;
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Fixed costs, everyday estimates and savings margin for a persona. */
export function buildPersonaBudget(p: PersonaDef): PersonaBudget {
  const income = personaMonthlyIncome(p);

  if (p.manualFixed || p.manualVariable) {
    const fixed = (p.manualFixed ?? []).map((r) => ({
      ...r,
      intent: defaultIntentForCategory(r.category),
    }));
    const variable = p.manualVariable ?? [];
    const spend =
      fixed.reduce((s, r) => s + r.monthly_amount, 0) +
      variable.reduce((s, r) => s + r.monthly_amount, 0) +
      p.debts.reduce((s, d) => s + d.monthly_amount, 0);
    const marginPct = income > 0 ? Math.max(0, Math.min(30, Math.round(((income - spend) / income) * 100))) : 0;
    return { fixed, variable, marginPct, fromBenchmark: false };
  }

  const preset = buildSetupPresets({
    country: p.country,
    adults: p.adults,
    children: p.children,
    monthlyIncome: income,
    housingMonthly: p.housingMonthly ?? null,
  });

  const fixed = preset.fixed
    .filter((r) => r.monthly_amount > 0)
    .map((r) => ({
      label: titleCase(r.category),
      category: r.category,
      monthly_amount: r.monthly_amount,
      intent: r.intent,
    }));
  for (const extra of p.extraFixed ?? []) {
    fixed.push({ ...extra, intent: defaultIntentForCategory(extra.category) });
  }

  const variable = preset.variable
    .filter((r) => r.monthly_amount > 0)
    .map((r) => ({ label: titleCase(r.category), category: r.category, monthly_amount: r.monthly_amount }));

  return { fixed, variable, marginPct: preset.marginPct, fromBenchmark: preset.estimated };
}

export type GeneratedExpense = {
  amount: number;
  category: string;
  merchant: string;
  occurred_at: string;
  kind: "expense" | "income";
  is_salary: boolean;
  note: string;
};

const MERCHANTS: Record<string, string[]> = {
  groceries: ["Supermarket", "Local market", "Corner shop"],
  dining: ["Café", "Takeaway", "Restaurant"],
  transport: ["Transit pass", "Taxi", "Parking"],
  fuel: ["Fuel station"],
  utilities: ["Utility co."],
  housing: ["Landlord"],
  subscriptions: ["Streaming", "Mobile plan"],
  health: ["Pharmacy", "Clinic"],
  kids: ["School", "Kids shop"],
  shopping: ["Clothing store", "Online shop"],
  clothing: ["Clothing store"],
  entertainment: ["Cinema", "Events"],
  travel: ["Travel agency", "Airline"],
  gifts: ["Gift shop"],
  materials: ["Parts supplier"],
  supplies: ["Wholesaler"],
  marketing: ["Ad platform"],
  fees: ["Bank fees"],
  other: ["Misc."],
};

function merchantFor(category: string, rng: () => number): string {
  const list = MERCHANTS[category] ?? MERCHANTS.other!;
  return list[Math.floor(rng() * list.length)] ?? "Misc.";
}

/**
 * Generate a believable expense + income history for a persona: every everyday
 * category is spread over several transactions per month with deterministic
 * jitter, and each income lands once a month.
 */
export function buildPersonaHistory(
  p: PersonaDef,
  budget: PersonaBudget,
  now: Date = new Date(),
): GeneratedExpense[] {
  const rng = makeRng(`${p.key}:history`);
  const out: GeneratedExpense[] = [];

  for (let back = p.historyMonths - 1; back >= 0; back--) {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1, 9, 0, 0),
    );
    const daysInMonth = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const isCurrent = back === 0;
    // Only fill the part of the current month that has already happened.
    const lastDay = isCurrent ? Math.max(1, now.getUTCDate() - 1) : daysInMonth;
    const progress = lastDay / daysInMonth;

    // Income: paid on day 1.
    for (const inc of p.incomes) {
      const day = Math.min(lastDay, 1);
      if (!isCurrent || now.getUTCDate() > day) {
        const jitter = 0.99 + rng() * 0.02;
        out.push({
          amount: Math.round(inc.monthly_amount * jitter * 100) / 100,
          category: "income",
          merchant: inc.label,
          occurred_at: new Date(
            Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, 9, 0, 0),
          ).toISOString(),
          kind: "income",
          is_salary: inc.type === "salary",
          note: SYNTHETIC_LABEL,
        });
      }
    }

    // Everyday spending, split into a handful of transactions per category.
    for (const row of budget.variable) {
      const monthlyTarget = row.monthly_amount * p.spendBias * progress;
      if (monthlyTarget <= 0) continue;
      const txCount = Math.max(1, Math.min(8, Math.round(monthlyTarget / 60)));
      let remaining = monthlyTarget;
      for (let i = 0; i < txCount; i++) {
        const isLast = i === txCount - 1;
        const share = isLast ? remaining : (monthlyTarget / txCount) * (0.6 + rng() * 0.8);
        const amount = Math.max(1, Math.round(Math.min(share, remaining) * 100) / 100);
        remaining = Math.max(0, remaining - amount);
        const day = Math.max(1, Math.min(lastDay, Math.ceil(rng() * lastDay)));
        out.push({
          amount,
          category: row.category,
          merchant: merchantFor(row.category, rng),
          occurred_at: new Date(
            Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, 12, 0, 0),
          ).toISOString(),
          kind: "expense",
          is_salary: false,
          note: SYNTHETIC_LABEL,
        });
        if (remaining <= 0) break;
      }
    }
  }

  return out;
}
