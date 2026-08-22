/**
 * Chat-first actions — the "stop clicking everywhere" path.
 *
 * The user says what happened ("spent 34 at Lidl", "car loan 210 a month, 6.4%",
 * "save 200 a month for a trip to Japan") and the coach turns it into structured
 * rows. Nothing is ever written from the model's output directly: the client
 * shows the rows, the user edits/confirms, and only then do the normal server
 * functions run. This file is the pure, testable half — types, the local
 * pre-filter that decides whether a message is worth an extraction call, and the
 * normalizer that hardens whatever the model returned.
 */

export const ACTION_KINDS = [
  "expense", // a one-off expense that already happened
  "income_entry", // money received (one-off)
  "fixed", // recurring fixed cost
  "variable", // monthly variable estimate
  "income", // recurring income
  "debt", // loan / financing with a monthly payment
  "project", // savings goal / bucket
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export type CoachAction = {
  kind: ActionKind;
  /** Short human label: merchant for expenses, name for everything else. */
  label: string;
  /** Positive amount: the one-off amount, or the monthly figure for recurring. */
  amount: number;
  /** Expense/fixed/variable only; must be one of the household's categories. */
  category?: string | null;
  /** Debt only. */
  taeg_pct?: number | null;
  /** ISO date (YYYY-MM-DD) for one-off entries. */
  occurred_at?: string | null;
};

/** Plain-language name for each kind, used in the confirm card. */
export const ACTION_LABELS: Record<ActionKind, string> = {
  expense: "Expense",
  income_entry: "Money received",
  fixed: "Monthly bill",
  variable: "Monthly estimate",
  income: "Recurring income",
  debt: "Loan",
  project: "Project",
};

/** One-line "what will happen" for the confirm card. */
export const ACTION_HINTS: Record<ActionKind, string> = {
  expense: "Recorded in this cycle's spending",
  income_entry: "Recorded as money received",
  fixed: "Added to your recurring costs",
  variable: "Added as a monthly estimate",
  income: "Added to your recurring income",
  debt: "Added to your loans",
  project: "Added as a savings project",
};

const RECURRING: ReadonlySet<ActionKind> = new Set(["fixed", "variable", "income", "debt", "project"]);
export const isRecurring = (k: ActionKind) => RECURRING.has(k);

/**
 * Cheap local gate: only pay for an extraction call when the message plausibly
 * describes something to record. Needs an amount (a digit 1-9) plus an
 * action-ish word in one of the app's languages. Questions ("how much did I
 * spend on food?") are excluded so the coach still just answers them.
 */
export function looksLikeAction(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t || t.length > 600) return false;
  if (!/[1-9]/.test(t)) return false;
  if (t.endsWith("?")) return false;
  if (/\b(how|why|when|should|can i|quanto|porque|cuanto|combien|wieviel|wie viel)\b/.test(t))
    return false;
  return /\b(add|added|record|log|spent|spend|paid|pay|bought|buy|receiv|earn|got|save|saving|goal|project|loan|debt|credit|instal|rent|bill|subscription|salary|gasto|gastei|paguei|comprei|recebi|adiciona|adicionar|registra|poupar|emprestimo|divida|renda|salario|gaste|pague|compre|recibi|ahorrar|prestamo|deuda|depense|paye|achete|recu|economiser|pret|dette|ausgab|bezahlt|gekauft|erhalten|sparen|kredit|schuld|miete|rechnung)/.test(
    t,
  );
}

const KIND_SET = new Set<string>(ACTION_KINDS);

function coerceAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.abs(v) : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.abs(n) : null;
  }
  return null;
}

function coerceDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.length <= 10 ? `${v}T12:00:00Z` : v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Harden model output into actions we are willing to show. Anything without a
 * known kind, a label and a positive amount is dropped rather than guessed at.
 * Categories are snapped to the household's own list (case-insensitive) so the
 * model can never invent one.
 */
export function normalizeActions(raw: unknown, categories: string[] = []): CoachAction[] {
  const items = Array.isArray(raw) ? raw : [];
  const catByLower = new Map(categories.map((c) => [c.toLowerCase(), c]));
  const out: CoachAction[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const kind = typeof r.kind === "string" ? r.kind.trim() : "";
    if (!KIND_SET.has(kind)) continue;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 80) : "";
    const amount = coerceAmount(r.amount);
    if (!label || amount === null || amount <= 0) continue;

    const rawCat = typeof r.category === "string" ? r.category.trim().toLowerCase() : "";
    const taeg = coerceAmount(r.taeg_pct);
    out.push({
      kind: kind as ActionKind,
      label,
      amount: Math.round(amount * 100) / 100,
      category: rawCat ? (catByLower.get(rawCat) ?? null) : null,
      taeg_pct: kind === "debt" && taeg !== null && taeg <= 100 ? taeg : null,
      occurred_at: isRecurring(kind as ActionKind) ? null : coerceDate(r.occurred_at),
    });
    if (out.length >= 20) break;
  }
  return out;
}
