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
  "dashboard.safe.labelToday": {
    en: "Safe to spend today",
    pt: "Valor seguro para hoje",
    es: "Gasto seguro para hoy",
    de: "Sicherer Betrag für heute",
    fr: "Montant sûr pour aujourd'hui",
  },
  "dashboard.safe.labelWeek": {
    en: "Safe to spend in the next 7 days",
    pt: "Valor seguro para os próximos 7 dias",
    es: "Gasto seguro para los próximos 7 días",
    de: "Sicherer Betrag für die nächsten 7 Tage",
    fr: "Montant sûr pour les 7 prochains jours",
  },
  "dashboard.safe.labelCycle": {
    en: "Safe to spend this cycle",
    pt: "Valor seguro para este ciclo",
    es: "Gasto seguro para este ciclo",
    de: "Sicherer Betrag für diesen Zyklus",
    fr: "Montant sûr pour ce cycle",
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
    en: "Next 7 days",
    pt: "Próximos 7 dias",
    es: "Próximos 7 días",
    de: "Nächste 7 Tage",
    fr: "7 prochains jours",
  },
  "dashboard.safe.horizon.cycle": {
    en: "Rest of cycle",
    pt: "Resto do ciclo",
    es: "Resto del ciclo",
    de: "Restlicher Zyklus",
    fr: "Reste du cycle",
  },
  "dashboard.salary.confirmTitle": {
    en: "Salary received",
    pt: "Salário recebido",
    es: "Salario recibido",
    de: "Gehalt erhalten",
    fr: "Salaire reçu",
  },
  "dashboard.salary.amountLabel": {
    en: "How much did you receive?",
    pt: "Quanto recebeu?",
    es: "¿Cuánto recibiste?",
    de: "Wie viel hast du erhalten?",
    fr: "Combien avez-vous reçu ?",
  },
  "dashboard.salary.amountHint": {
    en: "We prefilled your usual amount. Change it if this payment was different, for example a bonus, overtime or a lighter month.",
    pt: "Preenchemos o seu valor habitual. Altere se este pagamento foi diferente, por exemplo um bónus, horas extra ou um mês mais curto.",
    es: "Rellenamos tu importe habitual. Cámbialo si este pago fue diferente, por ejemplo una bonificación, horas extra o un mes más corto.",
    de: "Wir haben deinen üblichen Betrag vorausgefüllt. Ändere ihn, wenn diese Zahlung anders war, etwa ein Bonus, Überstunden oder ein kürzerer Monat.",
    fr: "Nous avons prérempli votre montant habituel. Modifiez-le si ce paiement était différent, par exemple une prime, des heures supplémentaires ou un mois plus court.",
  },
  "dashboard.salary.confirmCta": {
    en: "Record and start cycle",
    pt: "Registar e iniciar ciclo",
    es: "Registrar e iniciar ciclo",
    de: "Erfassen und Zyklus starten",
    fr: "Enregistrer et démarrer le cycle",
  },
  "dashboard.salary.badAmount": {
    en: "Enter an amount greater than zero.",
    pt: "Introduza um valor maior que zero.",
    es: "Introduce un importe mayor que cero.",
    de: "Gib einen Betrag größer als null ein.",
    fr: "Saisissez un montant supérieur à zéro.",
  },
  "ana.burndown.multiNote": {
    en: "{count} cycles side by side. Each resets to zero, jumps with your income, reserves fixed costs, then burns down with spending.",
    pt: "{count} ciclos lado a lado. Cada um reinicia a zero, sobe com o rendimento, reserva os custos fixos e depois desce com os gastos.",
    es: "{count} ciclos uno al lado del otro. Cada uno se reinicia a cero, sube con tu ingreso, reserva los costes fijos y luego baja con el gasto.",
    de: "{count} Zyklen nebeneinander. Jeder beginnt bei null, steigt mit deinem Einkommen, reserviert die Fixkosten und sinkt dann mit den Ausgaben.",
    fr: "{count} cycles côte à côte. Chacun repart de zéro, monte avec vos revenus, réserve les charges fixes, puis descend avec les dépenses.",
  },
  "ana.category.descSingle": {
    en: "Where your spending went.",
    pt: "Para onde foram os seus gastos.",
    es: "Adónde fue tu gasto.",
    de: "Wohin deine Ausgaben gingen.",
    fr: "Où sont passées vos dépenses.",
  },
  "ana.category.descRange": {
    en: "Total across {count} selected cycles.",
    pt: "Total dos {count} ciclos selecionados.",
    es: "Total de los {count} ciclos seleccionados.",
    de: "Summe über {count} ausgewählte Zyklen.",
    fr: "Total sur {count} cycles sélectionnés.",
  },
  "alloc.currentBalance": {
    en: "Balance",
    pt: "Saldo",
    es: "Saldo",
    de: "Guthaben",
    fr: "Solde",
  },
  "alloc.perMonthToTrack": {
    en: "{amount}/mo to stay on track",
    pt: "{amount}/mês para manter o ritmo",
    es: "{amount}/mes para ir al día",
    de: "{amount}/Monat, um im Plan zu bleiben",
    fr: "{amount}/mois pour rester dans les temps",
  },
  "alloc.perMonthPlan": {
    en: "{amount}/mo planned",
    pt: "{amount}/mês planeado",
    es: "{amount}/mes planeado",
    de: "{amount}/Monat geplant",
    fr: "{amount}/mois prévu",
  },
  "alloc.goalMet": {
    en: "Goal reached.",
    pt: "Objetivo atingido.",
    es: "Objetivo alcanzado.",
    de: "Ziel erreicht.",
    fr: "Objectif atteint.",
  },
  "alloc.goalPace": {
    en: "{amount} a month keeps this on track.",
    pt: "{amount} por mês mantém o ritmo.",
    es: "{amount} al mes lo mantiene al día.",
    de: "{amount} pro Monat hält es im Plan.",
    fr: "{amount} par mois maintient le rythme.",
  },
  "alloc.goalTight": {
    en: "Needs {amount} a month, more than your {surplus} surplus.",
    pt: "Precisa de {amount} por mês, mais do que o seu excedente de {surplus}.",
    es: "Necesita {amount} al mes, más que tu excedente de {surplus}.",
    de: "Braucht {amount} pro Monat, mehr als dein Überschuss von {surplus}.",
    fr: "Nécessite {amount} par mois, plus que votre excédent de {surplus}.",
  },
  "buckets.initialFundsDate": {
    en: "As of date (optional)",
    pt: "Data de referência (opcional)",
    es: "Fecha de referencia (opcional)",
    de: "Stichtag (optional)",
    fr: "Date de référence (facultatif)",
  },
  "cycleReport.outlook.title": {
    en: "Looking ahead: next cycle",
    pt: "A olhar em frente: próximo ciclo",
    es: "Mirando hacia adelante: próximo ciclo",
    de: "Ausblick: nächster Zyklus",
    fr: "Perspectives : prochain cycle",
  },
  "cycleReport.outlook.desc": {
    en: "Planned money in and out for {month}, folded into your baseline.",
    pt: "Dinheiro planeado a entrar e a sair em {month}, integrado no seu orçamento base.",
    es: "Dinero planificado que entra y sale en {month}, integrado en tu presupuesto base.",
    de: "Geplante Ein- und Ausgänge für {month}, eingerechnet in dein Budget.",
    fr: "Argent prévu entrant et sortant pour {month}, intégré à votre budget de base.",
  },
  "cycleReport.outlook.expectedIncome": {
    en: "Expected income",
    pt: "Rendimento previsto",
    es: "Ingresos previstos",
    de: "Erwartetes Einkommen",
    fr: "Revenu attendu",
  },
  "cycleReport.outlook.plannedSpend": {
    en: "Planned spend",
    pt: "Gastos planeados",
    es: "Gasto planificado",
    de: "Geplante Ausgaben",
    fr: "Dépenses prévues",
  },
  "cycleReport.outlook.projectedLeftover": {
    en: "Projected leftover",
    pt: "Sobra prevista",
    es: "Sobrante previsto",
    de: "Voraussichtlicher Rest",
    fr: "Reste prévu",
  },
  "cycleReport.outlook.shortfall": {
    en: "Projected shortfall",
    pt: "Défice previsto",
    es: "Déficit previsto",
    de: "Voraussichtliches Defizit",
    fr: "Déficit prévu",
  },
  "cycleReport.outlook.clear": {
    en: "No plans booked for next cycle — it looks clear.",
    pt: "Nenhum plano marcado para o próximo ciclo — parece tranquilo.",
    es: "No hay planes para el próximo ciclo — se ve despejado.",
    de: "Keine Pläne für den nächsten Zyklus — es sieht frei aus.",
    fr: "Aucun plan prévu pour le prochain cycle — la voie est libre.",
  },
  "cycleReport.outlook.funded": {
    en: "Funded",
    pt: "Financiado",
    es: "Financiado",
    de: "Finanziert",
    fr: "Financé",
  },
  "cycleReport.outlook.unfunded": {
    en: "Set aside a project",
    pt: "Reservar num projeto",
    es: "Reservar en un proyecto",
    de: "Projekt zurücklegen",
    fr: "Prévoir un projet",
  },
} satisfies Record<string, Record<Locale, string>>;

export type EntryKey = keyof typeof ENTRIES;
