import type { Locale } from "./i18n-messages";

/**
 * Key-first translations: each key holds all five locales together, so adding a
 * string is ONE edit instead of five parallel ones — and `satisfies` forces all
 * locales to be present. New copy should go here; `messages` merges this in.
 *
 * The legacy per-locale blocks in `i18n-messages.ts` still work unchanged. To
 * fold them into this shape wholesale, run `scripts/i18n-export-key-first.mjs`
 * (it reads the assembled runtime table, so no fragile text parsing), review the
 * output, and replace this object with it.
 *
 * Example:
 *   "greeting.hi": { en: "Hi", pt: "Olá", es: "Hola", de: "Hallo", fr: "Salut" },
 */
export const ENTRIES = {
  // Add new keys here.
} satisfies Record<string, Record<Locale, string>>;

export type EntryKey = keyof typeof ENTRIES;
