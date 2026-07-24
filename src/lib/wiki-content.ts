// Wiki content for the in-app manual.
//
// This is intentionally structured as data (sections with per-locale copy)
// rather than a flat i18n dictionary — the wiki is long-form documentation,
// not app UI chrome. Keep translations in plain language and keep sections
// aligned with the tabs users actually see in the app.
import type { Locale } from "@/lib/i18n";

type Loc<T> = Record<Locale, T>;

export type WikiIcon =
  | "BookOpen"
  | "Calendar"
  | "Wallet"
  | "Receipt"
  | "Calculator"
  | "Sparkles"
  | "PiggyBank"
  | "CreditCard"
  | "CalendarClock"
  | "BarChart3"
  | "MessageCircle"
  | "Settings"
  | "Bell"
  | "ShieldCheck"
  | "HelpCircle";

export type WikiDiagram = "cycle" | "baseline" | "waterfall" | "ladder";

export type WikiBullet = { label: string; body: string };

export type WikiSection = {
  id: string;
  icon: WikiIcon;
  diagram?: WikiDiagram;
  title: Loc<string>;
  paragraphs: Loc<string[]>;
  bullets?: Loc<WikiBullet[]>;
  callout?: Loc<string>;
  faq?: boolean;
  formula?: string; // rendered as a <pre> block, locale-agnostic
};

// ---------------------------------------------------------------------------
// Page chrome (header, search, TOC label) + diagram labels per locale.
// ---------------------------------------------------------------------------
export const WIKI_META: Loc<{
  eyebrow: string;
  title: string;
  subtitle: string;
  tocTitle: string;
  searchPlaceholder: string;
  noResults: string;
  diagrams: {
    salary: string;
    today: string;
    nextSalary: string;
    cycle: string;
    cycleCap: string;
    fixed: string;
    debt: string;
    variable: string;
    margin: string;
    baseline: string;
    baselineCap: string;
    surplus: string;
    realAlloc: string;
    realSurplus: string;
    waterfallCap: string;
    step1: string;
    step2: string;
    step3: string;
    ladderCap: string;
  };
}> = {
  en: {
    eyebrow: "Manual",
    title: "How bynku works",
    subtitle:
      "A short, plain-language guide to the app. Read a section, or search for what you need.",
    tocTitle: "In this guide",
    searchPlaceholder: "Search the manual",
    noResults: "No results for",
    diagrams: {
      salary: "Payday",
      today: "Today",
      nextSalary: "Next payday",
      cycle: "Current cycle",
      cycleCap: "A cycle runs from one payday to the day before the next — not the calendar month.",
      fixed: "Bills",
      debt: "Loans",
      variable: "Everyday",
      margin: "Cushion",
      baseline: "What a normal month costs",
      baselineCap: "Bills + loan payments + your everyday estimate + a small safety cushion.",
      surplus: "What's left",
      realAlloc: "Set aside",
      realSurplus: "Still free",
      waterfallCap: "What's left splits into money you've set aside and money still free to use.",
      step1: "Small emergency fund",
      step2: "Pay down high-interest loans",
      step3: "Invest for the long run",
      ladderCap: "A rough order of priority for spare money — your situation can change the mix.",
    },
  },
  pt: {
    eyebrow: "Manual",
    title: "Como funciona o bynku",
    subtitle:
      "Um guia curto e em linguagem simples. Lê uma secção ou pesquisa o que precisas.",
    tocTitle: "Neste guia",
    searchPlaceholder: "Pesquisar no manual",
    noResults: "Sem resultados para",
    diagrams: {
      salary: "Dia de pagamento",
      today: "Hoje",
      nextSalary: "Próximo pagamento",
      cycle: "Ciclo atual",
      cycleCap:
        "Um ciclo vai de um dia de pagamento até ao dia anterior ao seguinte — não é o mês do calendário.",
      fixed: "Contas fixas",
      debt: "Créditos",
      variable: "Dia a dia",
      margin: "Almofada",
      baseline: "Quanto custa um mês normal",
      baselineCap:
        "Contas fixas + prestações + a tua estimativa do dia a dia + uma pequena almofada de segurança.",
      surplus: "O que sobra",
      realAlloc: "Posto de lado",
      realSurplus: "Ainda livre",
      waterfallCap:
        "O que sobra divide-se entre o que já puseste de lado e o que ainda tens livre.",
      step1: "Fundo de emergência pequeno",
      step2: "Amortizar créditos caros",
      step3: "Investir a longo prazo",
      ladderCap:
        "Uma ordem aproximada de prioridade para o dinheiro que sobra — a tua situação pode mudar a mistura.",
    },
  },
  es: {
    eyebrow: "Manual",
    title: "Cómo funciona bynku",
    subtitle:
      "Una guía corta y en lenguaje sencillo. Lee una sección o busca lo que necesites.",
    tocTitle: "En esta guía",
    searchPlaceholder: "Buscar en el manual",
    noResults: "Sin resultados para",
    diagrams: {
      salary: "Día de cobro",
      today: "Hoy",
      nextSalary: "Próximo cobro",
      cycle: "Ciclo actual",
      cycleCap:
        "Un ciclo va de un día de cobro al día anterior al siguiente — no es el mes natural.",
      fixed: "Gastos fijos",
      debt: "Préstamos",
      variable: "Día a día",
      margin: "Colchón",
      baseline: "Lo que cuesta un mes normal",
      baselineCap:
        "Gastos fijos + cuotas de préstamos + tu estimación del día a día + un pequeño colchón.",
      surplus: "Lo que sobra",
      realAlloc: "Apartado",
      realSurplus: "Aún libre",
      waterfallCap:
        "Lo que sobra se divide entre lo que ya has apartado y lo que sigue libre.",
      step1: "Un pequeño fondo de emergencia",
      step2: "Amortizar préstamos caros",
      step3: "Invertir a largo plazo",
      ladderCap:
        "Un orden aproximado de prioridad para el dinero sobrante — tu situación puede cambiar la mezcla.",
    },
  },
  de: {
    eyebrow: "Handbuch",
    title: "So funktioniert bynku",
    subtitle:
      "Ein kurzer Leitfaden in einfacher Sprache. Lies einen Abschnitt oder suche direkt.",
    tocTitle: "In diesem Leitfaden",
    searchPlaceholder: "Handbuch durchsuchen",
    noResults: "Keine Treffer für",
    diagrams: {
      salary: "Zahltag",
      today: "Heute",
      nextSalary: "Nächster Zahltag",
      cycle: "Aktueller Zyklus",
      cycleCap:
        "Ein Zyklus läuft von einem Zahltag bis zum Tag vor dem nächsten — nicht der Kalendermonat.",
      fixed: "Fixkosten",
      debt: "Kredite",
      variable: "Alltag",
      margin: "Puffer",
      baseline: "Was ein normaler Monat kostet",
      baselineCap:
        "Fixkosten + Kreditraten + Alltagsschätzung + ein kleiner Sicherheitspuffer.",
      surplus: "Was übrig ist",
      realAlloc: "Beiseite gelegt",
      realSurplus: "Noch frei",
      waterfallCap:
        "Der Überschuss teilt sich in bereits Beiseitegelegtes und noch freies Geld.",
      step1: "Kleiner Notgroschen",
      step2: "Teure Kredite tilgen",
      step3: "Langfristig anlegen",
      ladderCap:
        "Eine grobe Prioritätsreihenfolge fürs übrige Geld — deine Situation kann sie verändern.",
    },
  },
  fr: {
    eyebrow: "Manuel",
    title: "Comment bynku fonctionne",
    subtitle:
      "Un guide court, en langage clair. Lis une section ou cherche directement.",
    tocTitle: "Dans ce guide",
    searchPlaceholder: "Rechercher dans le manuel",
    noResults: "Aucun résultat pour",
    diagrams: {
      salary: "Jour de paie",
      today: "Aujourd'hui",
      nextSalary: "Prochaine paie",
      cycle: "Cycle actuel",
      cycleCap:
        "Un cycle va d'une paie à la veille de la suivante — ce n'est pas le mois calendaire.",
      fixed: "Charges fixes",
      debt: "Crédits",
      variable: "Quotidien",
      margin: "Coussin",
      baseline: "Ce que coûte un mois normal",
      baselineCap:
        "Charges fixes + mensualités de crédits + estimation du quotidien + un petit coussin.",
      surplus: "Ce qui reste",
      realAlloc: "Mis de côté",
      realSurplus: "Encore libre",
      waterfallCap:
        "Ce qui reste se partage entre ce qui est déjà mis de côté et ce qui est encore libre.",
      step1: "Petite épargne d'urgence",
      step2: "Rembourser les crédits chers",
      step3: "Investir sur le long terme",
      ladderCap:
        "Un ordre indicatif de priorité pour l'argent restant — ta situation peut le modifier.",
    },
  },
};

// Small helper to keep section literals compact.
const L = <T,>(en: T, pt: T, es: T, de: T, fr: T): Loc<T> => ({ en, pt, es, de, fr });

// ---------------------------------------------------------------------------
// Sections. Order = display order in the wiki page.
// ---------------------------------------------------------------------------
export const WIKI_SECTIONS: WikiSection[] = [
  // ------------------------------------------------------------ overview
  {
    id: "overview",
    icon: "BookOpen",
    title: L("Welcome to bynku", "Bem-vindo ao bynku", "Bienvenido a bynku", "Willkommen bei bynku", "Bienvenue sur bynku"),
    paragraphs: L(
      [
        "bynku is a plain-language money planner. It answers one question well: how much can I actually spend today, without breaking my plan?",
        "You tell it what comes in and what goes out. It shows what's left, what's safe to spend today, and helps you set money aside for goals — no spreadsheets, no jargon.",
        "This guide follows the tabs of the app. If you're new, start with Cycles, then Money in and Money out.",
      ],
      [
        "O bynku é um planeador financeiro em linguagem simples. Responde bem a uma pergunta: quanto posso mesmo gastar hoje sem estragar o plano?",
        "Dizes o que entra e o que sai. Ele mostra o que sobra, quanto é seguro gastar hoje e ajuda a pôr dinheiro de lado para objetivos — sem folhas de cálculo, sem termos difíceis.",
        "Este guia segue os separadores da app. Se és novo, começa em Ciclo, depois Entradas e Saídas.",
      ],
      [
        "bynku es un planificador financiero en lenguaje sencillo. Responde bien a una pregunta: ¿cuánto puedo gastar hoy sin romper mi plan?",
        "Le dices lo que entra y lo que sale. Te muestra lo que queda, lo seguro para gastar hoy y te ayuda a apartar dinero para tus objetivos — sin hojas de cálculo ni jerga.",
        "Esta guía sigue las pestañas de la app. Si acabas de empezar, ve a Ciclo y luego a Ingresos y Gastos.",
      ],
      [
        "bynku ist ein Geldplaner in einfacher Sprache. Er beantwortet eine Frage gut: Wie viel kann ich heute wirklich ausgeben, ohne meinen Plan zu sprengen?",
        "Du sagst, was reinkommt und was rausgeht. Er zeigt, was übrig ist, was heute sicher ausgegeben werden kann und hilft, Geld für Ziele beiseitezulegen — ohne Tabellen, ohne Fachjargon.",
        "Dieser Leitfaden folgt den Tabs der App. Starte bei Zyklus, dann Einnahmen und Ausgaben.",
      ],
      [
        "bynku est un planificateur financier en langage clair. Il répond bien à une question : combien puis-je vraiment dépenser aujourd'hui sans casser mon plan ?",
        "Tu indiques ce qui entre et ce qui sort. L'app affiche ce qui reste, ce qui est prudent de dépenser aujourd'hui et t'aide à mettre de côté pour tes objectifs — sans tableur, sans jargon.",
        "Ce guide suit les onglets de l'app. Si tu débutes, commence par Cycle puis Entrées et Sorties.",
      ],
    ),
    callout: L(
      "The whole app is built around one idea: a plan you understand beats a perfect plan you don't.",
      "Toda a app assenta numa ideia: um plano que percebes vale mais que um plano perfeito que não percebes.",
      "Toda la app se apoya en una idea: un plan que entiendes vale más que un plan perfecto que no entiendes.",
      "Die ganze App basiert auf einer Idee: Ein Plan, den du verstehst, schlägt einen perfekten Plan, den du nicht verstehst.",
      "Toute l'app repose sur une idée : un plan que tu comprends vaut mieux qu'un plan parfait que tu ne comprends pas.",
    ),
  },

  // ------------------------------------------------------------ cycles
  {
    id: "cycles",
    icon: "Calendar",
    diagram: "cycle",
    title: L("Your pay cycle", "O teu ciclo salarial", "Tu ciclo de cobro", "Dein Gehaltszyklus", "Ton cycle de paie"),
    paragraphs: L(
      [
        "A pay cycle runs from one payday to the day before the next. It matches how most people actually feel their money — pay-to-pay, not calendar month to calendar month.",
        "Every number in the app resets each cycle. The dashboard always answers 'today, in this cycle', so today's decisions come from today's reality.",
        "Not everyone lives payday to payday. A business usually thinks in fixed periods — a month, quarter, or fiscal year that starts on a set date. In Settings you can switch a space to a fixed-period cycle and set when its financial year begins (say 1 April), so its quarters line up with the books instead of a paycheque. A payday space starts each cycle when you mark a salary received; a fixed-period space just rolls over on the calendar.",
      ],
      [
        "Um ciclo salarial vai de um pagamento até ao dia anterior ao seguinte. É como a maioria das pessoas sente o dinheiro — de salário em salário, não de mês a mês do calendário.",
        "Todos os números da app são reiniciados a cada ciclo. O painel responde sempre 'hoje, neste ciclo', para que as decisões de hoje partam da realidade de hoje.",
        "Nem toda a gente vive de salário em salário. Uma empresa costuma pensar em períodos fixos — um mês, trimestre ou ano fiscal que começa numa data definida. Nas Definições podes mudar um espaço para um ciclo de período fixo e definir quando começa o ano financeiro (por exemplo 1 de abril), para que os trimestres coincidam com a contabilidade em vez de um salário. Um espaço por salário inicia cada ciclo quando marcas um salário como recebido; um de período fixo avança sozinho pelo calendário.",
      ],
      [
        "Un ciclo de cobro va de un día de pago al día anterior al siguiente. Coincide con cómo la mayoría vive el dinero — de nómina a nómina, no de mes natural.",
        "Todos los números se reinician cada ciclo. El panel responde siempre 'hoy, en este ciclo' para que las decisiones partan de la realidad de hoy.",
        "No todo el mundo vive de nómina a nómina. Una empresa suele pensar en períodos fijos — un mes, trimestre o año fiscal que empieza en una fecha concreta. En Ajustes puedes cambiar un espacio a un ciclo de período fijo y fijar cuándo empieza su año financiero (por ejemplo el 1 de abril), para que los trimestres cuadren con la contabilidad y no con una nómina. Un espacio por nómina inicia cada ciclo cuando marcas una nómina como recibida; uno de período fijo avanza solo con el calendario.",
      ],
      [
        "Ein Gehaltszyklus läuft von einem Zahltag bis zum Tag vor dem nächsten. Das passt zum Alltag der meisten Menschen — Gehalt zu Gehalt, nicht Kalendermonat zu Kalendermonat.",
        "Alle Zahlen werden jeden Zyklus zurückgesetzt. Das Dashboard antwortet immer 'heute, in diesem Zyklus', damit heutige Entscheidungen aus der heutigen Realität kommen.",
        "Nicht alle leben von Gehalt zu Gehalt. Ein Unternehmen denkt meist in festen Perioden — einem Monat, Quartal oder Geschäftsjahr, das an einem festen Datum beginnt. In den Einstellungen kannst du einen Space auf einen Zyklus mit fester Periode umstellen und festlegen, wann sein Geschäftsjahr beginnt (etwa 1. April), damit die Quartale zur Buchhaltung statt zu einem Gehalt passen. Ein Gehalts-Space startet jeden Zyklus, wenn du ein Gehalt als erhalten markierst; ein Space mit fester Periode wechselt einfach über den Kalender.",
      ],
      [
        "Un cycle de paie va d'une paie à la veille de la suivante. C'est ainsi que la plupart des gens ressentent leur argent — de paie à paie, pas de mois calendaire à mois calendaire.",
        "Tous les chiffres sont remis à zéro à chaque cycle. Le tableau de bord répond toujours « aujourd'hui, dans ce cycle », pour partir de la réalité du jour.",
        "On ne vit pas tous de paie en paie. Une entreprise raisonne souvent en périodes fixes — un mois, un trimestre ou un exercice fiscal qui commence à une date définie. Dans les Réglages, tu peux basculer un espace vers un cycle à période fixe et fixer le début de son exercice (par exemple le 1er avril), pour que les trimestres collent à la comptabilité plutôt qu'à une paie. Un espace « paie » démarre chaque cycle quand tu marques un salaire reçu ; un espace à période fixe avance tout seul avec le calendrier.",
      ],
    ),
    bullets: L(
      [
        { label: "Payday", body: "Set the day and frequency in Money in. Multiple salaries? bynku uses the most recent one to open the cycle." },
        { label: "Length", body: "Usually monthly, but you can set weekly, bi-weekly, or custom." },
        { label: "Rolling forward", body: "Unspent everyday money stays with you. Overspending simply lowers next cycle's safe-to-spend until you catch up — no penalties." },
      ],
      [
        { label: "Dia de pagamento", body: "Define o dia e a frequência em Entradas. Vários salários? O bynku usa o mais recente para abrir o ciclo." },
        { label: "Duração", body: "Normalmente mensal, mas podes escolher semanal, quinzenal ou personalizado." },
        { label: "Sobra para o seguinte", body: "O que não gastas no dia a dia fica contigo. Gastar a mais só reduz o valor seguro do próximo ciclo até equilibrares — sem penalizações." },
      ],
      [
        { label: "Día de cobro", body: "Fija el día y la frecuencia en Ingresos. ¿Varias nóminas? bynku usa la más reciente para abrir el ciclo." },
        { label: "Duración", body: "Normalmente mensual, pero puedes elegir semanal, quincenal o a medida." },
        { label: "Se traslada", body: "Lo que no gastas en el día a día se queda. Pasarte solo baja el 'seguro para hoy' del siguiente ciclo hasta recuperarte — sin castigos." },
      ],
      [
        { label: "Zahltag", body: "Tag und Frequenz in Einnahmen einstellen. Mehrere Gehälter? bynku nutzt das jüngste, um den Zyklus zu öffnen." },
        { label: "Länge", body: "Meist monatlich, aber wöchentlich, zweiwöchentlich oder individuell möglich." },
        { label: "Rollt weiter", body: "Nicht ausgegebenes Alltagsgeld bleibt bei dir. Überschreitungen senken nur den Sicher-heute-Wert im nächsten Zyklus — keine Strafen." },
      ],
      [
        { label: "Jour de paie", body: "Choisis le jour et la fréquence dans Entrées. Plusieurs salaires ? bynku utilise le plus récent pour ouvrir le cycle." },
        { label: "Durée", body: "Souvent mensuel, mais possible en hebdo, quinzaine, ou sur mesure." },
        { label: "Report", body: "Ce qui n'est pas dépensé au quotidien reste pour toi. Un dépassement réduit simplement le « sûr aujourd'hui » du cycle suivant — sans pénalité." },
      ],
    ),
  },

  // ------------------------------------------------------------ moneyIn
  {
    id: "moneyIn",
    icon: "Wallet",
    title: L("Money in", "Entradas", "Ingresos", "Einnahmen", "Entrées"),
    paragraphs: L(
      [
        "Money in is your recurring income — the money you can count on. Salary, pension, rent you receive, benefits, or a side income that repeats.",
        "One-off inflows (a gift, a refund, a bonus sale) don't belong here. Record those as 'Money received' in Expenses so they don't inflate your plan.",
      ],
      [
        "Entradas é o teu rendimento recorrente — o dinheiro com que podes contar. Salário, pensão, rendas recebidas, subsídios ou um extra que se repete.",
        "Entradas pontuais (uma prenda, um reembolso, uma venda esporádica) não vão aqui. Regista-as como 'Dinheiro recebido' em Despesas para não inchar o plano.",
      ],
      [
        "Ingresos son los que se repiten — el dinero con el que puedes contar. Nómina, pensión, alquileres cobrados, ayudas o un ingreso extra recurrente.",
        "Los ingresos puntuales (un regalo, una devolución, una venta suelta) no van aquí. Anótalos como 'Dinero recibido' en Gastos para no inflar el plan.",
      ],
      [
        "Einnahmen sind wiederkehrende Zuflüsse — Geld, mit dem du rechnen kannst. Gehalt, Rente, Mieteinnahmen, Sozialleistungen oder ein wiederkehrender Zusatzverdienst.",
        "Einmalige Zuflüsse (Geschenk, Rückerstattung, einmaliger Verkauf) gehören nicht hierher. Erfasse sie als 'Geld erhalten' in Ausgaben, damit dein Plan realistisch bleibt.",
      ],
      [
        "Les entrées sont tes revenus récurrents — l'argent sur lequel tu peux compter. Salaire, pension, loyers reçus, aides ou un revenu d'appoint qui revient.",
        "Les entrées ponctuelles (cadeau, remboursement, vente exceptionnelle) ne vont pas ici. Note-les comme « argent reçu » dans Sorties pour ne pas gonfler le plan.",
      ],
    ),
    bullets: L(
      [
        { label: "Type", body: "Salary, rent, pension, benefits or other — helps the coach spot risks like relying on a single source." },
        { label: "Amount & frequency", body: "Monthly by default. Yearly, quarterly or weekly amounts get spread out evenly for a fair monthly view." },
        { label: "Multiple sources", body: "Add as many as you like. Every household member's income can live here." },
      ],
      [
        { label: "Tipo", body: "Salário, renda, pensão, subsídio ou outro — ajuda o assistente a detetar riscos, como depender de uma única fonte." },
        { label: "Valor e frequência", body: "Mensal por defeito. Valores anuais, trimestrais ou semanais são distribuídos de forma justa por mês." },
        { label: "Várias fontes", body: "Adiciona as que quiseres. Cabe aqui o rendimento de cada pessoa do agregado." },
      ],
      [
        { label: "Tipo", body: "Nómina, alquiler, pensión, ayudas u otro — ayuda al asistente a detectar riesgos como depender de una única fuente." },
        { label: "Importe y frecuencia", body: "Mensual por defecto. Importes anuales, trimestrales o semanales se reparten de forma justa por mes." },
        { label: "Varias fuentes", body: "Añade las que quieras. Cabe aquí el ingreso de cada persona del hogar." },
      ],
      [
        { label: "Typ", body: "Gehalt, Miete, Rente, Sozialleistung oder anderes — hilft dem Coach, Risiken wie eine einzige Einkommensquelle zu erkennen." },
        { label: "Betrag & Häufigkeit", body: "Standard: monatlich. Jahres-, Quartals- oder Wochenbeträge werden fair auf den Monat verteilt." },
        { label: "Mehrere Quellen", body: "So viele du willst. Alle Einkommen aus deinem Haushalt haben hier Platz." },
      ],
      [
        { label: "Type", body: "Salaire, loyer, pension, aide ou autre — aide l'assistant à repérer les risques comme une source unique." },
        { label: "Montant & fréquence", body: "Mensuel par défaut. Les montants annuels, trimestriels ou hebdo sont répartis équitablement par mois." },
        { label: "Plusieurs sources", body: "Autant que tu veux. Les revenus de chaque membre du foyer trouvent leur place ici." },
      ],
    ),
  },

  // ------------------------------------------------------------ moneyOut
  {
    id: "moneyOut",
    icon: "Receipt",
    title: L("Money out", "Saídas", "Gastos", "Ausgaben", "Sorties"),
    paragraphs: L(
      [
        "Two kinds of money out. Regular bills (rent, phone, gym, insurance) that happen every month whether you notice or not. And everyday spending (groceries, coffee, transport) that varies.",
        "You give bynku an estimate for everyday spending. Real expenses then count against it, and the gap between estimate and actual is where habits become visible.",
      ],
      [
        "Há dois tipos de saída. Contas fixas (renda, telemóvel, ginásio, seguros) que acontecem todos os meses, com ou sem a tua atenção. E despesas do dia a dia (mercearia, café, transportes) que variam.",
        "Dás ao bynku uma estimativa para o dia a dia. As despesas reais são descontadas dessa estimativa, e a diferença mostra os teus hábitos.",
      ],
      [
        "Hay dos tipos de gasto. Facturas fijas (alquiler, móvil, gimnasio, seguros) que caen cada mes las mires o no. Y gastos del día a día (compra, café, transporte) que varían.",
        "Le das a bynku una estimación del día a día. Los gastos reales van descontándose de ella, y la diferencia entre estimación y realidad muestra tus hábitos.",
      ],
      [
        "Es gibt zwei Arten. Fixkosten (Miete, Handy, Gym, Versicherungen), die jeden Monat kommen, ob du hinsiehst oder nicht. Und Alltagsausgaben (Einkauf, Kaffee, Transport), die schwanken.",
        "Du gibst bynku eine Schätzung für den Alltag. Reale Ausgaben werden davon abgezogen, und die Differenz macht Gewohnheiten sichtbar.",
      ],
      [
        "Deux types de sorties. Les charges fixes (loyer, mobile, salle de sport, assurances) qui tombent chaque mois, remarquées ou non. Et les dépenses du quotidien (courses, café, transport) qui varient.",
        "Tu donnes à bynku une estimation du quotidien. Les dépenses réelles s'y imputent, et l'écart entre estimation et réalité rend tes habitudes visibles.",
      ],
    ),
    bullets: L(
      [
        { label: "Fixed monthly expenses", body: "Set once in Settings; they reserve themselves at the start of every cycle." },
        { label: "Loans", body: "Kept separately (see Loans) because they have interest and an end date." },
        { label: "Everyday estimate", body: "Your best guess of a normal month. Adjust it whenever the real numbers surprise you." },
        { label: "Record fast", body: "Type, snap a receipt, or dictate a voice note — bynku fills in the details." },
      ],
      [
        { label: "Contas fixas mensais", body: "Defines uma vez em Definições; reservam-se automaticamente no início de cada ciclo." },
        { label: "Créditos", body: "Ficam à parte (ver Créditos) porque têm juros e uma data de fim." },
        { label: "Estimativa do dia a dia", body: "A tua melhor previsão de um mês normal. Ajusta sempre que a realidade te surpreender." },
        { label: "Registar rápido", body: "Escreve, tira foto ao recibo ou grava uma nota de voz — o bynku preenche os detalhes." },
      ],
      [
        { label: "Gastos fijos mensuales", body: "Se fijan una vez en Ajustes; se reservan solos al inicio de cada ciclo." },
        { label: "Préstamos", body: "Van aparte (ver Préstamos) porque tienen interés y fecha de fin." },
        { label: "Estimación del día a día", body: "Tu mejor cálculo de un mes normal. Ajústala cuando la realidad te sorprenda." },
        { label: "Registrar rápido", body: "Escribe, foto al ticket o nota de voz — bynku rellena los detalles." },
      ],
      [
        { label: "Feste Monatskosten", body: "Einmal in Einstellungen setzen; werden zu Beginn jedes Zyklus automatisch reserviert." },
        { label: "Kredite", body: "Separat (siehe Kredite), weil sie Zinsen und ein Enddatum haben." },
        { label: "Alltagsschätzung", body: "Deine beste Annahme für einen normalen Monat. Anpassen, wenn die Realität überrascht." },
        { label: "Schnell erfassen", body: "Tippen, Beleg fotografieren oder Sprachnotiz — bynku füllt die Details aus." },
      ],
      [
        { label: "Charges fixes mensuelles", body: "À définir une fois dans Réglages ; réservées automatiquement au début de chaque cycle." },
        { label: "Crédits", body: "À part (voir Crédits) car ils ont un taux et une fin." },
        { label: "Estimation du quotidien", body: "Ta meilleure idée d'un mois normal. Ajuste-la dès que la réalité te surprend." },
        { label: "Saisie rapide", body: "Écris, photographie un ticket ou dicte une note vocale — bynku remplit les détails." },
      ],
    ),
  },

  // ------------------------------------------------------------ baseline
  {
    id: "baseline",
    icon: "Calculator",
    diagram: "baseline",
    title: L(
      "How much do I need",
      "Quanto preciso",
      "Cuánto necesito",
      "Wie viel brauche ich",
      "Combien il me faut",
    ),
    formula: "need = bills + loans + everyday + cushion",
    paragraphs: L(
      [
        "This is what a normal month costs you. It adds four things: your bills, your loan payments, your everyday spending estimate, and a small safety cushion on top.",
        "The cushion (called 'margin' in Settings) is a small % so that a normal month never leaves you at exactly zero. Small hiccups — a slightly bigger grocery run, an extra tank of fuel — don't derail the plan.",
      ],
      [
        "É o que um mês normal te custa. Soma quatro coisas: as tuas contas fixas, as prestações de créditos, a estimativa do dia a dia e uma pequena almofada por cima.",
        "A almofada (chamada 'margem' em Definições) é uma pequena %, para que um mês normal nunca acabe em zero. Pequenos imprevistos — uma compra maior, um depósito extra — não estragam o plano.",
      ],
      [
        "Es lo que te cuesta un mes normal. Suma cuatro cosas: tus gastos fijos, las cuotas de préstamos, tu estimación del día a día y un pequeño colchón encima.",
        "El colchón (llamado 'margen' en Ajustes) es un pequeño % para que un mes normal no acabe justo a cero. Pequeños sustos — una compra mayor, un depósito extra — no rompen el plan.",
      ],
      [
        "Das sind die Kosten eines normalen Monats. Vier Bausteine: Fixkosten, Kreditraten, Alltagsschätzung und ein kleiner Sicherheitspuffer obendrauf.",
        "Der Puffer (in den Einstellungen 'Margin') ist ein kleiner Prozentsatz, damit ein normaler Monat nicht bei genau null endet. Kleine Überraschungen kippen den Plan nicht.",
      ],
      [
        "C'est ce qu'un mois normal te coûte. Additionne quatre choses : tes charges fixes, tes mensualités de crédit, ton estimation du quotidien et un petit coussin par-dessus.",
        "Le coussin (appelé « marge » dans Réglages) est un petit % pour qu'un mois normal ne finisse pas à zéro pile. Les petites surprises ne cassent pas le plan.",
      ],
    ),
    bullets: L(
      [
        { label: "Bills", body: "Come from Money out → fixed monthly expenses." },
        { label: "Loans", body: "Sum of monthly payments; interest is tracked separately in the Loans section." },
        { label: "Everyday", body: "Your estimate. Reality will teach you the real number — see Analysis." },
        { label: "Cushion", body: "Default 10% on top. Adjust it in Settings if you like a tighter or looser plan." },
      ],
      [
        { label: "Contas", body: "Vêm de Saídas → contas fixas mensais." },
        { label: "Créditos", body: "Soma das prestações mensais; o juro é acompanhado à parte em Créditos." },
        { label: "Dia a dia", body: "A tua estimativa. A realidade ensina o número real — ver Análise." },
        { label: "Almofada", body: "10% por omissão. Ajustável em Definições se preferires um plano mais apertado ou mais folgado." },
      ],
      [
        { label: "Gastos fijos", body: "Vienen de Gastos → gastos fijos mensuales." },
        { label: "Préstamos", body: "Suma de cuotas mensuales; el interés se sigue aparte en Préstamos." },
        { label: "Día a día", body: "Tu estimación. La realidad te enseñará la cifra real — ver Análisis." },
        { label: "Colchón", body: "10% por defecto. Ajústalo en Ajustes si prefieres un plan más ajustado o más holgado." },
      ],
      [
        { label: "Fixkosten", body: "Kommen aus Ausgaben → feste Monatskosten." },
        { label: "Kredite", body: "Summe der Monatsraten; Zinsen laufen separat unter Kredite." },
        { label: "Alltag", body: "Deine Schätzung. Die Realität zeigt dir die echte Zahl — siehe Analyse." },
        { label: "Puffer", body: "Standard 10 % obendrauf. In Einstellungen anpassbar." },
      ],
      [
        { label: "Charges fixes", body: "Viennent de Sorties → charges fixes mensuelles." },
        { label: "Crédits", body: "Somme des mensualités ; les intérêts sont suivis à part dans Crédits." },
        { label: "Quotidien", body: "Ton estimation. La réalité t'apprendra le vrai chiffre — voir Analyse." },
        { label: "Coussin", body: "10 % par défaut. Ajustable dans Réglages si tu veux plus serré ou plus large." },
      ],
    ),
  },

  // ------------------------------------------------------------ safeToSpend
  {
    id: "safeToSpend",
    icon: "Sparkles",
    title: L(
      "Safe to spend today",
      "Podes gastar hoje",
      "Puedes gastar hoy",
      "Heute sicher ausgeben",
      "À dépenser aujourd'hui",
    ),
    paragraphs: L(
      [
        "'Safe to spend today' is your everyday pool divided by the days left in the cycle. It's the answer to 'if I spend this much today, I'll be fine'.",
        "It moves as you spend. Big grocery run today? Tomorrow's number shrinks a little. A refund? It grows. Your fixed bills don't touch this number — they're already reserved.",
      ],
      [
        "'Podes gastar hoje' é a tua reserva do dia a dia dividida pelos dias que faltam no ciclo. Responde a 'se gastar isto hoje, fico bem'.",
        "Muda à medida que gastas. Compra grande hoje? Amanhã o número desce um pouco. Um reembolso? Sobe. As contas fixas não afetam este número — já estão reservadas.",
      ],
      [
        "'Puedes gastar hoy' es tu bolsa del día a día dividida entre los días que quedan del ciclo. Responde a 'si gasto esto hoy, no me pasa nada'.",
        "Cambia según gastas. ¿Compra grande hoy? Mañana el número baja algo. ¿Devolución? Sube. Los gastos fijos no tocan este número — ya están reservados.",
      ],
      [
        "'Heute sicher ausgeben' ist dein Alltagsbudget geteilt durch die verbleibenden Tage im Zyklus. Es beantwortet: 'wenn ich das heute ausgebe, bin ich noch im Rahmen'.",
        "Es bewegt sich mit deinen Ausgaben. Großer Einkauf heute? Morgen sinkt der Wert etwas. Rückerstattung? Er steigt. Fixkosten sind bereits reserviert und ändern diesen Wert nicht.",
      ],
      [
        "« À dépenser aujourd'hui » est ton enveloppe quotidienne divisée par les jours restants du cycle. C'est la réponse à « si je dépense ça aujourd'hui, ça va ».",
        "Il évolue quand tu dépenses. Grosses courses aujourd'hui ? Demain le chiffre baisse un peu. Un remboursement ? Il monte. Les charges fixes n'y touchent pas — déjà réservées.",
      ],
    ),
    bullets: L(
      [
        { label: "Spent", body: "Money leaves the everyday pool." },
        { label: "Received", body: "Refunds, gifts, one-off inflows go back into the pool." },
        { label: "Rolling forward", body: "End the cycle under budget? What's left carries to the next cycle so you're rewarded for restraint." },
      ],
      [
        { label: "Gasto", body: "Sai da reserva do dia a dia." },
        { label: "Recebido", body: "Reembolsos, prendas ou entradas pontuais voltam para a reserva." },
        { label: "Segue em frente", body: "Terminas o ciclo abaixo do orçamento? O que sobra passa para o ciclo seguinte — a contenção é recompensada." },
      ],
      [
        { label: "Gastado", body: "Sale de la bolsa del día a día." },
        { label: "Recibido", body: "Devoluciones, regalos o ingresos puntuales vuelven a la bolsa." },
        { label: "Se traslada", body: "¿Cierras el ciclo por debajo del presupuesto? Lo que sobra pasa al siguiente — se premia la contención." },
      ],
      [
        { label: "Ausgegeben", body: "Verlässt das Alltagsbudget." },
        { label: "Erhalten", body: "Rückerstattungen, Geschenke oder Einmalzuflüsse gehen zurück ins Budget." },
        { label: "Rollt weiter", body: "Unter Budget geblieben? Der Rest wandert in den nächsten Zyklus — Sparen wird belohnt." },
      ],
      [
        { label: "Dépensé", body: "Sort de l'enveloppe du quotidien." },
        { label: "Reçu", body: "Remboursements, cadeaux, entrées ponctuelles reviennent dans l'enveloppe." },
        { label: "Report", body: "Cycle bouclé sous le budget ? Le reste passe au cycle suivant — la modération est récompensée." },
      ],
    ),
  },

  // ------------------------------------------------------------ projects (save & invest)
  {
    id: "projects",
    icon: "PiggyBank",
    diagram: "waterfall",
    title: L(
      "Save & Invest (projects)",
      "Poupar e Investir (projetos)",
      "Ahorrar e invertir (proyectos)",
      "Sparen & Anlegen (Projekte)",
      "Épargner & Investir (projets)",
    ),
    paragraphs: L(
      [
        "What's left after a normal month (income − what you need) is your surplus. Projects are pots where you park it on purpose, instead of letting it disappear.",
        "There are three kinds of project, on purpose. A Savings goal has a target (a trip, a laptop). An Emergency fund is your safety net — the coach counts it first and protects it. An Investment is long-term growth money you don't raid.",
      ],
      [
        "O que sobra depois de um mês normal (rendimento − quanto precisas) é o teu excedente. Os projetos são mealheiros onde o pões de propósito, para não desaparecer.",
        "Há três tipos de projeto, com intenção. Um Objetivo de poupança tem meta (viagem, portátil). Um Fundo de emergência é a tua rede de segurança — o assistente conta-o primeiro e protege-o. Um Investimento é dinheiro de crescimento a longo prazo em que não mexes.",
      ],
      [
        "Lo que sobra tras un mes normal (ingresos − lo que necesitas) es tu excedente. Los proyectos son huchas donde lo dejas a propósito, para que no se evapore.",
        "Hay tres tipos de proyecto, a propósito. Un Objetivo de ahorro tiene meta (viaje, portátil). Un Fondo de emergencia es tu red de seguridad — el asistente lo cuenta primero y lo protege. Una Inversión es dinero de crecimiento a largo plazo que no se toca.",
      ],
      [
        "Was nach einem normalen Monat übrig ist (Einnahmen − Bedarf), ist dein Überschuss. Projekte sind Töpfe, in die du ihn bewusst legst, statt ihn verschwinden zu lassen.",
        "Es gibt drei Projektarten mit Absicht. Ein Sparziel hat ein Ziel (Reise, Laptop). Ein Notgroschen ist dein Sicherheitsnetz — der Coach zählt ihn zuerst und schützt ihn. Eine Anlage ist langfristiges Wachstumsgeld, das du nicht antastest.",
      ],
      [
        "Ce qui reste après un mois normal (revenus − besoin) est ton excédent. Les projets sont des tirelires où tu le déposes exprès, pour qu'il ne s'évapore pas.",
        "Trois types de projets, à dessein. Un Objectif d'épargne a une cible (voyage, ordinateur). Un Fonds d'urgence est ton filet de sécurité — l'assistant le compte en premier et le protège. Un Investissement est de l'argent de croissance à long terme, à ne pas piocher.",
      ],
    ),
    bullets: L(
      [
        { label: "Percent of surplus", body: "Takes a share of whatever surplus you get. Great for variable months." },
        { label: "Fixed per month", body: "Same amount every cycle. Great for steady habits." },
        { label: "Fixed per year", body: "A yearly amount spread across cycles. Great for annual costs." },
        { label: "Goal by date", body: "You set the target and the date. bynku computes the monthly amount needed to arrive on time." },
      ],
      [
        { label: "Percentagem do excedente", body: "Fica com uma parte do que sobrar. Bom para meses variáveis." },
        { label: "Fixo por mês", body: "O mesmo valor todos os ciclos. Bom para hábitos estáveis." },
        { label: "Fixo por ano", body: "Valor anual distribuído pelos ciclos. Bom para custos anuais." },
        { label: "Meta por data", body: "Defines o valor e a data. O bynku calcula o valor mensal para chegar a tempo." },
      ],
      [
        { label: "Porcentaje del excedente", body: "Se queda con una parte de lo que sobre. Ideal para meses variables." },
        { label: "Fijo al mes", body: "El mismo importe cada ciclo. Ideal para hábitos estables." },
        { label: "Fijo al año", body: "Importe anual repartido entre ciclos. Ideal para costes anuales." },
        { label: "Meta por fecha", body: "Fijas importe y fecha. bynku calcula el mensual para llegar a tiempo." },
      ],
      [
        { label: "Prozent vom Überschuss", body: "Nimmt einen Anteil vom Überschuss. Gut für schwankende Monate." },
        { label: "Fest pro Monat", body: "Gleicher Betrag jeden Zyklus. Gut für stabile Gewohnheiten." },
        { label: "Fest pro Jahr", body: "Jahresbetrag über die Zyklen verteilt. Gut für jährliche Kosten." },
        { label: "Ziel bis Datum", body: "Du legst Betrag und Datum fest. bynku errechnet die Monatsrate, um rechtzeitig anzukommen." },
      ],
      [
        { label: "Pourcentage de l'excédent", body: "Prend une part de l'excédent quel qu'il soit. Idéal en mois variables." },
        { label: "Fixe par mois", body: "Le même montant chaque cycle. Idéal en habitudes stables." },
        { label: "Fixe par an", body: "Montant annuel réparti sur les cycles. Idéal pour les coûts annuels." },
        { label: "Objectif à date", body: "Tu fixes montant et date. bynku calcule le mensuel pour arriver à temps." },
      ],
    ),
    callout: L(
      "A common target: an emergency fund covering 3 to 6 months of essential spending before pushing hard into investments.",
      "Uma meta comum: um fundo de emergência que cubra 3 a 6 meses de despesas essenciais antes de investir a sério.",
      "Una meta habitual: un fondo de emergencia que cubra de 3 a 6 meses de gasto esencial antes de invertir con fuerza.",
      "Häufiges Ziel: ein Notgroschen für 3 bis 6 Monate essenzieller Ausgaben, bevor du kräftig anlegst.",
      "Objectif courant : un fonds d'urgence couvrant 3 à 6 mois de dépenses essentielles avant d'investir sérieusement.",
    ),
  },

  // ------------------------------------------------------------ loans
  {
    id: "loans",
    icon: "CreditCard",
    diagram: "ladder",
    title: L(
      "Loans & interest",
      "Créditos e juros",
      "Préstamos e intereses",
      "Kredite & Zinsen",
      "Crédits & intérêts",
    ),
    paragraphs: L(
      [
        "A loan is money you borrow and pay back over time, with interest — the price of borrowing. bynku tracks each loan and shows what it really costs, not just the monthly payment.",
        "The effective rate (often called TAEG in Europe, APR elsewhere) is the true annual cost, fees included. Two loans with the same monthly payment can have very different effective rates — and different real costs over the years.",
      ],
      [
        "Um crédito é dinheiro que pedes emprestado e pagas ao longo do tempo, com juro — o preço de pedir emprestado. O bynku acompanha cada crédito e mostra o custo real, não apenas a prestação.",
        "A taxa efetiva (frequentemente TAEG na Europa) é o custo anual real, com comissões incluídas. Dois créditos com a mesma prestação podem ter TAEG muito diferentes — e custos reais muito diferentes ao longo dos anos.",
      ],
      [
        "Un préstamo es dinero que pides prestado y devuelves con el tiempo, con interés — el precio de pedirlo. bynku sigue cada préstamo y muestra su coste real, no solo la cuota.",
        "La tasa efectiva (a menudo TAE en España, TAEG en Europa) es el coste anual real con comisiones incluidas. Dos préstamos con la misma cuota pueden tener TAE muy distintas — y costes reales muy distintos con los años.",
      ],
      [
        "Ein Kredit ist geliehenes Geld, das du über die Zeit zurückzahlst — mit Zinsen als Preis. bynku verfolgt jeden Kredit und zeigt die wahren Kosten, nicht nur die Rate.",
        "Der Effektivzins (in Europa oft als TAEG oder Effektivzinssatz ausgewiesen) ist die echte Jahresbelastung inklusive Gebühren. Zwei Kredite mit gleicher Rate können sehr unterschiedliche Effektivzinsen — und Gesamtkosten — haben.",
      ],
      [
        "Un crédit, c'est de l'argent emprunté que tu rembourses avec le temps, avec des intérêts — le prix d'emprunter. bynku suit chaque crédit et montre le coût réel, pas seulement la mensualité.",
        "Le taux effectif (souvent TAEG en Europe) est le coût annuel réel, frais inclus. Deux crédits avec la même mensualité peuvent avoir des TAEG très différents — et des coûts réels très différents sur la durée.",
      ],
    ),
    bullets: L(
      [
        { label: "Interest paid so far / left to pay", body: "The coach uses these to compare 'pay off this loan' vs 'invest the extra money' honestly." },
        { label: "Avalanche method", body: "Attack the highest-rate loan first. Saves the most interest over time." },
        { label: "Snowball method", body: "Attack the smallest balance first. Slower on interest, but the quick wins keep you going." },
        { label: "Extra payment preview", body: "See how many months and how much interest you'd save by adding a bit each month." },
      ],
      [
        { label: "Juro pago até agora / a pagar", body: "O assistente usa isto para comparar 'amortizar este crédito' com 'investir o extra' de forma honesta." },
        { label: "Método avalanche", body: "Ataca primeiro o crédito de taxa mais alta. Poupa mais juro no total." },
        { label: "Método bola de neve", body: "Ataca primeiro o saldo mais pequeno. Rende menos em juro, mas as vitórias rápidas motivam." },
        { label: "Simulação de reforço", body: "Vê quantos meses e quanto juro poupas se pagares um pouco a mais por mês." },
      ],
      [
        { label: "Interés pagado / por pagar", body: "El asistente los usa para comparar 'amortizar este préstamo' con 'invertir el extra' de forma honesta." },
        { label: "Método avalancha", body: "Ataca primero el préstamo con tasa más alta. Ahorra más interés a la larga." },
        { label: "Método bola de nieve", body: "Ataca primero el saldo más pequeño. Menos ahorro de interés, pero los pequeños triunfos motivan." },
        { label: "Vista previa de cuota extra", body: "Ve cuántos meses e intereses ahorras pagando un poco más cada mes." },
      ],
      [
        { label: "Gezahlte / verbleibende Zinsen", body: "Der Coach vergleicht damit 'Kredit tilgen' vs 'Extra anlegen' ehrlich." },
        { label: "Avalanche-Methode", body: "Zuerst den Kredit mit dem höchsten Zins tilgen. Spart insgesamt am meisten." },
        { label: "Schneeball-Methode", body: "Zuerst den kleinsten Saldo tilgen. Weniger Zinsersparnis, aber schnelle Erfolge motivieren." },
        { label: "Sondertilgung-Vorschau", body: "Sieh, wie viele Monate und wie viel Zins du sparst, wenn du monatlich etwas mehr zahlst." },
      ],
      [
        { label: "Intérêts payés / à payer", body: "L'assistant s'en sert pour comparer honnêtement « rembourser » vs « investir l'extra »." },
        { label: "Méthode avalanche", body: "S'attaquer d'abord au crédit au taux le plus élevé. Économise le plus d'intérêts." },
        { label: "Méthode boule de neige", body: "S'attaquer d'abord au plus petit solde. Moins d'économies d'intérêts, mais les victoires rapides motivent." },
        { label: "Aperçu de mensualité en plus", body: "Vois combien de mois et d'intérêts tu économises en ajoutant un peu chaque mois." },
      ],
    ),
    callout: L(
      "Rule of thumb: if a loan's effective rate is higher than what your savings could realistically earn, paying it down usually beats investing.",
      "Regra prática: se a TAEG de um crédito for maior do que o que a tua poupança consegue render de forma realista, amortizar costuma bater investir.",
      "Regla práctica: si la TAE de un préstamo supera lo que tu ahorro puede rentar de forma realista, amortizar suele ganar a invertir.",
      "Faustregel: liegt der Effektivzins über der realistischen Rendite deiner Anlage, ist Tilgen meist besser als Anlegen.",
      "Règle simple : si le TAEG d'un crédit dépasse ce que ton épargne peut raisonnablement rapporter, rembourser bat souvent investir.",
    ),
  },

  // ------------------------------------------------------------ assets & net worth
  {
    id: "assets",
    icon: "Wallet",
    title: L(
      "Assets & net worth",
      "Ativos e património",
      "Activos y patrimonio",
      "Vermögen & Nettovermögen",
      "Actifs & valeur nette",
    ),
    paragraphs: L(
      [
        "Assets are the significant things you own that hold real value — a home, land, a car, stocks, bonds, funds, or a business. Everyday things you use up (groceries, a phone) are not assets. bynku keeps a simple list so your whole financial picture is visible, not just your monthly cash flow.",
        "Together with your projects and loans, assets give you your net worth: what you own, plus what you've set aside, minus what you still owe. (Cash sitting in your bank account isn't tracked, so it isn't included.)",
      ],
      [
        "Os ativos são as coisas de valor que possui — uma casa, um terreno, um carro, ações, obrigações, fundos ou um negócio. Aquilo que consome no dia a dia (compras, um telemóvel) não é um ativo. O bynku mantém uma lista simples para que veja a sua situação financeira completa, e não apenas o fluxo de caixa mensal.",
        "Em conjunto com os seus projetos e créditos, os ativos dão-lhe o património líquido: o que possui, mais o que reservou, menos o que ainda deve. (O dinheiro na conta bancária não é acompanhado, por isso não está incluído.)",
      ],
      [
        "Los activos son las cosas de valor que posees: una casa, un terreno, un coche, acciones, bonos, fondos o un negocio. Lo que consumes a diario (la compra, un móvil) no es un activo. bynku mantiene una lista sencilla para que veas tu situación financiera completa, no solo el flujo de caja mensual.",
        "Junto con tus proyectos y préstamos, los activos te dan tu patrimonio neto: lo que posees, más lo que has reservado, menos lo que aún debes. (El efectivo en tu cuenta no se registra, así que no se incluye.)",
      ],
      [
        "Vermögenswerte sind die bedeutenden Dinge, die du besitzt und die echten Wert haben — ein Zuhause, Grundstück, ein Auto, Aktien, Anleihen, Fonds oder ein Unternehmen. Was du im Alltag verbrauchst (Einkäufe, ein Handy), ist kein Vermögenswert. bynku führt eine einfache Liste, damit dein ganzes Finanzbild sichtbar ist, nicht nur der monatliche Geldfluss.",
        "Zusammen mit deinen Projekten und Krediten ergeben Vermögenswerte dein Nettovermögen: was du besitzt, plus was du zurückgelegt hast, minus was du noch schuldest. (Bargeld auf dem Konto wird nicht erfasst und ist daher nicht enthalten.)",
      ],
      [
        "Les actifs sont les biens de valeur que tu possèdes — un logement, un terrain, une voiture, des actions, des obligations, des fonds ou une entreprise. Ce que tu consommes au quotidien (les courses, un téléphone) n'est pas un actif. bynku tient une liste simple pour que toute ta situation financière soit visible, pas seulement les flux du mois.",
        "Avec tes projets et tes crédits, les actifs donnent ta valeur nette : ce que tu possèdes, plus ce que tu as mis de côté, moins ce que tu dois encore. (Les liquidités sur ton compte ne sont pas suivies, donc pas incluses.)",
      ],
    ),
    bullets: L(
      [
        { label: "Value and cost", body: "Record what an asset is worth now and, optionally, what it cost and when. bynku shows the gain or loss, and you can edit the current value anytime as the market moves." },
        { label: "Liquidity", body: "How fast it can become cash, set automatically by type: stocks, bonds and funds are liquid; a vehicle is semi-liquid; property, land and a business are illiquid. Liquid assets act as a backstop to your emergency buffer." },
        { label: "Link a project", body: "Connect an investment project (from Save & Invest) to an asset. Money you put into that project then updates the asset's value and cost automatically — and net worth counts it once, never twice." },
        { label: "Link rent income", body: "Attach a rent-type income to a property to see its yield and price-to-rent ratio, so you can judge a rental at a glance." },
        { label: "Ask the coach", body: "Not sure what something is worth? Ask the coach for a current estimate and how to find a more precise figure." },
      ],
      [
        { label: "Valor e custo", body: "Registe quanto vale agora um ativo e, se quiser, quanto custou e quando. O bynku mostra o ganho ou a perda, e pode editar o valor atual sempre que o mercado mudar." },
        { label: "Liquidez", body: "A rapidez com que se transforma em dinheiro, definida automaticamente pelo tipo: ações, obrigações e fundos são líquidos; um veículo é semilíquido; imóveis, terrenos e um negócio são ilíquidos. Os ativos líquidos servem de reforço ao fundo de emergência." },
        { label: "Associar um projeto", body: "Ligue um projeto de investimento (em Poupar & Investir) a um ativo. O dinheiro que colocar nesse projeto passa a atualizar automaticamente o valor e o custo do ativo — e o património conta-o uma só vez, nunca duas." },
        { label: "Associar rendimento de renda", body: "Associe um rendimento do tipo renda a um imóvel para ver a rentabilidade e o rácio preço-renda, e avaliar o arrendamento de relance." },
        { label: "Peça ao assistente", body: "Não sabe quanto vale algo? Peça uma estimativa atual ao assistente e como obter um valor mais preciso." },
      ],
      [
        { label: "Valor y coste", body: "Registra cuánto vale ahora un activo y, si quieres, cuánto costó y cuándo. bynku muestra la ganancia o pérdida, y puedes editar el valor actual cuando el mercado cambie." },
        { label: "Liquidez", body: "La rapidez con que se convierte en efectivo, fijada automáticamente por el tipo: acciones, bonos y fondos son líquidos; un vehículo es semilíquido; inmuebles, terrenos y un negocio son ilíquidos. Los activos líquidos refuerzan tu fondo de emergencia." },
        { label: "Vincular un proyecto", body: "Conecta un proyecto de inversión (en Ahorrar e invertir) a un activo. El dinero que aportes a ese proyecto actualiza automáticamente el valor y el coste del activo, y el patrimonio lo cuenta una sola vez, nunca dos." },
        { label: "Vincular ingreso por alquiler", body: "Asocia un ingreso de tipo alquiler a un inmueble para ver su rentabilidad y su ratio precio-alquiler, y juzgar el alquiler de un vistazo." },
        { label: "Pregunta al asistente", body: "¿No sabes cuánto vale algo? Pide al asistente una estimación actual y cómo obtener una cifra más precisa." },
      ],
      [
        { label: "Wert und Kosten", body: "Erfasse, was ein Vermögenswert jetzt wert ist und optional, was er gekostet hat und wann. bynku zeigt Gewinn oder Verlust, und du kannst den aktuellen Wert jederzeit anpassen, wenn sich der Markt bewegt." },
        { label: "Liquidität", body: "Wie schnell er zu Bargeld wird, automatisch nach Typ: Aktien, Anleihen und Fonds sind liquide; ein Fahrzeug ist halbliquide; Immobilien, Grundstücke und ein Unternehmen sind illiquide. Liquide Werte stützen deinen Notgroschen." },
        { label: "Projekt verknüpfen", body: "Verbinde ein Anlageprojekt (aus Sparen & Anlegen) mit einem Vermögenswert. Geld, das du in dieses Projekt steckst, aktualisiert dann automatisch Wert und Kosten des Vermögenswerts — und das Nettovermögen zählt es einmal, nie doppelt." },
        { label: "Mieteinnahme verknüpfen", body: "Verknüpfe eine Einnahme vom Typ Miete mit einer Immobilie, um Rendite und Preis-Miete-Verhältnis zu sehen und die Vermietung auf einen Blick zu beurteilen." },
        { label: "Frag den Coach", body: "Unsicher, was etwas wert ist? Bitte den Coach um eine aktuelle Schätzung und wie du einen genaueren Wert findest." },
      ],
      [
        { label: "Valeur et coût", body: "Enregistre ce que vaut un actif aujourd'hui et, si tu veux, ce qu'il a coûté et quand. bynku affiche la plus-value ou la moins-value, et tu peux modifier la valeur actuelle quand le marché bouge." },
        { label: "Liquidité", body: "La vitesse à laquelle il devient liquide, définie automatiquement par type : actions, obligations et fonds sont liquides ; un véhicule est semi-liquide ; l'immobilier, un terrain et une entreprise sont illiquides. Les actifs liquides renforcent ton fonds d'urgence." },
        { label: "Lier un projet", body: "Relie un projet d'investissement (dans Épargner & Investir) à un actif. L'argent versé dans ce projet met alors à jour automatiquement la valeur et le coût de l'actif — et la valeur nette le compte une fois, jamais deux." },
        { label: "Lier un revenu locatif", body: "Associe un revenu de type loyer à un bien pour voir son rendement et son ratio prix-loyer, et juger la location d'un coup d'œil." },
        { label: "Demande à l'assistant", body: "Pas sûr de la valeur ? Demande à l'assistant une estimation actuelle et comment obtenir un chiffre plus précis." },
      ],
    ),
    callout: L(
      "Net worth is a stock, not a flow — it changes slowly. Keep asset values roughly up to date and it becomes a reliable gut-check on how you're really doing over time.",
      "O património líquido é um stock, não um fluxo — muda devagar. Mantenha os valores dos ativos mais ou menos atualizados e terá uma verificação fiável de como está realmente a evoluir ao longo do tempo.",
      "El patrimonio neto es un stock, no un flujo: cambia despacio. Mantén los valores de los activos más o menos al día y tendrás una comprobación fiable de cómo te va realmente con el tiempo.",
      "Nettovermögen ist ein Bestand, kein Fluss — es ändert sich langsam. Halte die Werte grob aktuell, dann wird es zu einer verlässlichen Bauchprüfung, wie du dich über die Zeit wirklich entwickelst.",
      "La valeur nette est un stock, pas un flux — elle évolue lentement. Garde les valeurs à peu près à jour et elle devient un repère fiable de ta trajectoire réelle au fil du temps.",
    ),
  },

  // ------------------------------------------------------------ plans
  {
    id: "plans",
    icon: "CalendarClock",
    title: L("Coming up (plans)", "A caminho (planos)", "Por venir (planes)", "Kommt bald (Pläne)", "À venir (plans)"),
    paragraphs: L(
      [
        "Plans are known future costs (or income) that aren't part of a normal month — a yearly insurance bill, a summer trip, a tax refund. Putting them on the roadmap avoids being caught out.",
        "From a plan you can either open a project and safely accumulate for it, or just keep the reminder and cover it from savings when it lands. Both are valid — some people want the discipline of a project, others just want the nudge.",
      ],
      [
        "Os planos são custos (ou entradas) futuros que já sabes, mas que não fazem parte de um mês normal — um seguro anual, uma viagem de verão, um reembolso de IRS. Pôr no mapa evita apanhar-te desprevenido.",
        "A partir de um plano podes abrir um projeto e acumular com segurança, ou simplesmente ficar com o aviso e cobrir das poupanças quando chegar. Ambas as vias são válidas.",
      ],
      [
        "Los planes son gastos (o ingresos) futuros que ya conoces pero que no forman parte de un mes normal — un seguro anual, un viaje de verano, una devolución de la renta. Ponerlos en el mapa evita pillarte por sorpresa.",
        "Desde un plan puedes abrir un proyecto y ahorrar con orden, o solo dejar el aviso y cubrirlo del ahorro cuando toque. Ambas opciones son válidas.",
      ],
      [
        "Pläne sind bekannte künftige Kosten (oder Einnahmen), die nicht zum normalen Monat gehören — jährliche Versicherung, Sommerreise, Steuerrückzahlung. Auf der Karte zu haben verhindert Überraschungen.",
        "Aus einem Plan kannst du entweder ein Projekt öffnen und sicher ansparen, oder einfach den Hinweis behalten und aus den Ersparnissen abdecken, wenn es soweit ist. Beides ist ok.",
      ],
      [
        "Les plans sont des coûts (ou revenus) futurs déjà connus mais hors mois normal — assurance annuelle, voyage d'été, retour d'impôt. Les mettre sur la carte évite les surprises.",
        "À partir d'un plan tu peux ouvrir un projet et épargner tranquillement, ou juste garder le rappel et payer sur l'épargne le moment venu. Les deux sont valables.",
      ],
    ),
    bullets: L(
      [
        { label: "One-off", body: "A single date on the calendar (e.g. car service in March)." },
        { label: "Repeating", body: "Every month, quarter, year — bynku spreads it across your cycles." },
        { label: "Impact chart", body: "Shows how the plan bends your cash line over time, so you can see the moment coming." },
      ],
      [
        { label: "Único", body: "Uma data no calendário (ex. revisão do carro em março)." },
        { label: "Repetido", body: "Todos os meses, trimestres ou anos — o bynku distribui pelos teus ciclos." },
        { label: "Gráfico de impacto", body: "Mostra como o plano dobra a tua linha de tesouraria ao longo do tempo, para veres o momento a chegar." },
      ],
      [
        { label: "Único", body: "Una fecha en el calendario (p. ej. revisión del coche en marzo)." },
        { label: "Repetido", body: "Cada mes, trimestre o año — bynku lo reparte por tus ciclos." },
        { label: "Gráfico de impacto", body: "Muestra cómo el plan dobla tu línea de tesorería con el tiempo, para ver venir el momento." },
      ],
      [
        { label: "Einmalig", body: "Ein Datum im Kalender (z. B. Autoinspektion im März)." },
        { label: "Wiederkehrend", body: "Monatlich, quartalsweise, jährlich — bynku verteilt es über deine Zyklen." },
        { label: "Impact-Chart", body: "Zeigt, wie der Plan deine Liquiditätslinie krümmt — den Moment kommen sehen." },
      ],
      [
        { label: "Unique", body: "Une date au calendrier (ex. révision de la voiture en mars)." },
        { label: "Récurrent", body: "Chaque mois, trimestre, année — bynku le répartit sur tes cycles." },
        { label: "Graphique d'impact", body: "Montre comment le plan infléchit ta ligne de trésorerie dans le temps — voir venir." },
      ],
    ),
  },

  // ------------------------------------------------------------ analysis
  {
    id: "analysis",
    icon: "BarChart3",
    title: L(
      "Analysis & benchmarks",
      "Análise e comparações",
      "Análisis y referencias",
      "Analyse & Vergleiche",
      "Analyse & repères",
    ),
    paragraphs: L(
      [
        "The Analysis tab looks back at your cycle and compares your spending to real-world data for your country. It's how the abstract 'estimate' becomes a concrete number you can trust.",
        "The burndown chart shows how your everyday budget drained during the cycle, versus the straight line you'd expect if you spent evenly. Steady is good; a cliff means catch-up cycles.",
      ],
      [
        "O separador Análise olha para o ciclo que passou e compara os teus gastos com dados reais do teu país. É como a 'estimativa' abstrata se torna um número concreto de confiança.",
        "O gráfico de desgaste mostra como a tua reserva do dia a dia foi caindo no ciclo, comparado com a linha reta esperada se gastasses de forma regular. Estável é bom; um penhasco significa ciclos de recuperação à frente.",
      ],
      [
        "La pestaña Análisis mira el ciclo que acaba y compara tu gasto con datos reales de tu país. Así la 'estimación' abstracta se convierte en un número concreto en el que puedes confiar.",
        "El gráfico de consumo muestra cómo bajó tu bolsa del día a día a lo largo del ciclo, frente a la línea recta esperable si gastases parejo. Estable es bueno; un acantilado avisa de ciclos de recuperación.",
      ],
      [
        "Der Tab Analyse blickt auf den vergangenen Zyklus und vergleicht deine Ausgaben mit realen Daten deines Landes. So wird aus der abstrakten 'Schätzung' eine belastbare Zahl.",
        "Die Burndown-Kurve zeigt, wie dein Alltagsbudget im Zyklus geschmolzen ist, gegenüber der geraden Linie bei gleichmäßiger Ausgabe. Stetig ist gut; eine Kante bedeutet Aufholzyklen.",
      ],
      [
        "L'onglet Analyse regarde le cycle écoulé et compare tes dépenses aux données réelles de ton pays. C'est ainsi que l'« estimation » abstraite devient un chiffre concret et fiable.",
        "La courbe de consommation montre comment ton enveloppe quotidienne a fondu sur le cycle, face à la ligne droite attendue si tu dépensais régulièrement. Stable c'est bien ; une falaise annonce des cycles de rattrapage.",
      ],
    ),
    bullets: L(
      [
        { label: "Categories", body: "Where your money went, this cycle and vs your usual pattern." },
        { label: "Benchmarks", body: "From public statistics (Eurostat) — what similar households in your country spend. Reference, not rule." },
        { label: "Adopt as new estimate", body: "If reality keeps beating your estimate, adopt the real figure with one tap." },
      ],
      [
        { label: "Categorias", body: "Para onde foi o dinheiro, neste ciclo e face ao teu padrão." },
        { label: "Referências", body: "De estatísticas públicas (Eurostat) — o que gastam agregados semelhantes no teu país. Referência, não regra." },
        { label: "Adotar como nova estimativa", body: "Se a realidade continua a bater a estimativa, adota o valor real com um toque." },
      ],
      [
        { label: "Categorías", body: "Adónde fue el dinero, este ciclo y frente a tu patrón habitual." },
        { label: "Referencias", body: "De estadísticas públicas (Eurostat) — lo que gastan hogares parecidos en tu país. Referencia, no norma." },
        { label: "Adoptar como nueva estimación", body: "Si la realidad supera a tu estimación, adopta el importe real con un toque." },
      ],
      [
        { label: "Kategorien", body: "Wohin dein Geld floss, in diesem Zyklus und im Vergleich zum Muster." },
        { label: "Vergleichswerte", body: "Aus öffentlichen Statistiken (Eurostat) — was vergleichbare Haushalte in deinem Land ausgeben. Referenz, keine Regel." },
        { label: "Als neue Schätzung übernehmen", body: "Wenn die Realität deine Schätzung dauerhaft schlägt, übernimm den echten Wert mit einem Tipp." },
      ],
      [
        { label: "Catégories", body: "Où est parti l'argent, ce cycle et par rapport à ton habitude." },
        { label: "Repères", body: "Statistiques publiques (Eurostat) — ce que dépensent des foyers comparables dans ton pays. Repère, pas règle." },
        { label: "Adopter comme nouvelle estimation", body: "Si la réalité bat toujours ton estimation, adopte le chiffre réel d'un toucher." },
      ],
    ),
  },

  // ------------------------------------------------------------ coach
  {
    id: "coach",
    icon: "MessageCircle",
    title: L("The AI coach", "O assistente com IA", "El asistente con IA", "Der KI-Coach", "L'assistant IA"),
    paragraphs: L(
      [
        "The coach is an AI assistant that knows your numbers. Ask it in plain language: 'should I overpay my loan?', 'am I saving enough?', 'help me plan a move'.",
        "It remembers the last few messages in each conversation so follow-ups make sense. Start a new topic any time — old conversations stay in your history.",
      ],
      [
        "O assistente é uma IA que conhece os teus números. Pergunta em linguagem simples: 'devo reforçar o meu crédito?', 'estou a poupar o suficiente?', 'ajuda-me a planear uma mudança'.",
        "Guarda as últimas mensagens em cada conversa para que os seguimentos façam sentido. Podes começar um tema novo quando quiseres — as conversas anteriores ficam no histórico.",
      ],
      [
        "El asistente es una IA que conoce tus números. Pregúntale en lenguaje sencillo: '¿amortizo el préstamo?', '¿estoy ahorrando lo suficiente?', 'ayúdame a planear una mudanza'.",
        "Recuerda los últimos mensajes de cada conversación para que las respuestas encajen. Inicia un tema nuevo cuando quieras — las conversaciones antiguas quedan en el historial.",
      ],
      [
        "Der Coach ist eine KI, die deine Zahlen kennt. Frag ihn in einfacher Sprache: 'soll ich meinen Kredit sondertilgen?', 'spare ich genug?', 'hilf mir bei einem Umzug'.",
        "Er merkt sich die letzten Nachrichten je Konversation, damit Rückfragen sitzen. Du kannst jederzeit ein neues Thema starten — alte Gespräche bleiben im Verlauf.",
      ],
      [
        "L'assistant est une IA qui connaît tes chiffres. Pose-lui des questions simples : « je rembourse en avance ? », « j'épargne assez ? », « aide-moi à préparer un déménagement ».",
        "Il retient les derniers messages de chaque conversation pour que les suites tiennent debout. Ouvre un nouveau sujet quand tu veux — les anciennes conversations restent dans l'historique.",
      ],
    ),
    bullets: L(
      [
        { label: "Suggestions on the dashboard", body: "The coach flags setup gaps and opportunities (single income source, no emergency fund, over-allocated cycle). Dismiss any that don't apply." },
        { label: "Privacy", body: "Your data stays inside your household. The AI sees numbers and categories, not receipts or shop names." },
        { label: "Cost", body: "Each message uses a bit of your monthly credit — see Credits & AI usage." },
      ],
      [
        { label: "Sugestões no painel", body: "O assistente aponta lacunas e oportunidades (uma única fonte de rendimento, sem fundo de emergência, ciclo sobre-alocado). Dispensa as que não se aplicam." },
        { label: "Privacidade", body: "Os teus dados ficam dentro do agregado. A IA vê números e categorias, não recibos nem nomes de lojas." },
        { label: "Custo", body: "Cada mensagem gasta uma pequena parte do crédito mensal — ver Créditos e utilização de IA." },
      ],
      [
        { label: "Sugerencias en el panel", body: "El asistente señala huecos y oportunidades (ingreso único, sin fondo de emergencia, ciclo sobreasignado). Descarta las que no te encajen." },
        { label: "Privacidad", body: "Tus datos se quedan en el hogar. La IA ve números y categorías, no tickets ni nombres de tiendas." },
        { label: "Coste", body: "Cada mensaje consume un poco de tu crédito mensual — ver Créditos y uso de IA." },
      ],
      [
        { label: "Vorschläge im Dashboard", body: "Der Coach zeigt Lücken und Chancen (einziges Einkommen, kein Notgroschen, überplanter Zyklus). Nicht Passendes einfach ausblenden." },
        { label: "Datenschutz", body: "Deine Daten bleiben im Haushalt. Die KI sieht Zahlen und Kategorien, keine Belege oder Shopnamen." },
        { label: "Kosten", body: "Jede Nachricht verbraucht etwas vom Monatskredit — siehe Credits & KI-Nutzung." },
      ],
      [
        { label: "Suggestions au tableau de bord", body: "L'assistant repère lacunes et opportunités (revenu unique, pas de fonds d'urgence, cycle sur-alloué). Rejette celles qui ne te concernent pas." },
        { label: "Confidentialité", body: "Tes données restent dans le foyer. L'IA voit des chiffres et catégories, pas de tickets ni de noms d'enseignes." },
        { label: "Coût", body: "Chaque message consomme un peu de ton crédit mensuel — voir Crédits et utilisation IA." },
      ],
    ),
  },

  // ------------------------------------------------------------ settings
  {
    id: "settings",
    icon: "Settings",
    title: L(
      "Settings & households",
      "Definições e agregados",
      "Ajustes y hogares",
      "Einstellungen & Haushalte",
      "Réglages & foyers",
    ),
    paragraphs: L(
      [
        "Settings holds the preferences that shape the app: currency, country, language, the safety cushion %, notifications, and privacy actions like export or delete.",
        "A household is your money space. You can invite people to share one, or create separate households for different lives — personal, freelance, a family budget.",
      ],
      [
        "As Definições guardam as preferências que moldam a app: moeda, país, idioma, a % de almofada, notificações e ações de privacidade como exportar ou apagar.",
        "Um agregado é o teu espaço de dinheiro. Podes convidar pessoas para partilhar, ou criar agregados separados para vidas diferentes — pessoal, freelance, orçamento de família.",
      ],
      [
        "Ajustes guarda las preferencias que moldean la app: moneda, país, idioma, % de colchón, notificaciones y acciones de privacidad como exportar o borrar.",
        "Un hogar es tu espacio de dinero. Invita a personas para compartirlo o crea varios hogares para vidas distintas — personal, autónomo, presupuesto familiar.",
      ],
      [
        "In den Einstellungen liegen Vorlieben, die die App prägen: Währung, Land, Sprache, Puffer-%, Benachrichtigungen und Datenschutz-Aktionen wie Export oder Löschen.",
        "Ein Haushalt ist dein Geldraum. Lade Menschen ein oder erstelle mehrere Haushalte für unterschiedliche Leben — privat, freiberuflich, Familienbudget.",
      ],
      [
        "Les Réglages regroupent les préférences qui façonnent l'app : devise, pays, langue, % de coussin, notifications et actions de confidentialité comme l'export ou la suppression.",
        "Un foyer est ton espace argent. Invite des personnes à le partager, ou crée plusieurs foyers pour des vies distinctes — perso, freelance, budget familial.",
      ],
    ),
    bullets: L(
      [
        { label: "Members & roles", body: "The owner controls settings; members can add income and expenses." },
        { label: "Categories & labels", body: "Rename or add categories; tag expenses with labels for cross-cutting views (e.g. 'work trip')." },
        { label: "Danger zone", body: "Export everything as JSON, or wipe your account and all data at any time." },
      ],
      [
        { label: "Membros e papéis", body: "O proprietário controla as definições; os membros podem adicionar entradas e despesas." },
        { label: "Categorias e etiquetas", body: "Renomeia ou adiciona categorias; marca despesas com etiquetas para cortes transversais (ex. 'viagem de trabalho')." },
        { label: "Zona de perigo", body: "Exportar tudo em JSON, ou apagar a conta e todos os dados a qualquer momento." },
      ],
      [
        { label: "Miembros y roles", body: "El propietario controla los ajustes; los miembros pueden añadir ingresos y gastos." },
        { label: "Categorías y etiquetas", body: "Renombra o añade categorías; etiqueta gastos para vistas transversales (p. ej. 'viaje de trabajo')." },
        { label: "Zona peligrosa", body: "Exportar todo en JSON, o borrar la cuenta y todos los datos cuando quieras." },
      ],
      [
        { label: "Mitglieder & Rollen", body: "Der Eigentümer verwaltet Einstellungen; Mitglieder erfassen Einnahmen und Ausgaben." },
        { label: "Kategorien & Labels", body: "Kategorien umbenennen oder ergänzen; Ausgaben mit Labels versehen für Querschnitte (z. B. 'Dienstreise')." },
        { label: "Gefahrenzone", body: "Alles als JSON exportieren oder Konto und Daten jederzeit löschen." },
      ],
      [
        { label: "Membres & rôles", body: "Le propriétaire gère les réglages ; les membres saisissent entrées et sorties." },
        { label: "Catégories & étiquettes", body: "Renomme ou ajoute des catégories ; étiquette les dépenses pour des vues transverses (ex. « voyage pro »)." },
        { label: "Zone dangereuse", body: "Exporter tout en JSON, ou supprimer le compte et toutes les données à tout moment." },
      ],
    ),
  },

  // ------------------------------------------------------------ notifications
  {
    id: "notifications",
    icon: "Bell",
    title: L("Notifications", "Notificações", "Notificaciones", "Benachrichtigungen", "Notifications"),
    paragraphs: L(
      [
        "bynku can nudge you at moments that matter — a payday landing, a bill due, a budget slipping, or a short weekly digest of how the cycle is going.",
        "Every channel is opt-in. Turn each one on or off in Settings → Notifications. You'll only be pinged for things you asked to hear about.",
      ],
      [
        "O bynku pode dar-te um empurrão nos momentos que interessam — a chegada do salário, uma conta a vencer, um orçamento a fugir ou um resumo semanal do ciclo.",
        "Todos os canais são opcionais. Liga ou desliga cada um em Definições → Notificações. Só serás avisado do que pediste para receber.",
      ],
      [
        "bynku puede darte un aviso en momentos clave — llegada de nómina, factura próxima, un presupuesto que se desvía o un resumen semanal del ciclo.",
        "Cada canal es opcional. Actívalo o desactívalo en Ajustes → Notificaciones. Solo te avisamos de lo que quieres oír.",
      ],
      [
        "bynku kann dich zu wichtigen Momenten anstupsen — Gehaltseingang, fällige Rechnung, ein Budget, das aus dem Ruder läuft, oder eine kurze Wochenübersicht.",
        "Alle Kanäle sind optional. Aktiviere jeden einzeln in Einstellungen → Benachrichtigungen. Es meldet sich nur, was du hören willst.",
      ],
      [
        "bynku peut te rappeler les moments importants — arrivée de paie, facture à venir, budget qui dérive, ou un court récap hebdomadaire du cycle.",
        "Chaque canal est optionnel. Active-les dans Réglages → Notifications. Seul ce que tu veux entendre te parviendra.",
      ],
    ),
    bullets: L(
      [
        { label: "Payday", body: "A gentle nudge to allocate the new money before it disappears." },
        { label: "Budget alerts", body: "Warnings when a category is drifting well beyond typical." },
        { label: "Weekly digest", body: "A short email or push with the cycle's progress and any coach suggestions." },
      ],
      [
        { label: "Dia de pagamento", body: "Um empurrão para alocares o novo dinheiro antes que desapareça." },
        { label: "Alertas de orçamento", body: "Avisos quando uma categoria está a fugir muito do habitual." },
        { label: "Resumo semanal", body: "Um email ou notificação curta com o progresso do ciclo e sugestões do assistente." },
      ],
      [
        { label: "Día de cobro", body: "Un empujón para asignar el dinero nuevo antes de que se esfume." },
        { label: "Alertas de presupuesto", body: "Avisos si una categoría se aleja mucho de lo habitual." },
        { label: "Resumen semanal", body: "Un email o aviso corto con el avance del ciclo y sugerencias del asistente." },
      ],
      [
        { label: "Zahltag", body: "Ein sanfter Stups, das neue Geld zuzuweisen, bevor es weg ist." },
        { label: "Budget-Warnungen", body: "Hinweis, wenn eine Kategorie stark aus dem üblichen Rahmen fällt." },
        { label: "Wochen-Digest", body: "Kurze E-Mail oder Push mit Zyklusfortschritt und Coach-Tipps." },
      ],
      [
        { label: "Jour de paie", body: "Un léger rappel pour affecter le nouvel argent avant qu'il ne s'évapore." },
        { label: "Alertes budget", body: "Un signal quand une catégorie s'éloigne nettement de l'habitude." },
        { label: "Récap hebdo", body: "Un mail ou push court avec l'avancée du cycle et les suggestions du coach." },
      ],
    ),
  },

  // ------------------------------------------------------------ privacy
  {
    id: "privacy",
    icon: "ShieldCheck",
    title: L(
      "Privacy & your data",
      "Privacidade e os teus dados",
      "Privacidad y tus datos",
      "Datenschutz & deine Daten",
      "Confidentialité & tes données",
    ),
    paragraphs: L(
      [
        "Your data belongs to you. bynku stores it encrypted at rest and scopes access to your household — nobody outside it can see your numbers, ever.",
        "You can export everything as JSON, or erase your account and all data at any time. This is GDPR-friendly by design, not as an afterthought.",
      ],
      [
        "Os teus dados são teus. O bynku guarda-os encriptados em repouso e limita o acesso ao teu agregado — ninguém de fora vê os teus números, em circunstância alguma.",
        "Podes exportar tudo em JSON ou apagar a conta e todos os dados quando quiseres. É compatível com o RGPD por desenho, não por acréscimo.",
      ],
      [
        "Tus datos son tuyos. bynku los guarda cifrados en reposo y limita el acceso a tu hogar — nadie de fuera puede ver tus cifras, en ningún caso.",
        "Puedes exportar todo en JSON o borrar la cuenta y los datos cuando quieras. Compatible con el RGPD por diseño, no como añadido.",
      ],
      [
        "Deine Daten gehören dir. bynku speichert sie im Ruhezustand verschlüsselt und beschränkt den Zugriff auf deinen Haushalt — niemand außerhalb sieht deine Zahlen.",
        "Du kannst alles als JSON exportieren oder Konto und Daten jederzeit löschen. DSGVO-freundlich by design, nicht nachträglich.",
      ],
      [
        "Tes données t'appartiennent. bynku les stocke chiffrées au repos et limite l'accès à ton foyer — personne d'extérieur ne voit tes chiffres, jamais.",
        "Tu peux tout exporter en JSON, ou supprimer ton compte et toutes tes données à tout moment. Conforme RGPD par conception, pas en rustine.",
      ],
    ),
    bullets: L(
      [
        { label: "Export", body: "Settings → Danger zone → Export all data (JSON)." },
        { label: "Erase", body: "Settings → Danger zone → Delete account. Permanent and immediate." },
        { label: "Sharing", body: "Only members of your household see the household's data. Nothing is shared across households." },
      ],
      [
        { label: "Exportar", body: "Definições → Zona de perigo → Exportar tudo (JSON)." },
        { label: "Apagar", body: "Definições → Zona de perigo → Apagar conta. Permanente e imediato." },
        { label: "Partilha", body: "Só os membros do agregado veem os dados do agregado. Nada é partilhado entre agregados." },
      ],
      [
        { label: "Exportar", body: "Ajustes → Zona peligrosa → Exportar todo (JSON)." },
        { label: "Borrar", body: "Ajustes → Zona peligrosa → Borrar cuenta. Permanente e inmediato." },
        { label: "Compartir", body: "Solo los miembros del hogar ven los datos del hogar. Nada se comparte entre hogares." },
      ],
      [
        { label: "Export", body: "Einstellungen → Gefahrenzone → Alles exportieren (JSON)." },
        { label: "Löschen", body: "Einstellungen → Gefahrenzone → Konto löschen. Endgültig und sofort." },
        { label: "Teilen", body: "Nur Mitglieder deines Haushalts sehen dessen Daten. Zwischen Haushalten wird nichts geteilt." },
      ],
      [
        { label: "Export", body: "Réglages → Zone dangereuse → Tout exporter (JSON)." },
        { label: "Suppression", body: "Réglages → Zone dangereuse → Supprimer le compte. Définitif et immédiat." },
        { label: "Partage", body: "Seuls les membres de ton foyer voient les données du foyer. Rien n'est partagé entre foyers." },
      ],
    ),
  },

  // ------------------------------------------------------------ credits
  {
    id: "credits",
    icon: "Sparkles",
    title: L(
      "Credits & AI usage",
      "Créditos e utilização de IA",
      "Créditos y uso de IA",
      "Credits & KI-Nutzung",
      "Crédits & utilisation IA",
    ),
    paragraphs: L(
      [
        "The AI features — the coach, snapping a receipt, dictating a voice note — use 'credits'. Each household has a small monthly cap (currently 7.5) shared across all AI features.",
        "Under the hood, AI models charge per 'token' (roughly ¾ of a word). bynku converts token usage into a fraction of a credit, so you almost never spend a whole credit on a single message.",
      ],
      [
        "As funcionalidades de IA — o assistente, foto ao recibo, ditar uma nota de voz — usam 'créditos'. Cada agregado tem um pequeno teto mensal (atualmente 7,5) partilhado por todas as funções de IA.",
        "Nos bastidores, os modelos de IA cobram por 'token' (cerca de ¾ de uma palavra). O bynku converte o uso de tokens numa fração de crédito, portanto quase nunca gastas um crédito inteiro numa só mensagem.",
      ],
      [
        "Las funciones de IA — el asistente, foto al ticket, dictar una nota de voz — usan 'créditos'. Cada hogar tiene un pequeño tope mensual (ahora 7,5) compartido entre todas las funciones de IA.",
        "Por dentro, los modelos de IA cobran por 'token' (más o menos ¾ de una palabra). bynku convierte el uso de tokens en fracción de crédito, así que casi nunca gastas un crédito entero en un solo mensaje.",
      ],
      [
        "Die KI-Funktionen — Coach, Beleg fotografieren, Sprachnotiz — nutzen 'Credits'. Jeder Haushalt hat ein kleines Monatslimit (aktuell 7,5), das alle KI-Funktionen teilen.",
        "Unter der Haube rechnen KI-Modelle in 'Token' (etwa ¾ eines Wortes). bynku rechnet Tokens in Bruchteile eines Credits um — eine einzelne Nachricht kostet fast nie einen ganzen Credit.",
      ],
      [
        "Les fonctions IA — l'assistant, photo de ticket, note vocale — consomment des « crédits ». Chaque foyer a un petit plafond mensuel (actuellement 7,5) partagé entre toutes les fonctions IA.",
        "En coulisse, les modèles IA facturent au « token » (environ ¾ d'un mot). bynku convertit les tokens en fraction de crédit, donc un seul message coûte presque jamais un crédit entier.",
      ],
    ),
    bullets: L(
      [
        { label: "Chat with the coach", body: "Usually 0.01–0.05 credits per short message. Long conversations add up faster than one-off questions." },
        { label: "Photo of a receipt", body: "Around 0.05 credits per photo. Clear pictures cost less because the model works less." },
        { label: "Voice note", body: "Around 0.02 credits per short recording. Speak clearly and pause background noise if you can." },
        { label: "Top-ups", body: "Credit top-ups will be available soon. For now, the monthly cap resets automatically." },
      ],
      [
        { label: "Conversar com o assistente", body: "Normalmente 0,01–0,05 créditos por mensagem curta. Conversas longas somam mais depressa que perguntas soltas." },
        { label: "Foto ao recibo", body: "Cerca de 0,05 créditos por foto. Fotos nítidas custam menos, porque o modelo trabalha menos." },
        { label: "Nota de voz", body: "Cerca de 0,02 créditos por gravação curta. Fala claro e reduz o ruído se possível." },
        { label: "Recargas", body: "Recargas de créditos em breve. Por agora, o teto mensal renova-se automaticamente." },
      ],
      [
        { label: "Chat con el asistente", body: "Suele ser 0,01–0,05 créditos por mensaje corto. Las conversaciones largas suman más rápido que preguntas sueltas." },
        { label: "Foto al ticket", body: "En torno a 0,05 créditos por foto. Fotos nítidas cuestan menos porque el modelo trabaja menos." },
        { label: "Nota de voz", body: "En torno a 0,02 créditos por grabación corta. Habla claro y reduce el ruido si puedes." },
        { label: "Recargas", body: "Las recargas de créditos estarán disponibles pronto. Por ahora el tope mensual se renueva solo." },
      ],
      [
        { label: "Chat mit dem Coach", body: "Meist 0,01–0,05 Credits pro kurzer Nachricht. Lange Gespräche summieren sich schneller als Einzelfragen." },
        { label: "Beleg fotografieren", body: "Ca. 0,05 Credits pro Foto. Klare Bilder kosten weniger, weil das Modell weniger arbeitet." },
        { label: "Sprachnotiz", body: "Ca. 0,02 Credits pro kurzer Aufnahme. Klar sprechen, Nebengeräusche reduzieren." },
        { label: "Aufladungen", body: "Credit-Aufladungen kommen bald. Bis dahin setzt sich das Monatslimit automatisch zurück." },
      ],
      [
        { label: "Chat avec l'assistant", body: "En général 0,01–0,05 crédits par court message. Les longues conversations montent plus vite que les questions isolées." },
        { label: "Photo d'un ticket", body: "Environ 0,05 crédits par photo. Des photos nettes coûtent moins car le modèle travaille moins." },
        { label: "Note vocale", body: "Environ 0,02 crédits par court enregistrement. Parle clairement et limite le bruit si possible." },
        { label: "Recharges", body: "Les recharges de crédits arrivent bientôt. En attendant, le plafond mensuel se réinitialise tout seul." },
      ],
    ),
    callout: L(
      "Save credits: keep chats focused, dismiss suggestions you don't want to discuss, and prefer typing over voice for very short entries.",
      "Poupar créditos: mantém as conversas focadas, dispensa sugestões que não queres discutir e prefere escrever a falar em entradas muito curtas.",
      "Ahorra créditos: mantén las conversaciones enfocadas, descarta sugerencias que no quieras y prefiere teclear a hablar en entradas muy cortas.",
      "Credits sparen: fokussiert chatten, unpassende Vorschläge ausblenden und bei sehr kurzen Einträgen lieber tippen als sprechen.",
      "Économiser des crédits : rester focalisé, écarter les suggestions inutiles, et taper plutôt que parler pour les saisies très courtes.",
    ),
  },

  // ------------------------------------------------------------ faq
  {
    id: "faq",
    icon: "HelpCircle",
    faq: true,
    title: L("FAQ", "Perguntas frequentes", "Preguntas frecuentes", "FAQ", "FAQ"),
    paragraphs: L([], [], [], [], []),
    bullets: L(
      [
        { label: "Why cycles, not calendar months?", body: "Because most people live pay-to-pay. A cycle reflects reality better than the calendar, so 'safe to spend today' is honest." },
        { label: "My salary shows in the expenses list — why?", body: "Money in and Money out share the same timeline so you see the full picture. Salary rows are marked as 'received' and boost the pool, not spent from it." },
        { label: "I feel over-allocated. What now?", body: "Reduce or pause a project — nothing is billed automatically. bynku only tracks intentions until real money moves." },
        { label: "I went over baseline this cycle.", body: "It's fine. bynku doesn't punish you. Next cycle's safe-to-spend simply starts a little lower until you catch up." },
        { label: "Is the AI always right?", body: "No. It gives grounded suggestions based on your numbers, but you make the calls. Ask it to explain any advice you're unsure about." },
      ],
      [
        { label: "Porquê ciclos, e não meses do calendário?", body: "Porque a maioria vive de salário em salário. Um ciclo reflete a realidade melhor que o calendário, tornando o 'seguro para hoje' honesto." },
        { label: "O meu salário aparece na lista de despesas — porquê?", body: "As entradas e saídas partilham a mesma linha temporal para veres o quadro completo. As linhas de salário aparecem como 'recebido' e reforçam a reserva, não são gastas." },
        { label: "Sinto que aloquei demais. E agora?", body: "Reduz ou pausa um projeto — nada é cobrado automaticamente. O bynku só regista intenções até que o dinheiro se mova mesmo." },
        { label: "Ultrapassei o baseline neste ciclo.", body: "Está tudo bem. O bynku não castiga. O 'seguro para hoje' do próximo ciclo começa apenas um pouco mais baixo até equilibrares." },
        { label: "A IA está sempre certa?", body: "Não. Dá sugestões fundamentadas nos teus números, mas quem decide és tu. Pede-lhe para explicar qualquer conselho em dúvida." },
      ],
      [
        { label: "¿Por qué ciclos y no meses naturales?", body: "Porque la mayoría vive de nómina a nómina. Un ciclo refleja la realidad mejor que el calendario, así 'seguro para hoy' es honesto." },
        { label: "Mi nómina aparece en la lista de gastos — ¿por qué?", body: "Ingresos y Gastos comparten la misma línea temporal para ver el cuadro completo. Las filas de nómina se marcan como 'recibido' y alimentan la bolsa, no se gastan." },
        { label: "Siento que me pasé asignando. ¿Y ahora?", body: "Reduce o pausa un proyecto — nada se cobra automáticamente. bynku solo registra intenciones hasta que se mueve dinero real." },
        { label: "Me pasé del baseline este ciclo.", body: "No pasa nada. bynku no castiga. El 'seguro para hoy' del próximo ciclo simplemente empieza algo más bajo hasta recuperarte." },
        { label: "¿La IA acierta siempre?", body: "No. Da sugerencias fundadas en tus números, pero decides tú. Pídele que explique cualquier consejo que te haga dudar." },
      ],
      [
        { label: "Warum Zyklen statt Kalendermonate?", body: "Weil viele Menschen von Gehalt zu Gehalt leben. Ein Zyklus bildet die Realität besser ab — 'heute sicher' wird ehrlich." },
        { label: "Mein Gehalt taucht in der Ausgabenliste auf — warum?", body: "Einnahmen und Ausgaben liegen auf derselben Zeitleiste. Gehaltsposten sind als 'erhalten' markiert und füllen das Budget, statt daraus abgezogen zu werden." },
        { label: "Ich fühle mich überplant. Was jetzt?", body: "Ein Projekt reduzieren oder pausieren — nichts wird automatisch abgebucht. bynku führt nur Absichten, bis echtes Geld fließt." },
        { label: "Ich habe das Baseline in diesem Zyklus überschritten.", body: "Alles gut. bynku bestraft nichts. Der nächste 'heute sicher'-Wert startet einfach etwas niedriger, bis du wieder aufholst." },
        { label: "Hat die KI immer recht?", body: "Nein. Sie gibt fundierte Vorschläge auf Basis deiner Zahlen, entscheiden musst du. Bitte sie, unsichere Ratschläge zu erklären." },
      ],
      [
        { label: "Pourquoi des cycles et pas des mois calendaires ?", body: "Parce que beaucoup vivent de paie en paie. Un cycle colle mieux à la réalité — le « sûr aujourd'hui » devient honnête." },
        { label: "Mon salaire apparaît dans la liste des dépenses — pourquoi ?", body: "Entrées et sorties partagent la même chronologie pour voir la vue d'ensemble. Les lignes de salaire sont marquées « reçu » et alimentent l'enveloppe, elles ne sont pas dépensées." },
        { label: "Je me sens sur-alloué. Et maintenant ?", body: "Réduis ou mets un projet en pause — rien n'est prélevé automatiquement. bynku ne suit que les intentions tant que l'argent réel ne bouge pas." },
        { label: "J'ai dépassé le baseline sur ce cycle.", body: "Pas de souci. bynku ne punit pas. Le « sûr aujourd'hui » du cycle suivant démarre juste un peu plus bas, le temps de rattraper." },
        { label: "L'IA a-t-elle toujours raison ?", body: "Non. Elle propose des pistes fondées sur tes chiffres, mais c'est toi qui décides. Demande-lui d'expliquer tout conseil qui te fait douter." },
      ],
    ),
  },
];
