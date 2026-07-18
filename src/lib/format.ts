import { format as fnsFormat } from "date-fns";
import { enGB, pt, es, de, fr } from "date-fns/locale";

type LocaleCode = "en" | "pt" | "es" | "de" | "fr";

const INTL_MAP: Record<LocaleCode, string> = {
  en: "en-IE",
  pt: "pt-PT",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
};

const DATE_FNS_MAP = { en: enGB, pt, es, de, fr } as const;

const DATE_PATTERNS: Record<LocaleCode, { date: string; dateTime: string }> = {
  en: { date: "dd/MM/yyyy", dateTime: "dd/MM/yyyy HH:mm:ss" },
  pt: { date: "dd/MM/yyyy", dateTime: "dd/MM/yyyy HH:mm:ss" },
  es: { date: "dd/MM/yyyy", dateTime: "dd/MM/yyyy HH:mm:ss" },
  de: { date: "dd.MM.yyyy", dateTime: "dd.MM.yyyy HH:mm:ss" },
  fr: { date: "dd/MM/yyyy", dateTime: "dd/MM/yyyy HH:mm:ss" },
};

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

let currentLocale: LocaleCode = "en";
let currentCurrency: CurrencyCode = "EUR";
let currencyFormatter: Intl.NumberFormat = buildCurrencyFormatter(currentLocale, currentCurrency);

function buildCurrencyFormatter(l: LocaleCode, currency: CurrencyCode) {
  return new Intl.NumberFormat(INTL_MAP[l], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

/** Called by the i18n provider (and once at module init) to keep non-hook formatters in sync. */
export function setCurrentLocale(l: string) {
  const safe = (["en", "pt", "es", "de", "fr"] as const).includes(l as LocaleCode)
    ? (l as LocaleCode)
    : "en";
  if (safe === currentLocale) return;
  currentLocale = safe;
  currencyFormatter = buildCurrencyFormatter(safe, currentCurrency);
}

/** Set the currency used by money() — driven by the active household's currency. */
export function setCurrentCurrency(c: string | null | undefined) {
  const safe = SUPPORTED_CURRENCIES.includes(c as CurrencyCode) ? (c as CurrencyCode) : "EUR";
  if (safe === currentCurrency) return;
  currentCurrency = safe;
  currencyFormatter = buildCurrencyFormatter(currentLocale, safe);
}

// Kept for compatibility with existing imports.
export const EUR = new Proxy({} as Intl.NumberFormat, {
  get(_t, prop) {
    const v = (currencyFormatter as unknown as Record<string, unknown>)[prop as string];
    return typeof v === "function"
      ? (v as (...a: unknown[]) => unknown).bind(currencyFormatter)
      : v;
  },
});

export function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return currencyFormatter.format(isFinite(v as number) ? (v as number) : 0);
}

/** Return the current currency's symbol (e.g. €, $, £) using the active locale. */
export function currencySymbol(): string {
  try {
    const parts = currencyFormatter.formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value;
    if (sym) return sym;
  } catch {
    /* ignore */
  }
  return currentCurrency === "USD" ? "$" : currentCurrency === "GBP" ? "£" : "€";
}


export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return fnsFormat(date, DATE_PATTERNS[currentLocale].dateTime, {
    locale: DATE_FNS_MAP[currentLocale],
  });
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return fnsFormat(date, DATE_PATTERNS[currentLocale].date, {
    locale: DATE_FNS_MAP[currentLocale],
  });
}

export function daysRemainingInMonth(now = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, last - now.getDate() + 1);
}

export function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export function yearBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { start, end };
}
