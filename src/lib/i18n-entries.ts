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
  "dashboard.safe.infoTitle": {
    en: "What safe to spend means",
    pt: "O que é o seguro para gastar",
    es: "Qué es lo seguro para gastar",
    de: "Was sicher ausgeben bedeutet",
    fr: "Ce que signifie libre à dépenser",
  },
  "dashboard.safe.infoBody": {
    en: "It is what is left for everyday spending once your fixed costs, debt payments and project funding are set aside for the cycle. That money is genuinely yours to spend. We take that allowance, subtract what you have already spent, and spread the rest evenly across the days left.",
    pt: "É o que sobra para o dia a dia depois de reservar, neste ciclo, os custos fixos, os pagamentos de dívida e o financiamento dos projetos. Esse dinheiro é mesmo seu para gastar. Pegamos nessa margem, subtraímos o que já gastou e distribuímos o resto de forma igual pelos dias que faltam.",
    es: "Es lo que queda para el día a día una vez reservados, en este ciclo, los costes fijos, los pagos de deudas y la financiación de tus proyectos. Ese dinero es realmente tuyo para gastar. Tomamos ese margen, restamos lo que ya has gastado y repartimos el resto por igual entre los días que quedan.",
    de: "Es ist das, was für alltägliche Ausgaben übrig bleibt, sobald deine Fixkosten, Schuldenzahlungen und die Projektfinanzierung für den Zyklus zurückgelegt sind. Dieses Geld gehört wirklich dir. Wir nehmen diesen Betrag, ziehen ab, was du bereits ausgegeben hast, und verteilen den Rest gleichmäßig auf die verbleibenden Tage.",
    fr: "C'est ce qu'il reste pour les dépenses courantes une fois mis de côté, pour ce cycle, vos charges fixes, vos remboursements de dettes et le financement de vos projets. Cet argent est vraiment à vous. On prend cette enveloppe, on retire ce que vous avez déjà dépensé, et on répartit le reste également sur les jours restants.",
  },
  "dashboard.safe.infoBreakdown": {
    en: "{remaining} left across {days} days is about {perDay} a day.",
    pt: "{remaining} para {days} dias, cerca de {perDay} por dia.",
    es: "{remaining} para {days} días, unos {perDay} al día.",
    de: "{remaining} für {days} Tage, etwa {perDay} pro Tag.",
    fr: "{remaining} pour {days} jours, soit environ {perDay} par jour.",
  },
  "dashboard.safe.horizon.today": {
    en: "Today",
    pt: "Hoje",
    es: "Hoy",
    de: "Heute",
    fr: "Aujourd'hui",
  },
  "dashboard.safe.horizon.week": {
    en: "This week",
    pt: "Esta semana",
    es: "Esta semana",
    de: "Diese Woche",
    fr: "Cette semaine",
  },
  "dashboard.safe.horizon.cycle": {
    en: "Rest of cycle",
    pt: "Resto do ciclo",
    es: "Resto del ciclo",
    de: "Restlicher Zyklus",
    fr: "Reste du cycle",
  },
} satisfies Record<string, Record<Locale, string>>;

export type EntryKey = keyof typeof ENTRIES;
