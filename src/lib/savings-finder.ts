// "Where's the room" engine — the shared brain behind the actionable, tight-
// budget experience (dashboard tips, Analysis, coach). It never invents a new
// screen: callers feed it what they already compute and surface the result in
// place. It answers the question a broke household actually has — "what do I
// change?" — not "what's left?".
//
// Two levers, in order: trim spending (the primary answer), and — only when
// appropriate — raise income. Income help is deliberately narrow and dignified:
// no benefits/entitlements (too fragile to keep correct), and the only in-app
// nudge is "a better-paid role for the same hours", gated to under-55 households
// whose income is modest for their area. Deeper, more personal moves (part-time,
// relocation, sell-and-rent) live only in the coach conversation.

export type SavingsOpportunity =
  | { kind: "category"; category: string; monthlyEur: number }
  | { kind: "non_essential"; monthlyEur: number };

export type IncomeOpportunity = { kind: "income_role" };

export type SavingsResult = {
  /** Only true when money is genuinely tight — never for a comfortable surplus. */
  surface: boolean;
  /** How far below a healthy cushion they are (EUR/month), for framing. */
  gapEur: number;
  /** Ranked spending trims (largest achievable first). */
  spending: SavingsOpportunity[];
  /** Income options (age- and income-gated). */
  income: IncomeOpportunity[];
};

/** Age bands under 55 — the only bands that see an earning nudge. */
const EARNING_AGE_BANDS = new Set(["under35", "35_44", "45_54"]);

export function findSavings(inp: {
  income: number;
  /** Current surplus (income − everything), clamped ≥ 0 by the caller or here. */
  surplus: number;
  /** The household's healthy savings-margin target, %. */
  marginPct: number;
  ageBand?: string | null;
  /** 1..5 income quintile vs peers (from the benchmark), or null if unknown. */
  incomeQuintile?: number | null;
  /**
   * Discretionary (non-essential) categories to trim, with actual EUR/month.
   * The CALLER filters out essentials (housing, kids, groceries, health,
   * utilities, transport…) so we never suggest cutting things a family can't or
   * shouldn't. Ranked by size, since the biggest discretionary lines are the
   * easiest wins.
   */
  categoryCuts?: Array<{ category: string; monthly: number }>;
  /** Aggregate non-essential (nice-to-have + treat) spend — used by the compact
   *  dashboard tip when there's no per-category breakdown. */
  nonEssentialMonthly?: number;
}): SavingsResult {
  const income = Math.max(0, inp.income);
  const surplus = Math.max(0, inp.surplus);
  const target = income * (Math.max(0, inp.marginPct) / 100);
  const gapEur = Math.max(0, Math.round(target - surplus));

  // Relevant only when it's actually tight: a real gap to a healthy cushion AND
  // a slim current surplus. A comfortable household never sees this.
  const surface = income > 0 && gapEur > 0 && surplus < income * 0.1;

  const spending: SavingsOpportunity[] = [];
  for (const c of inp.categoryCuts ?? []) {
    // A third of a discretionary line is an achievable trim — never all of it.
    const room = Math.round(c.monthly / 3);
    if (room >= 5) spending.push({ kind: "category", category: c.category, monthlyEur: room });
  }
  // Fall back to a single aggregate when no per-category breakdown was supplied.
  const nonEss = inp.nonEssentialMonthly ?? 0;
  if (spending.length === 0 && nonEss > 15) {
    spending.push({ kind: "non_essential", monthlyEur: Math.round(nonEss / 3) });
  }
  spending.sort((a, b) => b.monthlyEur - a.monthlyEur);

  const incomeOps: IncomeOpportunity[] = [];
  const under55 = EARNING_AGE_BANDS.has(inp.ageBand ?? "");
  if (under55 && inp.incomeQuintile != null && inp.incomeQuintile <= 2) {
    incomeOps.push({ kind: "income_role" });
  }

  return { surface, gapEur, spending: spending.slice(0, 4), income: incomeOps };
}
