/**
 * Purchase "intent" / need-level — a supportive, non-judgmental 4-point scale.
 * A treat is a healthy part of a working budget, not waste. The scale exists so
 * the coach can tune its tolerance (celebrate treats when the household is on
 * track, gently flag the treat share when the reserve is thin), never to scold.
 *
 * Tagging is optional and low-friction: an untagged expense falls back to a
 * sensible default derived from its category, so every expense is classified
 * without any manual effort, and users can override per expense.
 */

export type IntentLevel = "essential" | "important" | "nice_to_have" | "treat";

export const INTENT_LEVELS: IntentLevel[] = [
  "essential",
  "important",
  "nice_to_have",
  "treat",
];

/** i18n key for a level's label (shared with the "Should I buy this?" scale). */
export function intentLabelKey(level: IntentLevel): string {
  const map: Record<IntentLevel, string> = {
    essential: "purchaseCheck.level.essential",
    important: "purchaseCheck.level.important",
    nice_to_have: "purchaseCheck.level.niceToHave",
    treat: "purchaseCheck.level.treat",
  };
  return map[level];
}

// Sensible defaults by category, so nothing needs manual tagging. Necessities
// (food at home, housing, utilities, health, kids, commuting, debt) are
// essential; the rest slide down toward discretionary. Unknown categories are
// treated as nice-to-have (neutral middle), never as a "treat" by default.
const CATEGORY_DEFAULTS: Record<string, IntentLevel> = {
  groceries: "essential",
  utilities: "essential",
  housing: "essential",
  rent: "essential",
  health: "essential",
  healthcare: "essential",
  medical: "essential",
  kids: "essential",
  childcare: "essential",
  education: "essential",
  transport: "essential",
  commute: "essential",
  debt: "essential",
  loan: "essential",
  insurance: "important",
  fuel: "important",
  phone: "important",
  internet: "important",
  subscriptions: "nice_to_have",
  dining: "nice_to_have",
  restaurants: "nice_to_have",
  shopping: "nice_to_have",
  clothing: "nice_to_have",
  gifts: "nice_to_have",
  other: "nice_to_have",
  entertainment: "treat",
  leisure: "treat",
  travel: "treat",
  hobbies: "treat",
};

/** The default need-level for a category (used when an expense isn't tagged). */
export function defaultIntentForCategory(category?: string | null): IntentLevel {
  if (!category) return "nice_to_have";
  return CATEGORY_DEFAULTS[category.trim().toLowerCase()] ?? "nice_to_have";
}

/** The effective level of an expense: its own tag if set, else the category default. */
export function resolveIntent(e: {
  intent?: string | null;
  category?: string | null;
}): IntentLevel {
  if (e.intent && INTENT_LEVELS.includes(e.intent as IntentLevel)) {
    return e.intent as IntentLevel;
  }
  return defaultIntentForCategory(e.category);
}

/** Discretionary = nice-to-have + treat (the flexible part of spending). */
export function isDiscretionary(level: IntentLevel): boolean {
  return level === "nice_to_have" || level === "treat";
}

/**
 * Summarise a set of variable (non-income) expenses by need-level. Returns the
 * absolute spend per level, the discretionary and treat totals, and the
 * discretionary share of total variable spend (0-100). Feeds the coach so it can
 * calibrate how much room there is for treats.
 */
export function summariseIntent(
  expenses: Array<{ amount: number | string; intent?: string | null; category?: string | null }>,
): {
  total: number;
  byLevel: Record<IntentLevel, number>;
  discretionary: number;
  treat: number;
  discretionarySharePct: number;
} {
  const byLevel: Record<IntentLevel, number> = {
    essential: 0,
    important: 0,
    nice_to_have: 0,
    treat: 0,
  };
  let total = 0;
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    if (amt <= 0) continue;
    total += amt;
    byLevel[resolveIntent(e)] += amt;
  }
  const discretionary = byLevel.nice_to_have + byLevel.treat;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    total: round(total),
    byLevel: {
      essential: round(byLevel.essential),
      important: round(byLevel.important),
      nice_to_have: round(byLevel.nice_to_have),
      treat: round(byLevel.treat),
    },
    discretionary: round(discretionary),
    treat: round(byLevel.treat),
    discretionarySharePct: total > 0 ? Math.round((discretionary / total) * 1000) / 10 : 0,
  };
}
