/**
 * Household values — what the household actually cares about. Money is a means
 * to those ends, so the values drive three things:
 *
 *  1. Need-level (intent): a category tied to a chosen value is promoted, so
 *     travel is not a "treat" for a household that values travelling.
 *  2. Alignment: of the flexible (non-essential) spending in a cycle, how much
 *     went to what the household said matters.
 *  3. The journey and suggested projects: rungs and buckets that serve those
 *     values, instead of generic investing.
 *
 * Everything here is pure so it can be unit-tested and reused on both sides.
 */

import {
  defaultIntentForCategory,
  INTENT_LEVELS,
  isDiscretionary,
  type IntentLevel,
} from "@/lib/intent";

export type ValueKey =
  | "family"
  | "travel"
  | "health"
  | "home"
  | "giving"
  | "learning"
  | "security"
  | "treats"
  | "environment"
  | "community"
  | "investing";

export const VALUE_KEYS: ValueKey[] = [
  "family",
  "travel",
  "health",
  "home",
  "giving",
  "learning",
  "security",
  "treats",
  "environment",
  "community",
  "investing",
];

/** Max values a household ranks. Three keeps the choice meaningful. */
export const MAX_VALUES = 3;

/** i18n key for a value's label / one-line description. */
export function valueLabelKey(v: ValueKey): string {
  return `values.opt.${v}`;
}
export function valueDescKey(v: ValueKey): string {
  return `values.desc.${v}`;
}

/**
 * A household's ranked values. `key` is a catalog value, or "other" with free
 * text. Rank is the array order (index 0 = most important).
 */
export type HouseholdValue = { key: ValueKey | "other"; text?: string | null };

/** Parse whatever is stored in `households.life_values` into a safe list. */
export function parseValues(raw: unknown): HouseholdValue[] {
  if (!Array.isArray(raw)) return [];
  const out: HouseholdValue[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if ((VALUE_KEYS as string[]).includes(item)) out.push({ key: item as ValueKey });
      continue;
    }
    if (item && typeof item === "object") {
      const key = (item as { key?: unknown }).key;
      const text = (item as { text?: unknown }).text;
      if (typeof key === "string" && (VALUE_KEYS as string[]).includes(key))
        out.push({ key: key as ValueKey });
      else if (key === "other")
        out.push({ key: "other", text: typeof text === "string" ? text : null });
    }
    if (out.length >= MAX_VALUES) break;
  }
  return out;
}

/** Just the catalog keys, in rank order (free-text values carry no mapping). */
export function valueKeysOf(values: HouseholdValue[]): ValueKey[] {
  return values.filter((v) => v.key !== "other").map((v) => v.key as ValueKey);
}

// Which spending categories serve which value. Lowercase category names, matched
// against the household's own category list (which is user-editable, so we match
// loosely by substring too).
const VALUE_CATEGORIES: Record<ValueKey, string[]> = {
  family: ["kids", "childcare", "family", "education", "school", "gifts"],
  travel: ["travel", "holiday", "holidays", "vacation", "flights", "hotel"],
  health: ["health", "healthcare", "medical", "sport", "sports", "gym", "wellbeing", "fitness"],
  home: ["housing", "home", "rent", "furniture", "renovation", "garden", "utilities"],
  giving: ["giving", "donations", "donation", "charity", "gifts"],
  learning: ["education", "learning", "courses", "course", "books", "training", "career"],
  security: ["insurance", "savings", "emergency", "debt", "loan"],
  treats: ["dining", "restaurants", "entertainment", "leisure", "hobbies", "shopping", "fun"],
  environment: ["transport", "commute", "bike", "cycling", "energy", "environment"],
  community: ["community", "donations", "giving", "local", "volunteering"],
  investing: ["investments", "investing", "pension", "retirement"],
};

/** The categories a set of values covers (deduped, in rank order). */
export function categoriesForValues(values: HouseholdValue[]): string[] {
  const seen = new Set<string>();
  for (const k of valueKeysOf(values)) for (const c of VALUE_CATEGORIES[k]) seen.add(c);
  return [...seen];
}

function normalise(c?: string | null): string {
  return (c ?? "").trim().toLowerCase();
}

/**
 * Does this category serve one of the household's values? Returns the matching
 * value key (highest ranked wins) or null. Matching is substring-tolerant so
 * user-renamed categories ("family holidays") still match.
 */
export function matchValue(
  values: HouseholdValue[],
  category?: string | null,
): ValueKey | null {
  const cat = normalise(category);
  if (!cat) return null;
  for (const k of valueKeysOf(values)) {
    for (const c of VALUE_CATEGORIES[k]) {
      if (cat === c || cat.includes(c) || c.includes(cat)) return k;
    }
  }
  return null;
}

function promote(level: IntentLevel, steps: number): IntentLevel {
  const idx = INTENT_LEVELS.indexOf(level);
  return INTENT_LEVELS[Math.max(0, idx - steps)];
}

/**
 * The values-aware need-level of an expense. Manual tags always win. Otherwise
 * the category default is promoted one level when it serves a chosen value, and
 * two levels when it serves the household's #1 value (so a travel-first
 * household sees its trip spending as essential, not as waste).
 */
export function resolveIntentWithValues(
  e: { intent?: string | null; category?: string | null },
  values: HouseholdValue[] = [],
): IntentLevel {
  if (e.intent && (INTENT_LEVELS as string[]).includes(e.intent)) return e.intent as IntentLevel;
  const base = defaultIntentForCategory(e.category);
  const matched = matchValue(values, e.category);
  if (!matched) return base;
  const keys = valueKeysOf(values);
  const steps = keys[0] === matched ? 2 : 1;
  return promote(base, steps);
}

export type AlignmentSummary = {
  /** Flexible (non-essential) spend in the period. */
  flexible: number;
  /** Flexible spend on categories that serve a chosen value. */
  aligned: number;
  /** Flexible spend that serves none of them. */
  offValues: number;
  /** Aligned share of flexible spend, 0-100 (0 when there is no flexible spend). */
  alignedPct: number;
  /** Off-values totals per category, biggest first — the swap candidates. */
  leaks: Array<{ category: string; amount: number }>;
  /** Aligned totals per value key, biggest first. */
  byValue: Array<{ key: ValueKey; amount: number }>;
  /** True when the household has not chosen any values yet. */
  unset: boolean;
};

/**
 * Of the flexible spending in a period, how much served the household's values.
 * Essentials are excluded on purpose: rent and groceries are not a choice, and
 * counting them would flatter every household into looking aligned.
 */
export function alignmentSummary(
  expenses: Array<{
    amount: number | string;
    intent?: string | null;
    category?: string | null;
    kind?: string | null;
  }>,
  values: HouseholdValue[] = [],
): AlignmentSummary {
  let flexible = 0;
  let aligned = 0;
  const leakMap = new Map<string, number>();
  const valueMap = new Map<ValueKey, number>();

  for (const e of expenses) {
    if (e.kind === "income") continue;
    const amt = Number(e.amount) || 0;
    if (amt <= 0) continue;
    // Flexibility is judged on the BASE need-level, not the values-promoted one:
    // otherwise promoting a valued category to "essential" would hide exactly the
    // spending this measure exists to celebrate.
    const level = e.intent && (INTENT_LEVELS as string[]).includes(e.intent)
      ? (e.intent as IntentLevel)
      : defaultIntentForCategory(e.category);
    if (!isDiscretionary(level)) continue;
    flexible += amt;
    const matched = matchValue(values, e.category);
    if (matched) {
      aligned += amt;
      valueMap.set(matched, (valueMap.get(matched) ?? 0) + amt);
    } else {
      const cat = normalise(e.category) || "other";
      leakMap.set(cat, (leakMap.get(cat) ?? 0) + amt);
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const offValues = flexible - aligned;
  return {
    flexible: round(flexible),
    aligned: round(aligned),
    offValues: round(offValues),
    alignedPct: flexible > 0 ? Math.round((aligned / flexible) * 1000) / 10 : 0,
    leaks: [...leakMap.entries()]
      .map(([category, amount]) => ({ category, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    byValue: [...valueMap.entries()]
      .map(([key, amount]) => ({ key, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    unset: values.length === 0,
  };
}

// ---------------------------------------------------------------------------
// People / life stage
// ---------------------------------------------------------------------------

export type PersonRole =
  | "employed"
  | "self_employed"
  | "student"
  | "homemaker"
  | "retired"
  | "unemployed"
  | "child";

export const PERSON_ROLES: PersonRole[] = [
  "employed",
  "self_employed",
  "student",
  "homemaker",
  "retired",
  "unemployed",
  "child",
];

export type Person = {
  id?: string;
  name?: string | null;
  age?: number | null;
  role: string;
  sort_order?: number;
};

export type LifeStage = {
  /** Age of the youngest child, when known. */
  youngestChildAge: number | null;
  /** Years until the oldest working adult reaches 65, when known. */
  yearsToRetirement: number | null;
  /** People with role "child" (or age under 18). */
  dependants: number;
  /** Anyone already retired. */
  hasRetired: boolean;
  /** Oldest adult age, when known. */
  oldestAdultAge: number | null;
};

/** Derive the tailoring signals from the people list. */
export function lifeStageOf(people: Person[]): LifeStage {
  const kids = people.filter((p) => p.role === "child" || (p.age != null && p.age < 18));
  const adults = people.filter((p) => !kids.includes(p));
  const kidAges = kids.map((p) => p.age).filter((a): a is number => typeof a === "number");
  const adultAges = adults.map((p) => p.age).filter((a): a is number => typeof a === "number");
  const working = adults.filter((p) => p.role !== "retired");
  const workingAges = working.map((p) => p.age).filter((a): a is number => typeof a === "number");
  return {
    youngestChildAge: kidAges.length ? Math.min(...kidAges) : null,
    yearsToRetirement: workingAges.length ? Math.max(0, 65 - Math.max(...workingAges)) : null,
    dependants: kids.length,
    hasRetired: adults.some((p) => p.role === "retired"),
    oldestAdultAge: adultAges.length ? Math.max(...adultAges) : null,
  };
}

// ---------------------------------------------------------------------------
// Suggested projects
// ---------------------------------------------------------------------------

export type ProjectSuggestion = {
  /** i18n key for the project name. */
  nameKey: string;
  /** Fallback name if the key is missing. */
  name: string;
  kind: "savings" | "emergency" | "investment";
  target_type: "pct_surplus" | "fixed_monthly" | "goal_by_date";
  target_value: number;
  /** Only for goal_by_date: ISO date. */
  target_deadline?: string;
  /** The value this project serves (for the "because you value X" line). */
  value: ValueKey | "security";
  color?: string;
};

const VALUE_PROJECTS: Record<ValueKey, { name: string; slug: string; months: number; share: number }> = {
  family: { name: "Family fund", slug: "family", months: 24, share: 0.15 },
  travel: { name: "Next trip", slug: "travel", months: 12, share: 0.2 },
  health: { name: "Health & wellbeing fund", slug: "health", months: 12, share: 0.1 },
  home: { name: "Home fund", slug: "home", months: 36, share: 0.2 },
  giving: { name: "Giving fund", slug: "giving", months: 12, share: 0.05 },
  learning: { name: "Learning fund", slug: "learning", months: 18, share: 0.1 },
  security: { name: "Safety net", slug: "security", months: 12, share: 0.25 },
  treats: { name: "Fun money", slug: "treats", months: 6, share: 0.05 },
  environment: { name: "Greener living fund", slug: "environment", months: 24, share: 0.1 },
  community: { name: "Community fund", slug: "community", months: 12, share: 0.05 },
  investing: { name: "Long-term investments", slug: "investing", months: 12, share: 0.3 },
};

function roundTo(n: number, step: number): number {
  return Math.max(step, Math.round(n / step) * step);
}

/**
 * 2-3 project suggestions derived from the household's values and its real
 * monthly surplus. Nothing is created until the user taps one. When there is no
 * surplus yet we still suggest, with a small monthly amount, so the household
 * has something to aim at.
 */
export function suggestProjects(
  values: HouseholdValue[],
  opts: { monthlySurplus: number; existingNames?: string[]; now?: Date } = { monthlySurplus: 0 },
): ProjectSuggestion[] {
  const keys = valueKeysOf(values);
  const surplus = Math.max(0, opts.monthlySurplus || 0);
  const taken = new Set((opts.existingNames ?? []).map((n) => normalise(n)));
  const now = opts.now ?? new Date();
  const out: ProjectSuggestion[] = [];

  for (const k of keys.slice(0, 3)) {
    const spec = VALUE_PROJECTS[k];
    if (taken.has(normalise(spec.name))) continue;
    const monthly = surplus > 0 ? Math.max(10, surplus * spec.share) : 25;
    const goal = roundTo(monthly * spec.months, 100);
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + spec.months);
    out.push({
      nameKey: `values.project.${spec.slug}`,
      name: spec.name,
      kind: k === "investing" ? "investment" : k === "security" ? "emergency" : "savings",
      target_type: "goal_by_date",
      target_value: goal,
      target_deadline: deadline.toISOString().slice(0, 10),
      value: k,
    });
  }

  // Always keep a thin financial backbone: a safety net comes first if they
  // don't already have one, framed as protecting the things they chose.
  if (!taken.has("safety net") && !taken.has("emergency savings") && !keys.includes("security")) {
    out.unshift({
      nameKey: "values.project.security",
      name: "Safety net",
      kind: "emergency",
      target_type: "pct_surplus",
      target_value: 25,
      value: "security",
    });
  }

  return out.slice(0, 3);
}
