import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Locale, type MessageKey, SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_NAMES_EN } from "./i18n-messages";
import { setCurrentLocale } from "./format";

export type { Locale, MessageKey } from "./i18n-messages";
export { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_NAMES_EN } from "./i18n-messages";

const STORAGE_KEY = "locale";

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const short = l?.slice(0, 2).toLowerCase() as Locale;
    if (SUPPORTED_LOCALES.includes(short)) return short;
  }
  return "en";
}

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    return v && SUPPORTED_LOCALES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

// Initialise the module-level locale used by non-hook formatters as early as possible.
if (typeof window !== "undefined") {
  const initial = readStoredLocale() ?? detectBrowserLocale();
  setCurrentLocale(initial);
}

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale | "auto") => void;
  isAuto: boolean;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [isAuto, setIsAuto] = useState<boolean>(() => (typeof window === "undefined" ? true : readStoredLocale() === null));
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    return readStoredLocale() ?? detectBrowserLocale();
  });

  useEffect(() => {
    setCurrentLocale(locale);
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale | "auto") => {
    if (l === "auto") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setIsAuto(true);
      setLocaleState(detectBrowserLocale());
      return;
    }
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    setIsAuto(false);
    setLocaleState(l);
  }, []);

  const t = useCallback<Ctx["t"]>((key, vars) => {
    const bundle = messages[locale] ?? messages.en;
    const raw = bundle[key] ?? messages.en[key] ?? key;
    return interpolate(raw, vars);
  }, [locale]);

  const value = useMemo<Ctx>(() => ({ locale, setLocale, isAuto, t }), [locale, setLocale, isAuto, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useLocale() {
  return useI18n().locale;
}

/** Human-readable language name for the AI coach prompt. */
export function localeToLanguageName(l: Locale): string {
  return LOCALE_NAMES_EN[l];
}
