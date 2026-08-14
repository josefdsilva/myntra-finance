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
  /** Categories spending above the peer benchmark: EUR/month over. */
  categoryOver?: Array<{ category: string; overMonthly: number }>;
  /** Monthly non-essential (nice-to-have + treat) spend. */
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
  for (const c of inp.categoryOver ?? []) {
    // Suggest closing HALF the gap to peers — realistic, not "spend like nobody".
    const room = Math.round(c.overMonthly / 2);
    if (room >= 5) spending.push({ kind: "category", category: c.category, monthlyEur: room });
  }
  const nonEss = inp.nonEssentialMonthly ?? 0;
  if (nonEss > 15) {
    // A third of non-essentials is an achievable trim without touching essentials.
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
