/**
 * Bank-statement analysis — pure, deterministic, no network/AI.
 *
 * Parses a CSV export, detects recurring monthly charges (candidate FIXED costs),
 * averages the rest per category (candidate VARIABLE estimates), and spots income
 * and debt-installment patterns. Categorization uses a tiny built-in keyword map
 * for obvious/global merchants; everything unmatched is left `null` so a caller
 * can fill it via the AI fallback (cheaper than maintaining big keyword lists,
 * and it scales to any country).
 */

export const CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "fuel",
  "utilities",
  "housing",
  "subscriptions",
  "health",
  "kids",
  "shopping",
  "entertainment",
  "travel",
  "gifts",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type RawTxn = {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  description: string;
  /** Signed: negative = money out, positive = money in. */
  amount: number;
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/** Pick the most likely delimiter from a sample (semicolon is common in the EU). */
export function detectDelimiter(sample: string): "," | ";" | "\t" {
  const line = sample.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const counts: Record<string, number> = {
    ";": (line.match(/;/g) || []).length,
    ",": (line.match(/,/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best && best[1] > 0 ? best[0] : ",") as "," | ";" | "\t";
}

/** Tolerant CSV parser: handles quoted fields, escaped quotes, and newlines in quotes. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Parse a monetary string in either EU (1.234,56) or US (1,234.56) format. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[^0-9.,]/g, ""); // drop currency symbols/letters
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Only commas: decimal comma if it looks like ",dd" at the end.
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Parse a date in common formats; returns ISO yyyy-mm-dd or null. */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return isoDate(year, +m[2], +m[1]); // assume day/month/year (EU)
  }
  return null;
}

function isoDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d
    .toString()
    .padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Column inference
// ---------------------------------------------------------------------------

export type ColumnMap = {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
};

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

/**
 * Infer which columns hold date / description / amount, using exclusions so
 * lookalikes don't collide:
 *  - a "value date" column ("Data-valor") must NOT be read as the amount just
 *    because it contains "valor";
 *  - a running-balance column ("Saldo … após movimento") must NEVER be the amount.
 * Returns null if it can't identify at least date + description + (amount | debit/credit).
 */
export function inferColumns(header: string[]): ColumnMap | null {
  const H = header.map((h) => h.trim().toLowerCase());
  const isDate = (s: string) => has(s, "data", "date", "fecha", "datum");
  const isBalance = (s: string) => has(s, "saldo", "balance", "dispon", "kontostand");

  // Date — prefer the movement/operation date over a value date.
  let date = H.findIndex((s) => isDate(s) && has(s, "mov", "oper", "lanc", "lanç", "book"));
  if (date < 0) date = H.findIndex(isDate);

  // Amount — strong, unambiguous tokens first; then "valor/value" but never on a
  // date or balance column.
  let amount = H.findIndex(
    (s, i) =>
      i !== date &&
      !isBalance(s) &&
      has(s, "montante", "importe", "importo", "betrag", "amount", "montant"),
  );
  if (amount < 0) {
    amount = H.findIndex(
      (s, i) => i !== date && !isDate(s) && !isBalance(s) && has(s, "valor", "value", "valeur"),
    );
  }

  // Separate debit/credit columns only when there's no single amount column.
  let debit = -1;
  let credit = -1;
  if (amount < 0) {
    debit = H.findIndex(
      (s, i) => i !== date && has(s, "débito", "debito", "debit", "cargo", "saída", "saida", "soll"),
    );
    credit = H.findIndex(
      (s, i) => i !== date && has(s, "crédito", "credito", "credit", "abono", "entrada", "haben"),
    );
  }

  // Description — keyworded first, else the first remaining non-date/-balance column.
  const used = new Set([date, amount, debit, credit].filter((i) => i >= 0));
  let description = H.findIndex(
    (s, i) =>
      !used.has(i) &&
      !isBalance(s) &&
      has(s, "desc", "concep", "referê", "refere", "detalhe", "detail", "memo", "beneficiario", "payee", "verwendung"),
  );
  if (description < 0) description = H.findIndex((s, i) => !used.has(i) && !isBalance(s) && !isDate(s));

  if (date < 0 || description < 0) return null;
  if (amount < 0 && (debit < 0 || credit < 0)) return null;
  const map: ColumnMap = { date, description };
  if (amount >= 0) map.amount = amount;
  if (debit >= 0) map.debit = debit;
  if (credit >= 0) map.credit = credit;
  return map;
}

/** Build normalized transactions from parsed rows + a column map. Skips the header. */
export function toTransactions(rows: string[][], map: ColumnMap): RawTxn[] {
  const out: RawTxn[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const date = parseDate(r[map.date] ?? "");
    if (!date) continue;
    let amount: number | null = null;
    if (map.amount != null) {
      amount = parseAmount(r[map.amount] ?? "");
    } else {
      const deb = map.debit != null ? parseAmount(r[map.debit] ?? "") : null;
      const cred = map.credit != null ? parseAmount(r[map.credit] ?? "") : null;
      if (deb) amount = -Math.abs(deb);
      else if (cred) amount = Math.abs(cred);
    }
    if (amount == null || amount === 0) continue;
    const description = (r[map.description] ?? "").trim();
    out.push({ date, description, amount });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Merchant normalization + categorization
// ---------------------------------------------------------------------------

/** Reduce a raw description to a stable merchant key (strip refs, dates, noise). */
export function normalizeMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\b\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?\b/g, " ") // dates
    .replace(/\b\d{6,}\b/g, " ") // long ref numbers
    .replace(
      /\b(COMPRA|PAGAMENTO|PAGT|PAG|TRF|TRANSF|TRANSFER|MB WAY|MBWAY|DD|DEBITO DIRECTO|POS|CARD|CARTAO|CARTÃO|COM\.?|PT|REF)\b/g,
      " ",
    )
    .replace(/[*#/\\|.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tiny, intentionally-minimal keyword map — only obvious/global merchants and a
 * few generic terms. Everything else returns null and is handed to the AI
 * fallback. This keeps maintenance low and works across countries.
 */
const KEYWORDS: Array<[RegExp, Category]> = [
  [/NETFLIX|SPOTIFY|DISNEY|HBO|PRIME VIDEO|YOUTUBE PREMIUM|ICLOUD|GOOGLE ONE|OPENAI|CHATGPT/, "subscriptions"],
  [/UBER EATS|GLOVO|BOLT FOOD|DELIVEROO|MCDONALD|BURGER KING|KFC|STARBUCKS|RESTAUR/, "dining"],
  [/UBER|BOLT|CABIFY|FREENOW|METRO|COMBOIOS|CP |RENFE|TRANSPORT|TOLL|VIA VERDE|PARK/, "transport"],
  [/GALP|BP |REPSOL|SHELL|CEPSA|PRIO|FUEL|GASOL|PETROL/, "fuel"],
  [/EDP|ENDESA|IBERDROLA|NATURGY|GALP POWER|ELECTRIC|ENERGIA|AGUAS|EPAL|MEO|NOS|VODAFONE|NOWO|INTERNET|TELECOM/, "utilities"],
  [/RENDA|ALUGUER|ALQUILER|RENT|MORTGAGE|CONDOMIN/, "housing"],
  [/PHARMAC|FARMAC|HOSPITAL|CLINIC|SAUDE|MEDIC|DENT/, "health"],
  [/AMAZON|ZARA|H&M|IKEA|WORTEN|FNAC|EL CORTE|PRIMARK|DECATHLON|SHEIN|ALIEXPRESS/, "shopping"],
  [/CONTINENTE|PINGO DOCE|LIDL|ALDI|MERCADONA|AUCHAN|INTERMARCHE|MINIPRECO|SUPERMERCAD|GROCER/, "groceries"],
  [/CINEMA|SPOTIFY|STEAM|PLAYSTATION|XBOX|NINTENDO|CONCERT|MUSEUM/, "entertainment"],
  [/RYANAIR|TAP |EASYJET|BOOKING|AIRBNB|HOTEL|EXPEDIA|VUELING|IBERIA|LUFTHANSA|AIRLINE|FLIGHT/, "travel"],
  [/EMPRESTIMO|EMPRÉSTIMO|CREDITO|CRÉDITO|PRESTACAO|PRESTAÇÃO|LOAN|FINANC|LEASING/, "other"],
];

/** Rule-based category, or null when unknown (→ AI fallback). */
export function categorizeByRules(merchant: string): Category | null {
  const m = merchant.toUpperCase();
  for (const [re, cat] of KEYWORDS) if (re.test(m)) return cat;
  return null;
}

const DEBT_RE = /EMPRESTIMO|EMPRÉSTIMO|CREDITO|CRÉDITO|PRESTACAO|PRESTAÇÃO|LOAN|MORTGAGE|FINANC|LEASING|HIPOTEC/i;

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
/** Coefficient of variation (std/mean) of absolute values. */
function cv(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m === 0) return 0;
  const variance = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(variance) / Math.abs(m);
}
function daysBetween(a: string, b: string): number {
  return Math.abs((+new Date(b) - +new Date(a)) / 86400000);
}

// ---------------------------------------------------------------------------
// Recurring detection
// ---------------------------------------------------------------------------

export type Cadence = "monthly" | "quarterly" | "yearly";

export type Recurring = {
  merchant: string;
  sampleDescription: string;
  /** Amount prorated to a monthly figure. */
  monthlyAmount: number;
  perOccurrence: number;
  cadence: Cadence;
  occurrences: number;
  amountCv: number;
  confidence: number; // 0-1
  category: Category | null;
  isDebt: boolean;
  txnIndexes: number[];
};

const CADENCE_MONTHS: Record<Cadence, number> = { monthly: 1, quarterly: 3, yearly: 12 };

function cadenceFromGap(medianGapDays: number): Cadence | null {
  if (medianGapDays >= 24 && medianGapDays <= 37) return "monthly";
  if (medianGapDays >= 80 && medianGapDays <= 100) return "quarterly";
  if (medianGapDays >= 350 && medianGapDays <= 385) return "yearly";
  return null;
}

/** Detect recurring OUTFLOWS. `months` is the window length (statement span). */
export function detectRecurring(txns: RawTxn[], months: number): Recurring[] {
  const groups = new Map<string, number[]>();
  txns.forEach((t, i) => {
    if (t.amount >= 0) return; // outflows only
    const key = normalizeMerchant(t.description);
    if (!key) return;
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });

  const out: Recurring[] = [];
  for (const [merchant, idxs] of groups) {
    if (idxs.length < 2) continue;
    const sorted = idxs.slice().sort((a, b) => +new Date(txns[a].date) - +new Date(txns[b].date));
    const dates = sorted.map((i) => txns[i].date);
    const amounts = sorted.map((i) => Math.abs(txns[i].amount));
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i += 1) gaps.push(daysBetween(dates[i - 1], dates[i]));
    const medianGap = median(gaps);
    const cadence = cadenceFromGap(medianGap);
    if (!cadence) continue;

    const amountCv = cv(amounts);
    const perOccurrence = median(amounts);
    const monthlyAmount = Math.round((perOccurrence / CADENCE_MONTHS[cadence]) * 100) / 100;

    // Expected occurrences over the window for this cadence.
    const expected = Math.max(2, Math.floor(months / CADENCE_MONTHS[cadence]));
    const occRatio = Math.min(1, sorted.length / expected);
    const regularity = Math.max(0, 1 - cv(gaps)); // stable gaps → 1
    const stability = Math.max(0, 1 - Math.min(1, amountCv)); // stable amount → 1
    const category = categorizeByRules(merchant);
    const keywordBonus = category ? 0.1 : 0;
    const confidence = Math.min(
      1,
      Math.round((0.45 * occRatio + 0.3 * regularity + 0.25 * stability + keywordBonus) * 100) / 100,
    );

    // Keep only reasonably confident, non-trivial recurrences.
    if (confidence < 0.5 || monthlyAmount < 1) continue;

    out.push({
      merchant,
      sampleDescription: txns[sorted[0]].description,
      monthlyAmount,
      perOccurrence: Math.round(perOccurrence * 100) / 100,
      cadence,
      occurrences: sorted.length,
      amountCv: Math.round(amountCv * 100) / 100,
      confidence,
      category,
      isDebt: DEBT_RE.test(txns[sorted[0]].description),
      txnIndexes: sorted,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence || b.monthlyAmount - a.monthlyAmount);
}

// ---------------------------------------------------------------------------
// Variable estimation
// ---------------------------------------------------------------------------

export type VariableEstimate = {
  category: Category;
  monthlyAmount: number;
  txnCount: number;
};

export type VariableResult = {
  estimates: VariableEstimate[];
  /** One-off outliers excluded from the averages, for transparency. */
  anomalies: Array<{ index: number; description: string; amount: number; category: Category }>;
  /** Distinct merchant keys with no rule category — feed these to the AI fallback. */
  unknownMerchants: string[];
};

/**
 * Average the non-recurring outflows per category over the window. `categoryOf`
 * lets a caller inject AI-resolved categories; falls back to rules then "other".
 * Outliers (a category's transaction far above its own median) are excluded so a
 * single big purchase doesn't inflate the monthly estimate.
 */
export function estimateVariable(
  txns: RawTxn[],
  recurringIndexes: Set<number>,
  months: number,
  categoryOf?: (merchant: string) => Category | null,
): VariableResult {
  const perCat = new Map<Category, number[]>();
  const catTxns: Array<{ index: number; category: Category; amount: number }> = [];
  const unknown = new Set<string>();

  txns.forEach((t, i) => {
    if (t.amount >= 0 || recurringIndexes.has(i)) return;
    const merchant = normalizeMerchant(t.description);
    let cat = categorizeByRules(merchant) ?? categoryOf?.(merchant) ?? null;
    if (!cat) {
      if (merchant) unknown.add(merchant);
      cat = "other";
    }
    const amt = Math.abs(t.amount);
    catTxns.push({ index: i, category: cat, amount: amt });
    const arr = perCat.get(cat) ?? [];
    arr.push(amt);
    perCat.set(cat, arr);
  });

  const anomalies: VariableResult["anomalies"] = [];
  const estimates: VariableEstimate[] = [];
  for (const [category, amounts] of perCat) {
    const med = median(amounts);
    const kept: number[] = [];
    for (const ct of catTxns.filter((c) => c.category === category)) {
      const isOutlier = med > 0 && ct.amount > Math.max(6 * med, 500) && amounts.length > 2;
      if (isOutlier) {
        anomalies.push({
          index: ct.index,
          description: txns[ct.index].description,
          amount: ct.amount,
          category,
        });
      } else {
        kept.push(ct.amount);
      }
    }
    const total = kept.reduce((s, x) => s + x, 0);
    const monthlyAmount = Math.round((total / Math.max(1, months)) * 100) / 100;
    if (monthlyAmount > 0) estimates.push({ category, monthlyAmount, txnCount: kept.length });
  }

  return {
    estimates: estimates.sort((a, b) => b.monthlyAmount - a.monthlyAmount),
    anomalies,
    unknownMerchants: [...unknown],
  };
}

// ---------------------------------------------------------------------------
// Income + debt detection
// ---------------------------------------------------------------------------

export type IncomeCandidate = {
  label: string;
  monthlyAmount: number;
  occurrences: number;
  isSalary: boolean;
  confidence: number;
};

/** Detect recurring INFLOWS (salary/other income). Largest regular one = salary. */
export function detectIncome(txns: RawTxn[], months: number): IncomeCandidate[] {
  const groups = new Map<string, number[]>();
  txns.forEach((t, i) => {
    if (t.amount <= 0) return; // inflows only
    const key = normalizeMerchant(t.description);
    if (!key) return;
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });

  const candidates: IncomeCandidate[] = [];
  for (const [label, idxs] of groups) {
    if (idxs.length < 2) continue;
    const sorted = idxs.slice().sort((a, b) => +new Date(txns[a].date) - +new Date(txns[b].date));
    const dates = sorted.map((i) => txns[i].date);
    const amounts = sorted.map((i) => txns[i].amount);
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i += 1) gaps.push(daysBetween(dates[i - 1], dates[i]));
    if (cadenceFromGap(median(gaps)) !== "monthly") continue;
    const monthlyAmount = Math.round(median(amounts) * 100) / 100;
    const regularity = Math.max(0, 1 - cv(gaps));
    const occRatio = Math.min(1, sorted.length / Math.max(2, months));
    candidates.push({
      label: txns[sorted[0]].description.slice(0, 60),
      monthlyAmount,
      occurrences: sorted.length,
      isSalary: false,
      confidence: Math.round((0.6 * occRatio + 0.4 * regularity) * 100) / 100,
    });
  }
  candidates.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  if (candidates.length) candidates[0].isSalary = true; // largest regular inflow
  return candidates;
}

export type DebtCandidate = {
  label: string;
  monthlyAmount: number;
  confidence: number;
};

/** Recurring outflows that look like loan/credit installments. */
export function detectDebtInstallments(recurring: Recurring[]): DebtCandidate[] {
  return recurring
    .filter((r) => r.isDebt)
    .map((r) => ({
      label: r.sampleDescription.slice(0, 60),
      monthlyAmount: r.monthlyAmount,
      confidence: r.confidence,
    }));
}

// ---------------------------------------------------------------------------
// Top-level orchestration (deterministic pass)
// ---------------------------------------------------------------------------

export type StatementAnalysis = {
  months: number;
  txnCount: number;
  fixed: Recurring[];
  variable: VariableResult;
  income: IncomeCandidate[];
  debts: DebtCandidate[];
};

/** Number of distinct calendar months the statement covers (min 1). */
export function statementMonths(txns: RawTxn[]): number {
  if (!txns.length) return 1;
  const months = new Set(txns.map((t) => t.date.slice(0, 7))); // yyyy-mm
  return Math.max(1, months.size);
}

/**
 * Full deterministic analysis. `categoryOf` optionally injects AI-resolved
 * categories for merchants the rules didn't recognize (see the AI fallback fn).
 */
export function analyzeStatement(
  txns: RawTxn[],
  categoryOf?: (merchant: string) => Category | null,
): StatementAnalysis {
  const months = statementMonths(txns);
  const allRecurring = detectRecurring(txns, months);
  const fixed = allRecurring.filter((r) => !r.isDebt);
  const recurringIndexes = new Set<number>();
  for (const r of allRecurring) for (const i of r.txnIndexes) recurringIndexes.add(i);
  const variable = estimateVariable(txns, recurringIndexes, months, categoryOf);
  const income = detectIncome(txns, months);
  const debts = detectDebtInstallments(allRecurring);
  return { months, txnCount: txns.length, fixed, variable, income, debts };
}
