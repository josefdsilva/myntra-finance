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
  /**
   * "breakeven" when the baseline already meets/exceeds income (the household is
   * underwater — trimming is about getting back to zero plus a small buffer);
   * "cushion" when there's a slim but positive surplus. Callers pick their copy
   * off this so the underwater case never reads as "you're €X short of a
   * cushion" when the real story is "you're spending more than you earn".
   */
  mode: "cushion" | "breakeven";
  /** Total to free up (EUR/month): the overspend, if any, plus the cushion gap. */
  gapEur: number;
  /** Monthly amount spent above income (0 unless underwater) — for break-even copy. */
  deficitEur: number;
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
  /** Monthly overspend = max(0, baseline − income). When > 0 the household is
   *  underwater and the result switches to break-even framing. */
  deficit?: number;
}): SavingsResult {
  const income = Math.max(0, inp.income);
  const surplus = Math.max(0, inp.surplus);
  const deficit = Math.max(0, inp.deficit ?? 0);
  const target = income * (Math.max(0, inp.marginPct) / 100);
  // Total to free up = the overspend (get back to zero) plus the cushion gap.
  const gapEur = Math.max(0, Math.round(target - surplus + deficit));
  const mode: "cushion" | "breakeven" = deficit > 0 ? "breakeven" : "cushion";

  // Surface whenever money is genuinely tight and there's room to trim — a real
  // gap and a surplus below 10% of income (which includes zero and underwater).
  // The household that's underwater or at break-even needs "where to cut" most.
  // We DON'T gate on surplus > 0: doing so hid this from exactly the families it's
  // for. Instead `mode`/`deficit` keep the framing honest (break-even vs cushion),
  // so it reads as the actionable companion to the "no surplus" issue — never the
  // contradiction it was before (no more "€X short of a cushion" while underwater).
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

  return {
    surface,
    mode,
    gapEur,
    deficitEur: Math.round(deficit),
    spending: spending.slice(0, 4),
    income: incomeOps,
  };
}
