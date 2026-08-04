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
  /**
   * Who this section is for. Omitted = shown in every space. "personal" hides it
   * in company spaces and vice versa, so the manual matches the space you're in.
   */
  audience?: "personal" | "business";
  /** An extra note shown only when the current space is a company. */
  businessNote?: Loc<string>;
};

/** The sections that apply to a given space kind (undefined audience = both). */
export function wikiSectionsFor(kind: "personal" | "business"): WikiSection[] {
  return WIKI_SECTIONS.filter((s) => !s.audience || s.audience === kind);
}

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
      "Part guide, part short course on money — how bynku works and how to think about it. Read a section, or search what you need.",
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
      "Meio guia, meio curso curto sobre dinheiro — como o bynku funciona e como pensar nele. Lê uma secção ou pesquisa o que precisas.",
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
      "Mitad guía, mitad curso breve sobre el dinero — cómo funciona bynku y cómo pensarlo. Lee una sección o busca lo que necesites.",
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
      "Halb Leitfaden, halb kurzer Geldkurs — wie bynku funktioniert und wie man übers Geld denkt. Lies einen Abschnitt oder suche direkt.",
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
      "Mi-guide, mi-cours d'argent — comment bynku fonctionne et comment y penser. Lis une section ou cherche directement.",
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
  // ============================================================ BUSINESS TRACK
  // Shown only in company spaces (audience: "business"). Household spaces get the
  // personal sections below instead, so each wiki reads end-to-end for its kind.
  {
    id: "bizOverview",
    icon: "BookOpen",
    audience: "business",
    title: L(
      "bynku for your company",
      "O bynku para a tua empresa",
      "bynku para tu empresa",
      "bynku für dein Unternehmen",
      "bynku pour votre entreprise",
    ),
    paragraphs: L(
      [
        "bynku gives a small company one honest read of its money: what's coming in, what's going out, and how much runway that leaves. It works around your real operating cycle, not the calendar, and rebuilds the picture as revenue lands and costs clear — so decisions rest on numbers you can see.",
        "Think of it as the cockpit between your bank statements and your accountant: a management view, not your statutory books. And it's uninterested — nothing to sell you, no products — so its guidance points at the company's health, not a lender's. This guide is part manual, part short course in the finance every owner benefits from knowing.",
      ],
      [
        "O bynku dá a uma pequena empresa uma leitura honesta do seu dinheiro: o que entra, o que sai e quanta autonomia isso deixa. Funciona em torno do teu ciclo operacional real, não do calendário, e reconstrói o quadro à medida que a receita entra e os custos são pagos — para as decisões assentarem em números que vês.",
        "Pensa nele como a cabine entre os teus extratos bancários e o teu contabilista: uma visão de gestão, não a contabilidade oficial. E é desinteressado — nada para te vender, sem produtos — por isso aponta para a saúde da empresa, não a de um credor. Este guia é meio manual, meio curso curto sobre a finança que todo o dono beneficia em conhecer.",
      ],
      [
        "bynku da a una pequeña empresa una lectura honesta de su dinero: lo que entra, lo que sale y cuánta autonomía deja. Funciona en torno a tu ciclo operativo real, no al calendario, y rehace el cuadro a medida que entra la facturación y se pagan los costes — para que las decisiones se apoyen en números que ves.",
        "Piénsalo como la cabina entre tus extractos bancarios y tu contable: una visión de gestión, no la contabilidad oficial. Y es desinteresado — nada que venderte, sin productos — así que apunta a la salud de la empresa, no a la de un prestamista. Esta guía es mitad manual, mitad curso breve sobre las finanzas que todo dueño agradece conocer.",
      ],
      [
        "bynku gibt einem kleinen Unternehmen eine ehrliche Sicht auf sein Geld: was reinkommt, was rausgeht und wie viel Reichweite das lässt. Es arbeitet um deinen echten Betriebszyklus, nicht den Kalender, und baut das Bild neu auf, wenn Umsatz eingeht und Kosten beglichen werden — damit Entscheidungen auf sichtbaren Zahlen ruhen.",
        "Sieh es als Cockpit zwischen deinen Kontoauszügen und deiner Buchhalterin: eine Managementsicht, nicht der gesetzliche Abschluss. Und es ist uninteressiert — nichts zu verkaufen, keine Produkte — sein Rat zielt auf die Gesundheit des Unternehmens, nicht die eines Kreditgebers. Dieser Leitfaden ist halb Handbuch, halb kurzer Finanzkurs, den jede Inhaberin gut gebrauchen kann.",
      ],
      [
        "bynku donne à une petite entreprise une lecture honnête de son argent : ce qui entre, ce qui sort, et l'autonomie qu'il reste. Il s'articule autour de votre cycle d'exploitation réel, pas du calendrier, et reconstruit le tableau à mesure que le chiffre d'affaires arrive et que les coûts sont réglés — pour des décisions fondées sur des chiffres visibles.",
        "Voyez-le comme le cockpit entre vos relevés bancaires et votre comptable : une vue de gestion, pas les comptes officiels. Et il est désintéressé — rien à vous vendre, aucun produit — son conseil vise la santé de l'entreprise, pas celle d'un prêteur. Ce guide est mi-manuel, mi-cours de finance que tout dirigeant gagne à connaître.",
      ],
    ),
    bullets: L(
      [
        { label: "Cash first", body: "Revenue in, costs out, runway left — the numbers a founder actually steers by." },
        { label: "Management view", body: "Indicative figures to run the business; your accountant's stay the official ones." },
        { label: "On your side", body: "No products to sell means advice aimed at the company, not a bank." },
      ],
      [
        { label: "Primeiro a tesouraria", body: "Receita a entrar, custos a sair, autonomia restante — os números por que um fundador se guia." },
        { label: "Visão de gestão", body: "Valores indicativos para gerir; os do teu contabilista continuam a ser os oficiais." },
        { label: "Do teu lado", body: "Sem produtos para vender, o conselho é para a empresa, não para um banco." },
      ],
      [
        { label: "Primero la caja", body: "Ingresos que entran, costes que salen, autonomía restante — los números que guían a un fundador." },
        { label: "Visión de gestión", body: "Cifras indicativas para gestionar; las de tu contable siguen siendo las oficiales." },
        { label: "De tu lado", body: "Sin productos que vender, el consejo es para la empresa, no para un banco." },
      ],
      [
        { label: "Zuerst die Liquidität", body: "Umsatz rein, Kosten raus, Reichweite übrig — die Zahlen, nach denen ein Gründer steuert." },
        { label: "Managementsicht", body: "Indikative Zahlen zum Steuern; die deiner Buchhalterin bleiben die offiziellen." },
        { label: "Auf deiner Seite", body: "Keine Produkte zu verkaufen heißt Rat für das Unternehmen, nicht für eine Bank." },
      ],
      [
        { label: "La trésorerie d'abord", body: "Revenus entrants, coûts sortants, autonomie restante — les chiffres qui guident un fondateur." },
        { label: "Vue de gestion", body: "Des chiffres indicatifs pour piloter ; ceux de votre comptable restent officiels." },
        { label: "De votre côté", body: "Aucun produit à vendre : le conseil vise l'entreprise, pas une banque." },
      ],
    ),
    callout: L(
      "You don't need a finance degree to run a healthy company. You need a clear read and a habit of looking. That's what this is.",
      "Não precisas de um curso de finanças para gerir uma empresa saudável. Precisas de uma leitura clara e do hábito de olhar. É isso que isto é.",
      "No hace falta una carrera de finanzas para llevar una empresa sana. Hace falta una lectura clara y el hábito de mirar. Eso es esto.",
      "Du brauchst kein Finanzstudium für ein gesundes Unternehmen. Du brauchst eine klare Sicht und die Gewohnheit hinzuschauen. Genau das ist das hier.",
      "Pas besoin d'un diplôme de finance pour gérer une entreprise saine. Il faut une lecture claire et l'habitude de regarder. C'est ce que voici.",
    ),
  },
  {
    id: "bizCashflow",
    icon: "Wallet",
    audience: "business",
    title: L(
      "Cash in, cash out, and your cycle",
      "Entradas, saídas e o teu ciclo",
      "Entradas, salidas y tu ciclo",
      "Geldeingang, -ausgang und dein Zyklus",
      "Entrées, sorties et votre cycle",
    ),
    paragraphs: L(
      [
        "A company lives or dies on cash flow — money actually received versus money actually paid — more than on profit on paper. bynku separates the two sides: revenue and receivables coming in, fixed costs and payables going out, each on your chosen operating cycle (monthly, quarterly, or your own fiscal period).",
        "Recording both sides turns a vague 'are we ok?' into a number. Received income and paid costs build the ledger; the difference is your operating cash flow, the fuel for everything else. Invoices attach to entries so the trail stays audit-ready, and the accountant handoff is one click.",
      ],
      [
        "Uma empresa vive ou morre pela tesouraria — dinheiro realmente recebido face a dinheiro realmente pago — mais do que pelo lucro no papel. O bynku separa os dois lados: receita e valores a receber a entrar, custos fixos e valores a pagar a sair, cada um no teu ciclo operacional (mensal, trimestral ou o teu próprio período fiscal).",
        "Registar os dois lados transforma um vago 'estamos bem?' num número. Receitas recebidas e custos pagos constroem o livro-razão; a diferença é o teu fluxo de caixa operacional, o combustível para tudo o resto. As faturas anexam-se aos movimentos para o rasto ficar pronto para auditoria, e a entrega ao contabilista é um clique.",
      ],
      [
        "Una empresa vive o muere por el flujo de caja — dinero realmente recibido frente a dinero realmente pagado — más que por el beneficio sobre el papel. bynku separa los dos lados: ingresos y cobros que entran, costes fijos y pagos que salen, cada uno en tu ciclo operativo (mensual, trimestral o tu propio periodo fiscal).",
        "Registrar ambos lados convierte un vago '¿vamos bien?' en un número. Ingresos cobrados y costes pagados forman el libro; la diferencia es tu flujo de caja operativo, el combustible de todo lo demás. Las facturas se adjuntan a los movimientos para que el rastro quede listo para auditoría, y el traspaso al contable es un clic.",
      ],
      [
        "Ein Unternehmen lebt oder stirbt am Cashflow — tatsächlich eingegangenes gegen tatsächlich gezahltes Geld — mehr als am Papiergewinn. bynku trennt die zwei Seiten: Umsatz und Forderungen rein, Fixkosten und Verbindlichkeiten raus, je in deinem Betriebszyklus (monatlich, quartalsweise oder dein eigener Geschäftsraum).",
        "Beide Seiten zu erfassen macht aus einem vagen 'läuft's?' eine Zahl. Eingegangene Erlöse und gezahlte Kosten bilden das Journal; die Differenz ist dein operativer Cashflow, der Treibstoff für alles Weitere. Rechnungen hängen an den Einträgen, damit die Spur prüfbereit bleibt, und die Übergabe an die Buchhaltung ist ein Klick.",
      ],
      [
        "Une entreprise vit ou meurt par sa trésorerie — l'argent réellement encaissé contre l'argent réellement payé — plus que par le bénéfice sur le papier. bynku sépare les deux côtés : chiffre d'affaires et créances entrants, charges fixes et dettes sortantes, chacun sur votre cycle d'exploitation (mensuel, trimestriel ou votre propre exercice).",
        "Enregistrer les deux côtés transforme un vague « ça va ? » en chiffre. Recettes encaissées et coûts payés forment le journal ; la différence est votre flux de trésorerie d'exploitation, le carburant de tout le reste. Les factures s'attachent aux écritures pour garder une piste prête pour l'audit, et le transfert au comptable se fait en un clic.",
      ],
    ),
    bullets: L(
      [
        { label: "Cash, not just profit", body: "A profitable month can still run out of cash. bynku watches the flow." },
        { label: "Your fiscal cycle", body: "Monthly, quarterly or a custom period — the app follows how you actually report." },
        { label: "Receivables & payables", body: "Money owed to you and money you owe, tracked so nothing is a surprise." },
      ],
      [
        { label: "Tesouraria, não só lucro", body: "Um mês com lucro pode ficar sem dinheiro. O bynku vigia o fluxo." },
        { label: "O teu ciclo fiscal", body: "Mensal, trimestral ou período próprio — a app segue como reportas de facto." },
        { label: "A receber e a pagar", body: "O que te devem e o que deves, seguido para nada ser surpresa." },
      ],
      [
        { label: "Caja, no solo beneficio", body: "Un mes con beneficio puede quedarse sin caja. bynku vigila el flujo." },
        { label: "Tu ciclo fiscal", body: "Mensual, trimestral o periodo propio — la app sigue cómo reportas de verdad." },
        { label: "Cobros y pagos", body: "Lo que te deben y lo que debes, seguido para que nada sea sorpresa." },
      ],
      [
        { label: "Liquidität, nicht nur Gewinn", body: "Ein Gewinnmonat kann trotzdem ohne Cash dastehen. bynku beobachtet den Fluss." },
        { label: "Dein Geschäftszyklus", body: "Monatlich, quartalsweise oder eigener Zeitraum — die App folgt deiner echten Berichtsweise." },
        { label: "Forderungen & Verbindlichkeiten", body: "Was man dir schuldet und was du schuldest, verfolgt, damit nichts überrascht." },
      ],
      [
        { label: "La trésorerie, pas que le profit", body: "Un mois bénéficiaire peut manquer de cash. bynku surveille le flux." },
        { label: "Votre exercice", body: "Mensuel, trimestriel ou période propre — l'app suit votre façon de reporter." },
        { label: "Créances & dettes", body: "Ce qu'on vous doit et ce que vous devez, suivis pour éviter les surprises." },
      ],
    ),
    callout: L(
      "Profit is an opinion; cash is a fact. Run the business on the fact, and let profit be the scoreboard.",
      "O lucro é uma opinião; a tesouraria é um facto. Gere o negócio pelo facto e deixa o lucro ser o placar.",
      "El beneficio es una opinión; la caja es un hecho. Lleva el negocio por el hecho y deja que el beneficio sea el marcador.",
      "Gewinn ist eine Meinung; Cash ist eine Tatsache. Führe das Geschäft nach der Tatsache und lass den Gewinn der Punktestand sein.",
      "Le bénéfice est une opinion ; la trésorerie est un fait. Pilotez sur le fait, et laissez le bénéfice être le score.",
    ),
  },
  {
    id: "bizRunway",
    icon: "Calculator",
    audience: "business",
    title: L(
      "Running costs, free cash and reserves",
      "Custos correntes, caixa livre e reservas",
      "Costes corrientes, caja libre y reservas",
      "Laufende Kosten, freie Liquidität und Reserven",
      "Coûts de fonctionnement, trésorerie libre et réserves",
    ),
    paragraphs: L(
      [
        "Your running costs are what a normal operating period takes to keep the lights on — fixed costs, payroll, debt service and everyday spend. bynku sums them into a baseline, then shows what's genuinely free after them: the company's version of safe-to-commit, already net of what you must cover.",
        "Beyond that sits the reserve — a cash cushion measured in months of runway. It's the difference between a slow quarter being an inconvenience and an emergency. bynku holds reserves as projects, separate from operating cash, so the buffer you must not raid never gets confused with money earmarked to reinvest.",
      ],
      [
        "Os custos correntes são o que um período operacional normal exige para manter a porta aberta — custos fixos, salários, serviço da dívida e gasto do dia a dia. O bynku soma-os numa base e mostra o que fica mesmo livre: a versão-empresa do 'seguro a comprometer', já líquido do que tens de cobrir.",
        "Além disso está a reserva — uma almofada de caixa medida em meses de autonomia. É a diferença entre um trimestre fraco ser um incómodo ou uma emergência. O bynku guarda reservas como projetos, separadas da caixa operacional, para a almofada que não deves mexer não se confundir com o dinheiro destinado a reinvestir.",
      ],
      [
        "Tus costes corrientes son lo que un periodo operativo normal necesita para seguir abierto — costes fijos, nóminas, servicio de deuda y gasto del día a día. bynku los suma en una base y muestra lo que queda de verdad libre: la versión-empresa del 'seguro para comprometer', ya neto de lo que debes cubrir.",
        "Más allá está la reserva — un colchón de caja medido en meses de autonomía. Es la diferencia entre que un trimestre flojo sea una molestia o una emergencia. bynku guarda reservas como proyectos, aparte de la caja operativa, para que el colchón intocable no se confunda con el dinero destinado a reinvertir.",
      ],
      [
        "Deine laufenden Kosten sind, was ein normaler Betriebszeitraum braucht, um den Laden am Laufen zu halten — Fixkosten, Löhne, Schuldendienst und Alltagsausgaben. bynku summiert sie zu einer Basis und zeigt, was wirklich frei bleibt: die Unternehmensversion des 'sicher zu binden', schon nach Abzug des Nötigen.",
        "Darüber liegt die Reserve — ein Liquiditätspolster in Monaten Reichweite. Sie entscheidet, ob ein schwaches Quartal ein Ärgernis oder ein Notfall ist. bynku hält Reserven als Projekte, getrennt vom Betriebsgeld, damit der unantastbare Puffer nie mit dem zum Reinvestieren bestimmten Geld verwechselt wird.",
      ],
      [
        "Vos coûts de fonctionnement sont ce qu'un cycle d'exploitation normal exige pour garder les portes ouvertes — charges fixes, paie, service de la dette et dépenses courantes. bynku les additionne en une base, puis montre ce qui est vraiment libre : la version entreprise du « sûr à engager », déjà net de ce que vous devez couvrir.",
        "Au-delà se trouve la réserve — un matelas de trésorerie mesuré en mois d'autonomie. C'est la différence entre un trimestre creux qui gêne et un qui met en danger. bynku garde les réserves comme des projets, à part de la trésorerie d'exploitation, pour que le matelas intouchable ne se confonde pas avec l'argent destiné à réinvestir.",
      ],
    ),
    bullets: L(
      [
        { label: "Runway in months", body: "How long the reserve covers running costs if income paused — the survival number." },
        { label: "Free after costs", body: "What's left once fixed costs, payroll and debt are set aside — safe to commit." },
        { label: "Reserves apart", body: "A cash cushion kept separate from operating money, so it's there when it's needed." },
      ],
      [
        { label: "Autonomia em meses", body: "Quanto tempo a reserva cobre os custos correntes se a receita parasse — o número de sobrevivência." },
        { label: "Livre após custos", body: "O que fica depois de reservar custos fixos, salários e dívida — seguro a comprometer." },
        { label: "Reservas à parte", body: "Uma almofada separada da caixa operacional, para estar lá quando é precisa." },
      ],
      [
        { label: "Autonomía en meses", body: "Cuánto cubre la reserva los costes corrientes si parara el ingreso — el número de supervivencia." },
        { label: "Libre tras costes", body: "Lo que queda tras apartar costes fijos, nóminas y deuda — seguro para comprometer." },
        { label: "Reservas aparte", body: "Un colchón separado de la caja operativa, para que esté cuando haga falta." },
      ],
      [
        { label: "Reichweite in Monaten", body: "Wie lange die Reserve laufende Kosten deckt, wenn Einnahmen pausieren — die Überlebenszahl." },
        { label: "Frei nach Kosten", body: "Was bleibt, wenn Fixkosten, Löhne und Schulden zurückgelegt sind — sicher zu binden." },
        { label: "Reserven getrennt", body: "Ein Polster getrennt vom Betriebsgeld, damit es da ist, wenn es gebraucht wird." },
      ],
      [
        { label: "Autonomie en mois", body: "Combien de temps la réserve couvre les coûts si les revenus s'arrêtaient — le chiffre de survie." },
        { label: "Libre après coûts", body: "Ce qui reste une fois charges fixes, paie et dette réservées — sûr à engager." },
        { label: "Réserves à part", body: "Un matelas séparé de la trésorerie d'exploitation, présent le moment venu." },
      ],
    ),
    callout: L(
      "Runway buys time, and time is what lets a company fix a bad patch instead of folding in one.",
      "A autonomia compra tempo, e o tempo é o que deixa uma empresa corrigir um mau período em vez de fechar nele.",
      "La autonomía compra tiempo, y el tiempo es lo que deja a una empresa arreglar un mal tramo en vez de cerrar en él.",
      "Reichweite kauft Zeit, und Zeit lässt ein Unternehmen eine Durststrecke beheben, statt in ihr aufzugeben.",
      "L'autonomie achète du temps, et le temps permet à une entreprise de corriger un mauvais passage plutôt que d'y sombrer.",
    ),
  },
  {
    id: "bizFinancing",
    icon: "CreditCard",
    audience: "business",
    title: L(
      "Loans, credit lines and leverage",
      "Empréstimos, linhas de crédito e alavancagem",
      "Préstamos, líneas de crédito y apalancamiento",
      "Kredite, Kreditlinien und Verschuldung",
      "Prêts, lignes de crédit et effet de levier",
    ),
    paragraphs: L(
      [
        "Debt is a tool with a price. A term loan for equipment that earns its keep can be sensible; a revolving line left rolling at a high rate quietly drains margin. bynku works in total cost: enter any facility and it reconstructs the real amortization — interest versus principal, the payoff date, and the true annual rate even when only the instalment was quoted.",
        "Leverage cuts both ways: it amplifies returns when the business is growing and losses when it isn't. When there's spare cash, clearing expensive debt is a risk-free return at its rate — often better than reinvesting. The coach, with nothing to sell, will suggest overpaying, refinancing or renegotiating with the bank; the simulator shows what an extra payment saves.",
      ],
      [
        "A dívida é uma ferramenta com preço. Um empréstimo a prazo para equipamento que se paga a si próprio pode fazer sentido; uma linha rotativa a rolar a taxa alta drena a margem em silêncio. O bynku trabalha em custo total: insere qualquer facilidade e ele reconstrói a amortização real — juro face a capital, a data de fim, e a taxa anual real mesmo quando só a prestação foi indicada.",
        "A alavancagem corta para os dois lados: amplia os retornos quando o negócio cresce e as perdas quando não. Havendo caixa a mais, liquidar dívida cara é um retorno sem risco à sua taxa — muitas vezes melhor que reinvestir. O coach, sem nada para vender, sugere amortizar, refinanciar ou renegociar com o banco; o simulador mostra o que um pagamento extra poupa.",
      ],
      [
        "La deuda es una herramienta con precio. Un préstamo a plazo para equipo que se paga solo puede ser sensato; una línea revolving rodando a tipo alto drena el margen en silencio. bynku trabaja en coste total: introduce cualquier facilidad y reconstruye la amortización real — interés frente a principal, la fecha de fin, y el tipo anual real aunque solo se indicara la cuota.",
        "El apalancamiento corta por ambos lados: amplía los retornos cuando el negocio crece y las pérdidas cuando no. Cuando sobra caja, saldar deuda cara es un retorno sin riesgo a su tipo — a menudo mejor que reinvertir. El asistente, sin nada que vender, sugiere amortizar, refinanciar o renegociar con el banco; el simulador muestra lo que ahorra un pago extra.",
      ],
      [
        "Schuld ist ein Werkzeug mit Preis. Ein Terminkredit für Ausrüstung, die sich trägt, kann sinnvoll sein; eine revolvierende Linie zu hohem Zins zehrt leise an der Marge. bynku rechnet in Gesamtkosten: Gib eine Fazilität ein, und es rekonstruiert die echte Tilgung — Zins gegen Kapital, das Enddatum und den echten Jahreszins, selbst wenn nur die Rate genannt war.",
        "Verschuldung schneidet beidseitig: Sie verstärkt Erträge im Wachstum und Verluste sonst. Bei überschüssigem Cash ist teure Schuld zu tilgen eine risikofreie Rendite zu ihrem Zins — oft besser als reinvestieren. Der Coach, ohne etwas zu verkaufen, schlägt Sondertilgung, Umschuldung oder Neuverhandlung mit der Bank vor; der Simulator zeigt, was eine Extrazahlung spart.",
      ],
      [
        "La dette est un outil avec un prix. Un prêt à terme pour un équipement qui se rentabilise peut être sensé ; une ligne renouvelable à taux élevé ronge la marge en silence. bynku raisonne en coût total : saisissez une facilité et il reconstruit l'amortissement réel — intérêts contre capital, la date de fin, et le taux annuel réel même quand seule l'échéance était indiquée.",
        "L'effet de levier coupe des deux côtés : il amplifie les rendements en croissance et les pertes sinon. Quand il reste du cash, solder la dette chère est un rendement sans risque à son taux — souvent mieux que réinvestir. L'assistant, sans rien à vendre, suggère de rembourser, refinancer ou renégocier avec la banque ; le simulateur montre ce qu'un paiement en plus économise.",
      ],
    ),
    bullets: L(
      [
        { label: "Total cost, not the instalment", body: "APR and full cost surfaced for every loan, overdraft or lease." },
        { label: "Leverage is a magnifier", body: "It amplifies good years and bad. Size it to cash flow you can rely on." },
        { label: "Clear dear debt first", body: "Paying off high-rate debt is a guaranteed return; the coach will say so." },
      ],
      [
        { label: "Custo total, não a prestação", body: "Taxa e custo total à vista para cada empréstimo, descoberto ou leasing." },
        { label: "A alavancagem amplifica", body: "Amplia os bons anos e os maus. Dimensiona-a à tesouraria em que podes confiar." },
        { label: "Primeiro a dívida cara", body: "Pagar dívida a taxa alta é um retorno garantido; o coach di-lo-á." },
      ],
      [
        { label: "Coste total, no la cuota", body: "Tipo y coste total a la vista para cada préstamo, descubierto o leasing." },
        { label: "El apalancamiento amplifica", body: "Amplía los buenos años y los malos. Dimensiónalo a la caja en que puedas confiar." },
        { label: "Primero la deuda cara", body: "Saldar deuda de tipo alto es un retorno garantizado; el asistente lo dirá." },
      ],
      [
        { label: "Gesamtkosten, nicht die Rate", body: "Zins und Gesamtkosten sichtbar für jeden Kredit, Dispo oder Leasing." },
        { label: "Hebel ist ein Verstärker", body: "Er verstärkt gute wie schlechte Jahre. Bemiss ihn am verlässlichen Cashflow." },
        { label: "Teure Schuld zuerst", body: "Hochverzinste Schuld zu tilgen ist eine garantierte Rendite; der Coach sagt es." },
      ],
      [
        { label: "Coût total, pas l'échéance", body: "Taux et coût total affichés pour chaque prêt, découvert ou leasing." },
        { label: "Le levier amplifie", body: "Il amplifie les bonnes et mauvaises années. Dimensionnez-le à une trésorerie fiable." },
        { label: "La dette chère d'abord", body: "Solder une dette à taux élevé est un rendement garanti ; l'assistant le dira." },
      ],
    ),
    callout: L(
      "The cheapest financing is the one you understand before you sign — and bynku is always on your side against its cost.",
      "O financiamento mais barato é o que percebes antes de assinar — e o bynku está sempre do teu lado contra o seu custo.",
      "La financiación más barata es la que entiendes antes de firmar — y bynku está siempre de tu lado frente a su coste.",
      "Die günstigste Finanzierung ist die, die du vor der Unterschrift verstehst — und bynku steht immer auf deiner Seite gegen ihre Kosten.",
      "Le financement le moins cher est celui que vous comprenez avant de signer — et bynku est toujours de votre côté contre son coût.",
    ),
  },
  {
    id: "bizAssets",
    icon: "PiggyBank",
    audience: "business",
    title: L(
      "Assets, depreciation and equity",
      "Ativos, depreciação e capital próprio",
      "Activos, amortización y patrimonio",
      "Vermögen, Abschreibung und Eigenkapital",
      "Actifs, amortissement et capitaux propres",
    ),
    paragraphs: L(
      [
        "A company's assets — equipment, vehicles, premises, cash and investments — are one half of its worth; what it owes is the other. bynku tracks both and shows the difference as equity, the honest net position. For business assets it also models depreciation: the written-down value as gear ages, so net worth reflects book value, not the purchase price.",
        "Depreciation is a real, non-cash cost: it lowers reported profit without touching this period's cash. Seeing it keeps profitability honest and reminds you to plan for eventual replacement. bynku's Finance Statements pull all of this into an indicative balance sheet you can sanity-check against your accountant's.",
      ],
      [
        "Os ativos de uma empresa — equipamento, viaturas, instalações, caixa e investimentos — são metade do seu valor; o que deve é a outra. O bynku acompanha ambos e mostra a diferença como capital próprio, a posição líquida honesta. Para ativos de empresa modela também a depreciação: o valor abatido à medida que o equipamento envelhece, para o património refletir o valor contabilístico, não o preço de compra.",
        "A depreciação é um custo real, não monetário: reduz o lucro reportado sem tocar na caixa deste período. Vê-la mantém a rentabilidade honesta e lembra-te de planear a substituição. As Demonstrações financeiras do bynku reúnem tudo isto num balanço indicativo que podes confrontar com o do teu contabilista.",
      ],
      [
        "Los activos de una empresa — equipo, vehículos, locales, caja e inversiones — son la mitad de su valor; lo que debe es la otra. bynku sigue ambos y muestra la diferencia como patrimonio, la posición neta honesta. Para activos de empresa también modela la amortización: el valor rebajado según envejece el equipo, para que el patrimonio refleje el valor contable, no el precio de compra.",
        "La amortización es un coste real, no de caja: baja el beneficio reportado sin tocar la caja de este periodo. Verla mantiene honesta la rentabilidad y recuerda planificar la reposición. Los Estados financieros de bynku reúnen todo esto en un balance indicativo que puedes contrastar con el de tu contable.",
      ],
      [
        "Das Vermögen eines Unternehmens — Ausrüstung, Fahrzeuge, Räume, Cash und Anlagen — ist die eine Hälfte seines Werts; die Schulden die andere. bynku verfolgt beide und zeigt die Differenz als Eigenkapital, die ehrliche Nettoposition. Für Geschäftsvermögen bildet es auch Abschreibung ab: den abgeschriebenen Wert im Alter, damit das Nettovermögen den Buchwert zeigt, nicht den Kaufpreis.",
        "Abschreibung ist ein echter, nicht zahlungswirksamer Aufwand: Sie senkt den ausgewiesenen Gewinn, ohne die Liquidität dieser Periode zu berühren. Sie zu sehen hält die Rentabilität ehrlich und erinnert an die Ersatzplanung. bynkus Finanzberichte fügen all das zu einer indikativen Bilanz zusammen, die du gegen die deiner Buchhalterin prüfen kannst.",
      ],
      [
        "Les actifs d'une entreprise — équipements, véhicules, locaux, trésorerie et placements — sont une moitié de sa valeur ; ce qu'elle doit est l'autre. bynku suit les deux et montre la différence en capitaux propres, la position nette honnête. Pour les actifs professionnels, il modélise aussi l'amortissement : la valeur nette comptable au fil du vieillissement, pour que le patrimoine reflète la valeur comptable, pas le prix d'achat.",
        "L'amortissement est un coût réel, non décaissé : il baisse le bénéfice affiché sans toucher la trésorerie de la période. Le voir garde la rentabilité honnête et rappelle de prévoir le remplacement. Les États financiers de bynku réunissent tout cela en un bilan indicatif à confronter à celui de votre comptable.",
      ],
    ),
    bullets: L(
      [
        { label: "Equity = assets − liabilities", body: "The company's true net position, updated as debts amortize and values change." },
        { label: "Depreciation, done right", body: "Straight-line write-down so book value and net worth stay realistic." },
        { label: "Non-cash but real", body: "Depreciation trims profit, not cash — plan replacements before they bite." },
      ],
      [
        { label: "Capital = ativo − passivo", body: "A verdadeira posição líquida da empresa, atualizada à medida que a dívida amortiza." },
        { label: "Depreciação bem feita", body: "Abatimento linear para o valor contabilístico e o património ficarem realistas." },
        { label: "Não é caixa, mas é real", body: "A depreciação corta o lucro, não a caixa — planeia substituições antes que doam." },
      ],
      [
        { label: "Patrimonio = activo − pasivo", body: "La verdadera posición neta de la empresa, actualizada según amortiza la deuda." },
        { label: "Amortización bien hecha", body: "Rebaja lineal para que el valor contable y el patrimonio sigan siendo realistas." },
        { label: "No es caja, pero es real", body: "La amortización recorta el beneficio, no la caja — planifica reposiciones a tiempo." },
      ],
      [
        { label: "Eigenkapital = Aktiva − Passiva", body: "Die echte Nettoposition, aktualisiert, während Schulden tilgen und Werte sich ändern." },
        { label: "Abschreibung, richtig", body: "Lineare Abschreibung, damit Buchwert und Nettovermögen realistisch bleiben." },
        { label: "Nicht Cash, aber real", body: "Abschreibung mindert Gewinn, nicht Cash — plane Ersatz, bevor er beißt." },
      ],
      [
        { label: "Capitaux = actif − passif", body: "La vraie position nette, mise à jour à mesure que la dette s'amortit." },
        { label: "Amortissement bien fait", body: "Décote linéaire pour garder valeur comptable et patrimoine réalistes." },
        { label: "Non décaissé mais réel", body: "L'amortissement rogne le bénéfice, pas la trésorerie — anticipez les remplacements." },
      ],
    ),
    callout: L(
      "Net worth is the scoreboard that can't be faked. Cash flow is what moves it up.",
      "O património líquido é o placar que não se falsifica. A tesouraria é o que o faz subir.",
      "El patrimonio neto es el marcador que no se falsea. El flujo de caja es lo que lo sube.",
      "Das Nettovermögen ist der Punktestand, der sich nicht fälschen lässt. Der Cashflow bewegt ihn nach oben.",
      "La valeur nette est le score qu'on ne peut truquer. La trésorerie est ce qui la fait monter.",
    ),
  },
  {
    id: "bizPlanning",
    icon: "CalendarClock",
    audience: "business",
    title: L(
      "Payables, receivables and looking ahead",
      "A pagar, a receber e olhar em frente",
      "Pagos, cobros y mirar adelante",
      "Verbindlichkeiten, Forderungen und Vorausschau",
      "Dettes, créances et anticipation",
    ),
    paragraphs: L(
      [
        "The costs and receipts you already know are coming are half the battle won. bynku lets you line up dated payables and receivables — a tax bill, a big invoice, a renewal — and forecasts the cash position month by month, flagging any point where cash runs short before it happens.",
        "Fast Forward takes it further: model a hire, new equipment, a new site or a jump in revenue and watch cash and runway respond. The Finance Statements give an indicative P&L, balance sheet and cash flow; Analysis and the sector comparison show productivity and margin against your industry. Together they turn 'I think we're fine' into evidence.",
      ],
      [
        "Os custos e recebimentos que já sabes que vêm são meia batalha ganha. O bynku deixa-te alinhar valores a pagar e a receber datados — um imposto, uma fatura grande, uma renovação — e prevê a posição de caixa mês a mês, assinalando qualquer ponto em que a caixa fica curta antes de acontecer.",
        "O Avançar rápido vai mais longe: modela uma contratação, equipamento novo, uma nova unidade ou um salto na receita e vê a caixa e a autonomia responderem. As Demonstrações financeiras dão um P&L, balanço e fluxos indicativos; a Análise e a comparação setorial mostram produtividade e margem face à tua indústria. Juntos, transformam o 'acho que estamos bem' em evidência.",
      ],
      [
        "Los costes y cobros que ya sabes que vienen son media batalla ganada. bynku te deja alinear pagos y cobros con fecha — un impuesto, una factura grande, una renovación — y prevé la posición de caja mes a mes, señalando cualquier punto donde la caja se quede corta antes de que pase.",
        "El Avance rápido va más allá: modela una contratación, equipo nuevo, una nueva sede o un salto de ingresos y observa cómo responden la caja y la autonomía. Los Estados financieros dan un P&L, balance y flujo indicativos; el Análisis y la comparación sectorial muestran productividad y margen frente a tu industria. Juntos, convierten el 'creo que vamos bien' en evidencia.",
      ],
      [
        "Die Kosten und Eingänge, von denen du schon weißt, sind die halbe Miete. bynku lässt dich datierte Verbindlichkeiten und Forderungen aufreihen — eine Steuer, eine große Rechnung, eine Verlängerung — und prognostiziert die Liquidität Monat für Monat, mit Warnung an jedem Punkt, wo das Geld knapp wird, bevor es passiert.",
        "Vorspulen geht weiter: Modelliere eine Einstellung, neue Ausrüstung, einen neuen Standort oder einen Umsatzsprung und sieh, wie Cash und Reichweite reagieren. Die Finanzberichte liefern eine indikative GuV, Bilanz und Kapitalflussrechnung; Analyse und Branchenvergleich zeigen Produktivität und Marge gegenüber deiner Branche. Zusammen machen sie aus 'ich glaube, es läuft' Belege.",
      ],
      [
        "Les coûts et recettes que vous savez déjà venir sont la moitié de la bataille gagnée. bynku vous laisse aligner dettes et créances datées — un impôt, une grosse facture, un renouvellement — et prévoit la trésorerie mois par mois, en signalant tout point où le cash manque avant qu'il n'arrive.",
        "L'Avance rapide va plus loin : modélisez une embauche, du nouvel équipement, un nouveau site ou un bond de revenus et voyez la trésorerie et l'autonomie réagir. Les États financiers donnent un compte de résultat, un bilan et un flux indicatifs ; l'Analyse et la comparaison sectorielle montrent productivité et marge face à votre secteur. Ensemble, ils changent « je crois qu'on va bien » en preuves.",
      ],
    ),
    bullets: L(
      [
        { label: "See the shortfall early", body: "The forecast flags a cash gap before the month it lands, so you can act." },
        { label: "Model the what-if", body: "Test a hire, a purchase or a new contract and see the effect on cash and runway." },
        { label: "Statements & benchmarks", body: "Indicative P&L, balance sheet, cash flow, and how you compare to your sector." },
      ],
      [
        { label: "Vê a falha cedo", body: "A previsão assinala uma falta de caixa antes do mês em que cai, para poderes agir." },
        { label: "Modela o e-se", body: "Testa uma contratação, uma compra ou um novo contrato e vê o efeito na caixa e autonomia." },
        { label: "Demonstrações e referências", body: "P&L, balanço e fluxos indicativos, e como te comparas com o teu setor." },
      ],
      [
        { label: "Ve el faltante pronto", body: "La previsión señala un hueco de caja antes del mes en que llega, para que actúes." },
        { label: "Modela el qué-pasaría-si", body: "Prueba una contratación, una compra o un nuevo contrato y ve el efecto en caja y autonomía." },
        { label: "Estados y referencias", body: "P&L, balance y flujo indicativos, y cómo te comparas con tu sector." },
      ],
      [
        { label: "Die Lücke früh sehen", body: "Die Prognose meldet eine Liquiditätslücke vor dem Monat, in dem sie eintritt — du kannst handeln." },
        { label: "Das Was-wäre-wenn modellieren", body: "Teste eine Einstellung, einen Kauf oder einen neuen Vertrag und sieh die Wirkung auf Cash und Reichweite." },
        { label: "Berichte & Benchmarks", body: "Indikative GuV, Bilanz, Cashflow, und wie du gegenüber deiner Branche stehst." },
      ],
      [
        { label: "Voir le manque tôt", body: "La prévision signale un trou de trésorerie avant le mois où il tombe, pour agir." },
        { label: "Modéliser le et-si", body: "Testez une embauche, un achat ou un contrat et voyez l'effet sur cash et autonomie." },
        { label: "États & repères", body: "Compte de résultat, bilan, flux indicatifs, et comment vous vous situez face au secteur." },
      ],
    ),
    callout: L(
      "Every cash crunch is easier to solve six weeks early than the morning it arrives. Looking ahead is the whole point.",
      "Todo o aperto de caixa é mais fácil de resolver seis semanas antes do que na manhã em que chega. Olhar em frente é a razão de tudo.",
      "Todo apretón de caja es más fácil de resolver seis semanas antes que la mañana en que llega. Mirar adelante es la clave.",
      "Jede Liquiditätsklemme lässt sich sechs Wochen früher leichter lösen als am Morgen ihres Eintreffens. Vorausschau ist der ganze Sinn.",
      "Toute tension de trésorerie se règle plus facilement six semaines avant que le matin où elle survient. Anticiper, c'est tout l'intérêt.",
    ),
  },
  {
    id: "bizCapital",
    icon: "BarChart3",
    audience: "business",
    title: L(
      "Putting spare cash to work: the order",
      "Pôr a caixa a mais a render: a ordem",
      "Poner la caja sobrante a trabajar: el orden",
      "Überschüssiges Geld einsetzen: die Reihenfolge",
      "Faire travailler le cash excédentaire : l'ordre",
    ),
    paragraphs: L(
      [
        "When a company generates more cash than it needs, the order of what to do with it usually beats improvising. First a reserve — enough runway to weather a slow patch. Then clear expensive debt, since that's a guaranteed return at its rate. Then reinvest where the return beats your cost of capital — and only then distribute or park the rest.",
        "The logic is the same time value and compounding you'll see in the concept chapters, applied to a balance sheet. bynku shows where the company stands on each rung and keeps reserves, debt and reinvestment visible, so allocation is a deliberate choice rather than whatever's left at period end.",
      ],
      [
        "Quando uma empresa gera mais caixa do que precisa, a ordem do que fazer com ela costuma vencer a improvisação. Primeiro uma reserva — autonomia suficiente para aguentar um período fraco. Depois liquidar dívida cara, pois é um retorno garantido à sua taxa. Depois reinvestir onde o retorno supera o teu custo de capital — e só então distribuir ou guardar o resto.",
        "A lógica é o mesmo valor no tempo e juro composto que vês nos capítulos de conceitos, aplicado a um balanço. O bynku mostra em que degrau a empresa está e mantém reservas, dívida e reinvestimento visíveis, para a alocação ser uma escolha deliberada e não o que sobra no fim do período.",
      ],
      [
        "Cuando una empresa genera más caja de la que necesita, el orden de qué hacer con ella suele ganar a improvisar. Primero una reserva — autonomía suficiente para aguantar un tramo flojo. Luego saldar deuda cara, pues es un retorno garantizado a su tipo. Luego reinvertir donde el retorno supere tu coste de capital — y solo entonces distribuir o guardar el resto.",
        "La lógica es el mismo valor temporal e interés compuesto que verás en los capítulos de conceptos, aplicado a un balance. bynku muestra en qué peldaño está la empresa y mantiene reservas, deuda y reinversión a la vista, para que la asignación sea una elección deliberada y no lo que sobra a fin de periodo.",
      ],
      [
        "Erzeugt ein Unternehmen mehr Cash als nötig, schlägt die Reihenfolge meist das Improvisieren. Zuerst eine Reserve — genug Reichweite für eine Durststrecke. Dann teure Schuld tilgen, denn das ist eine garantierte Rendite zu ihrem Zins. Dann reinvestieren, wo die Rendite die Kapitalkosten schlägt — und erst dann den Rest ausschütten oder parken.",
        "Die Logik ist derselbe Zeitwert und Zinseszins wie in den Konzeptkapiteln, auf eine Bilanz angewandt. bynku zeigt, auf welcher Stufe das Unternehmen steht, und hält Reserven, Schuld und Reinvestition sichtbar, damit Allokation eine bewusste Wahl ist statt dessen, was am Periodenende übrig bleibt.",
      ],
      [
        "Quand une entreprise génère plus de cash qu'il n'en faut, l'ordre de ce qu'on en fait bat souvent l'improvisation. D'abord une réserve — assez d'autonomie pour traverser un creux. Puis solder la dette chère, car c'est un rendement garanti à son taux. Puis réinvestir là où le rendement dépasse votre coût du capital — et seulement ensuite distribuer ou garder le reste.",
        "La logique est la même valeur temporelle et capitalisation que dans les chapitres de concepts, appliquée à un bilan. bynku montre où l'entreprise se situe sur chaque échelon et garde réserves, dette et réinvestissement visibles, pour que l'allocation soit un choix délibéré et non ce qui reste en fin de période.",
      ],
    ),
    bullets: L(
      [
        { label: "Reserve first", body: "Runway before growth — a shock shouldn't force emergency borrowing." },
        { label: "Then kill dear debt", body: "Clearing high-rate debt is a risk-free return; usually it comes before reinvesting." },
        { label: "Reinvest above your hurdle", body: "Put cash where the return beats your cost of capital; distribute the rest." },
      ],
      [
        { label: "Primeiro a reserva", body: "Autonomia antes do crescimento — um choque não deve forçar crédito de emergência." },
        { label: "Depois a dívida cara", body: "Liquidar dívida a taxa alta é um retorno sem risco; costuma vir antes de reinvestir." },
        { label: "Reinveste acima do teu limiar", body: "Põe a caixa onde o retorno supera o custo de capital; distribui o resto." },
      ],
      [
        { label: "Primero la reserva", body: "Autonomía antes que crecimiento — un golpe no debe forzar crédito de emergencia." },
        { label: "Luego la deuda cara", body: "Saldar deuda de tipo alto es un retorno sin riesgo; suele ir antes de reinvertir." },
        { label: "Reinvierte sobre tu umbral", body: "Pon la caja donde el retorno supere tu coste de capital; distribuye el resto." },
      ],
      [
        { label: "Zuerst die Reserve", body: "Reichweite vor Wachstum — ein Schock soll keine Notkredite erzwingen." },
        { label: "Dann teure Schuld", body: "Hochverzinste Schuld zu tilgen ist eine risikofreie Rendite; meist vor dem Reinvestieren." },
        { label: "Über deiner Hürde reinvestieren", body: "Setz Cash ein, wo die Rendite die Kapitalkosten schlägt; den Rest ausschütten." },
      ],
      [
        { label: "La réserve d'abord", body: "L'autonomie avant la croissance — un choc ne doit pas forcer un emprunt d'urgence." },
        { label: "Puis la dette chère", body: "Solder une dette à taux élevé est un rendement sans risque ; en général avant de réinvestir." },
        { label: "Réinvestir au-dessus du seuil", body: "Placez le cash où le rendement dépasse votre coût du capital ; distribuez le reste." },
      ],
    ),
    callout: L(
      "Capital allocation is the quiet skill that compounds a company. Spare cash is a decision, not a leftover.",
      "A alocação de capital é a competência silenciosa que compõe uma empresa. A caixa a mais é uma decisão, não uma sobra.",
      "La asignación de capital es la habilidad silenciosa que compone una empresa. La caja sobrante es una decisión, no un sobrante.",
      "Kapitalallokation ist die leise Fähigkeit, die ein Unternehmen verzinst. Überschüssiges Geld ist eine Entscheidung, kein Rest.",
      "L'allocation du capital est le savoir-faire discret qui capitalise une entreprise. Le cash excédentaire est une décision, pas un reste.",
    ),
  },

  // ------------------------------------------------------------ overview
  {
    id: "overview",
    icon: "BookOpen",
    audience: "personal",
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
    businessNote: L(
      "You're in a company space, so this manual uses business language: money in is revenue and receivables, money out is fixed costs and payables, and the same engine projects cash flow and runway instead of household net worth. The Handoff page hands a space to an accountant.",
      "Estás num espaço de empresa, por isso este manual usa linguagem de negócio: as entradas são receita e valores a receber, as saídas são custos fixos e valores a pagar, e o mesmo motor projeta fluxo de caixa e autonomia em vez do património familiar. A página de Transferência entrega o espaço a um contabilista.",
      "Estás en un espacio de empresa, así que este manual usa lenguaje de negocio: los ingresos son facturación y cobros pendientes, los gastos son costes fijos y pagos pendientes, y el mismo motor proyecta el flujo de caja y la autonomía en vez del patrimonio familiar. La página de Traspaso entrega el espacio a un contable.",
      "Du bist in einem Firmenraum, daher nutzt dieses Handbuch Geschäftssprache: Einnahmen sind Umsatz und Forderungen, Ausgaben sind Fixkosten und Verbindlichkeiten, und dieselbe Engine projiziert Cashflow und Runway statt Haushalts-Nettovermögen. Die Übergabeseite übergibt einen Raum an eine Buchhalterin.",
      "Vous êtes dans un espace entreprise : ce manuel emploie donc un vocabulaire pro : les entrées sont le chiffre d'affaires et les créances, les sorties les charges fixes et les dettes fournisseurs, et le même moteur projette la trésorerie et l'autonomie plutôt que le patrimoine du foyer. La page de Transfert confie un espace à un comptable.",
    ),
  },

  // ------------------------------------------------------------ mindset
  {
    id: "mindset",
    icon: "Sparkles",
    audience: "personal",
    title: L(
      "Money is a tool, not a scoreboard",
      "O dinheiro é uma ferramenta, não um placar",
      "El dinero es una herramienta, no un marcador",
      "Geld ist ein Werkzeug, kein Punktestand",
      "L'argent est un outil, pas un score",
    ),
    paragraphs: L(
      [
        "Most money stress isn't about the amount — it's about not knowing where you stand. bynku starts there: it turns a fuzzy feeling into one clear number you can trust today, and rebuilds it every payday. Clarity first, optimisation later.",
        "Two ideas run through everything here. Think in flows, not just balances: what comes in, what goes out, and what that leaves — a balance is a photo, a flow is the film. And money is for a life, not a high score: the aim isn't the biggest number, it's enough freedom to sleep well and say yes to what matters.",
        "bynku is on your side and no one else's. It has nothing to sell you — no loans, no cards — so its advice can point wherever your interest lies, even when that means paying a bank less. Read the rest of this guide as a short course, not a manual: each part explains a money idea, then shows how bynku puts it to work on your real numbers.",
      ],
      [
        "A maior parte do stress com dinheiro não é o valor — é não saber onde estás. O bynku começa aí: transforma uma sensação difusa num número claro em que podes confiar hoje, e reconstrói-o a cada dia de pagamento. Primeiro clareza, depois otimização.",
        "Duas ideias atravessam tudo aqui. Pensa em fluxos, não só em saldos: o que entra, o que sai e o que sobra — um saldo é uma foto, um fluxo é o filme. E o dinheiro é para uma vida, não para um recorde: o objetivo não é o maior número, é liberdade suficiente para dormir descansado e dizer sim ao que importa.",
        "O bynku está do teu lado e de mais ninguém. Não tem nada para te vender — nem créditos, nem cartões — por isso o conselho pode apontar para onde estiver o teu interesse, mesmo que isso signifique pagar menos ao banco. Lê o resto deste guia como um curso curto, não um manual: cada parte explica uma ideia sobre dinheiro e mostra como o bynku a aplica aos teus números reais.",
      ],
      [
        "Casi todo el estrés con el dinero no es por la cantidad, sino por no saber dónde estás. bynku empieza ahí: convierte una sensación difusa en un número claro en el que puedes confiar hoy, y lo rehace cada día de cobro. Primero claridad, luego optimización.",
        "Dos ideas recorren todo esto. Piensa en flujos, no solo en saldos: lo que entra, lo que sale y lo que queda — un saldo es una foto, un flujo es la película. Y el dinero es para una vida, no para un récord: la meta no es el número más grande, sino libertad suficiente para dormir tranquilo y decir sí a lo que importa.",
        "bynku está de tu lado y de nadie más. No tiene nada que venderte — ni préstamos, ni tarjetas — así que su consejo puede apuntar a donde esté tu interés, aunque implique pagar menos al banco. Lee el resto de esta guía como un curso breve, no un manual: cada parte explica una idea sobre el dinero y muestra cómo bynku la aplica a tus números reales.",
      ],
      [
        "Der meiste Geldstress dreht sich nicht um die Summe, sondern darum, nicht zu wissen, wo man steht. Genau da setzt bynku an: Es macht aus einem vagen Gefühl eine klare Zahl, der du heute vertrauen kannst, und baut sie an jedem Zahltag neu auf. Erst Klarheit, dann Optimierung.",
        "Zwei Gedanken ziehen sich durch alles hier. Denke in Flüssen, nicht nur in Ständen: was reinkommt, was rausgeht und was übrig bleibt — ein Kontostand ist ein Foto, ein Fluss ist der Film. Und Geld ist für ein Leben da, nicht für einen Highscore: Ziel ist nicht die größte Zahl, sondern genug Freiheit, ruhig zu schlafen und Ja zum Wichtigen zu sagen.",
        "bynku steht auf deiner Seite und auf keiner anderen. Es hat dir nichts zu verkaufen — keine Kredite, keine Karten — deshalb kann sein Rat dorthin zeigen, wo dein Interesse liegt, auch wenn das heißt, der Bank weniger zu zahlen. Lies den Rest als kurzen Kurs, nicht als Handbuch: Jeder Teil erklärt eine Geldidee und zeigt, wie bynku sie auf deine echten Zahlen anwendet.",
      ],
      [
        "Le stress financier vient rarement du montant — mais du fait de ne pas savoir où l'on en est. bynku part de là : il transforme une impression floue en un chiffre clair, fiable dès aujourd'hui, et le reconstruit à chaque paie. La clarté d'abord, l'optimisation ensuite.",
        "Deux idées traversent tout ceci. Pensez en flux, pas seulement en soldes : ce qui entre, ce qui sort, ce qu'il reste — un solde est une photo, un flux est le film. Et l'argent est fait pour une vie, pas pour un score : le but n'est pas le plus gros chiffre, mais assez de liberté pour dormir tranquille et dire oui à l'essentiel.",
        "bynku est de votre côté et d'aucun autre. Il n'a rien à vous vendre — ni prêts, ni cartes — son conseil peut donc pointer là où est votre intérêt, même s'il faut payer moins à une banque. Lisez la suite comme un petit cours, pas un manuel : chaque partie explique une idée d'argent, puis montre comment bynku l'applique à vos vrais chiffres.",
      ],
    ),
    bullets: L(
      [
        { label: "Flows over balances", body: "A big balance can hide a leak; a healthy flow builds wealth quietly. bynku watches the flow." },
        { label: "Enough, defined", body: "Name what 'enough' means for you — a buffer, a goal — and bynku tracks the distance to it." },
        { label: "Understand, then trust", body: "You're never asked to trust a number you can't see the working for. Every figure is explained." },
        { label: "On your side", body: "No product to sell means advice that can favour you over any bank or lender." },
      ],
      [
        { label: "Fluxos acima de saldos", body: "Um saldo grande pode esconder uma fuga; um fluxo saudável cria riqueza em silêncio. O bynku vê o fluxo." },
        { label: "Definir o 'suficiente'", body: "Dá nome ao que é 'suficiente' para ti — uma almofada, um objetivo — e o bynku mede a distância até lá." },
        { label: "Perceber e depois confiar", body: "Nunca te pedimos para confiar num número sem veres as contas. Tudo é explicado." },
        { label: "Do teu lado", body: "Não ter produtos para vender significa conselhos que te podem favorecer face a qualquer banco." },
      ],
      [
        { label: "Flujos sobre saldos", body: "Un saldo grande puede ocultar una fuga; un flujo sano crea riqueza en silencio. bynku mira el flujo." },
        { label: "Definir lo 'suficiente'", body: "Pon nombre a lo que es 'suficiente' para ti — un colchón, una meta — y bynku mide la distancia." },
        { label: "Entender y luego confiar", body: "Nunca se te pide confiar en un número sin ver el cálculo. Todo se explica." },
        { label: "De tu lado", body: "No tener producto que vender permite un consejo que puede favorecerte frente a cualquier banco." },
      ],
      [
        { label: "Flüsse vor Ständen", body: "Ein hoher Stand kann ein Leck verbergen; ein gesunder Fluss baut leise Vermögen auf. bynku sieht den Fluss." },
        { label: "'Genug' definieren", body: "Benenne, was 'genug' für dich heißt — ein Puffer, ein Ziel — und bynku misst die Distanz dorthin." },
        { label: "Verstehen, dann vertrauen", body: "Du sollst keiner Zahl vertrauen, deren Rechenweg du nicht siehst. Alles wird erklärt." },
        { label: "Auf deiner Seite", body: "Kein Produkt zu verkaufen heißt Rat, der dich gegenüber jeder Bank bevorzugen darf." },
      ],
      [
        { label: "Les flux avant les soldes", body: "Un gros solde peut masquer une fuite ; un flux sain bâtit la richesse en silence. bynku regarde le flux." },
        { label: "Définir « assez »", body: "Nommez ce qu'« assez » veut dire pour vous — un coussin, un objectif — et bynku mesure la distance." },
        { label: "Comprendre puis faire confiance", body: "On ne vous demande jamais de croire un chiffre sans en voir le calcul. Tout est expliqué." },
        { label: "De votre côté", body: "Rien à vendre, donc un conseil qui peut vous favoriser face à n'importe quelle banque." },
      ],
    ),
    callout: L(
      "You don't need to be good with numbers. You need a plan you understand and a habit you can keep. bynku is built for exactly that.",
      "Não precisas de ser bom com números. Precisas de um plano que percebes e de um hábito que consegues manter. O bynku foi feito para isso.",
      "No hace falta que se te den bien los números. Hace falta un plan que entiendas y un hábito que puedas mantener. bynku está hecho para eso.",
      "Du musst nicht gut mit Zahlen sein. Du brauchst einen Plan, den du verstehst, und eine Gewohnheit, die du hältst. Genau dafür ist bynku gebaut.",
      "Pas besoin d'être doué avec les chiffres. Il faut un plan que vous comprenez et une habitude que vous tenez. bynku est fait pour ça.",
    ),
  },

  // ------------------------------------------------------------ spending well
  {
    id: "spendingWell",
    icon: "Receipt",
    audience: "personal",
    title: L(
      "Spending is a choice, not an accident",
      "Gastar é uma escolha, não um acaso",
      "Gastar es una elección, no un accidente",
      "Ausgeben ist eine Wahl, kein Zufall",
      "Dépenser est un choix, pas un accident",
    ),
    paragraphs: L(
      [
        "Most overspending isn't reckless — it's invisible: a dozen small, reasonable yeses that add up. The cure isn't guilt, it's visibility. bynku gives you one honest figure, safe to spend, that already sets aside your bills, loans and goals — so what's left is genuinely yours to enjoy without a second thought.",
        "The useful line isn't needs versus wants; it's how much a purchase matters to you. bynku lets you tag spending on a gentle scale from essential to treat — not to scold, but so it can tell a thin month from a fun one, and celebrate treats when you're on track. Lifestyle creep — costs quietly rising with income — is the slow leak, and naming each expense is how you catch it.",
        "For bigger buys, momentum is the enemy of good decisions. The 'Plan a purchase' helper checks a specific buy against your real capacity and, if it's borderline, shows how to make it work — spread it, wait a cycle, or trim elsewhere — always comparing the total cost, never just the monthly.",
      ],
      [
        "A maior parte dos gastos a mais não é imprudência — é invisibilidade: uma dúzia de 'sins' pequenos e razoáveis que se somam. A cura não é a culpa, é a visibilidade. O bynku dá-te um número honesto, o seguro a gastar, que já reservou contas, créditos e objetivos — o que sobra é mesmo teu para aproveitar sem remorsos.",
        "A linha útil não é necessidades contra desejos; é o quanto uma compra te importa. O bynku deixa-te marcar cada gasto numa escala suave de essencial a miminho — não para censurar, mas para distinguir um mês apertado de um mês divertido, e celebrar os miminhos quando estás no caminho certo. A inflação de estilo de vida — custos a subir com o rendimento — é a fuga lenta, e dar nome a cada despesa é como a apanhas.",
        "Nas compras maiores, o impulso é inimigo das boas decisões. O 'Planear uma compra' testa uma compra concreta face à tua capacidade real e, se estiver renhida, mostra como fazer resultar — dividir, esperar um ciclo, ou cortar noutro lado — comparando sempre o custo total, nunca só a mensalidade.",
      ],
      [
        "Casi todo el gasto de más no es imprudencia, sino invisibilidad: una docena de pequeños 'sí' razonables que suman. La cura no es la culpa, es la visibilidad. bynku te da un número honesto, lo seguro para gastar, que ya ha apartado facturas, préstamos y metas — lo que queda es de verdad tuyo para disfrutarlo sin remordimientos.",
        "La línea útil no es necesidades frente a caprichos; es cuánto te importa una compra. bynku te deja etiquetar el gasto en una escala suave de esencial a capricho — no para reñir, sino para distinguir un mes justo de uno divertido, y celebrar los caprichos cuando vas bien. La inflación del estilo de vida — costes que suben con los ingresos — es la fuga lenta, y nombrar cada gasto es como la detectas.",
        "En las compras grandes, el impulso es enemigo de las buenas decisiones. 'Planear una compra' contrasta una compra concreta con tu capacidad real y, si está justa, muestra cómo lograrlo — repartirla, esperar un ciclo o recortar en otro sitio — comparando siempre el coste total, nunca solo la cuota.",
      ],
      [
        "Zu viel ausgeben ist meist keine Leichtsinnigkeit, sondern Unsichtbarkeit: ein Dutzend kleiner, vernünftiger Jas, die sich summieren. Die Kur heißt nicht Schuld, sondern Sichtbarkeit. bynku gibt dir eine ehrliche Zahl, das sichere Ausgeben, in der Rechnungen, Kredite und Ziele schon zurückgelegt sind — der Rest gehört wirklich dir, ohne Grübeln.",
        "Die nützliche Linie ist nicht Bedarf gegen Wunsch, sondern wie wichtig dir ein Kauf ist. bynku lässt dich Ausgaben auf einer sanften Skala von notwendig bis Vergnügen markieren — nicht zum Tadeln, sondern um einen knappen Monat von einem schönen zu unterscheiden und Vergnügen zu feiern, wenn du gut liegst. Lebensstil-Inflation — Kosten, die leise mit dem Einkommen steigen — ist das langsame Leck; jede Ausgabe zu benennen ist, wie du es fängst.",
        "Bei größeren Käufen ist Schwung der Feind guter Entscheidungen. „Kauf planen“ prüft einen konkreten Kauf gegen deine echte Kapazität und zeigt, falls knapp, wie es klappt — strecken, einen Zyklus warten oder woanders kürzen — immer im Vergleich der Gesamtkosten, nie nur der Rate.",
      ],
      [
        "La plupart des excès de dépense ne sont pas de l'imprudence — mais de l'invisibilité : une douzaine de petits « oui » raisonnables qui s'additionnent. Le remède n'est pas la culpabilité, c'est la visibilité. bynku vous donne un chiffre honnête, le montant sûr à dépenser, qui a déjà mis de côté factures, prêts et objectifs — le reste est vraiment à vous, sans arrière-pensée.",
        "La bonne ligne n'est pas besoin contre envie ; c'est l'importance d'un achat pour vous. bynku vous laisse étiqueter les dépenses sur une échelle douce, d'essentiel à petit plaisir — pas pour gronder, mais pour distinguer un mois serré d'un mois joyeux, et célébrer les plaisirs quand tout va bien. L'inflation du train de vie — des coûts qui montent avec les revenus — est la fuite lente ; nommer chaque dépense, c'est la repérer.",
        "Pour les gros achats, l'élan est l'ennemi des bonnes décisions. « Planifier un achat » confronte un achat précis à votre capacité réelle et, si c'est juste, montre comment y arriver — étaler, attendre un cycle, rogner ailleurs — en comparant toujours le coût total, jamais la seule mensualité.",
      ],
    ),
    bullets: L(
      [
        { label: "Safe to spend", body: "Bills, loans and goals are already reserved, so this number is guilt-free." },
        { label: "Need-level, not judgement", body: "Tag essential to treat; bynku tunes its tolerance to match, never lectures." },
        { label: "Watch the creep", body: "When everyday spending drifts above your estimate, bynku flags it early and gently." },
        { label: "Total cost, not the monthly", body: "The purchase helper weighs full price, finance cost, and the dent to your cushion." },
      ],
      [
        { label: "Seguro a gastar", body: "Contas, créditos e objetivos já estão reservados, por isso este número é sem culpa." },
        { label: "Nível de necessidade, não juízo", body: "Marca de essencial a miminho; o bynku ajusta a tolerância, nunca dá sermões." },
        { label: "Atenção à inflação", body: "Quando o dia a dia foge acima da estimativa, o bynku avisa cedo e com jeito." },
        { label: "Custo total, não a mensalidade", body: "O assistente pesa o preço total, o custo do crédito e o dano à almofada." },
      ],
      [
        { label: "Seguro para gastar", body: "Facturas, préstamos y metas ya están apartados, así que este número es sin culpa." },
        { label: "Nivel de necesidad, no juicio", body: "Etiqueta de esencial a capricho; bynku ajusta su tolerancia, nunca sermonea." },
        { label: "Ojo a la inflación", body: "Cuando el día a día se dispara sobre tu estimación, bynku lo avisa pronto y con tacto." },
        { label: "Coste total, no la cuota", body: "El asistente pesa el precio total, el coste de financiar y el daño a tu colchón." },
      ],
      [
        { label: "Sicheres Ausgeben", body: "Rechnungen, Kredite und Ziele sind schon zurückgelegt — diese Zahl ist schuldfrei." },
        { label: "Bedarfsstufe, kein Urteil", body: "Markiere von notwendig bis Vergnügen; bynku passt die Toleranz an, ohne Belehrung." },
        { label: "Auf das Leck achten", body: "Driftet der Alltag über deine Schätzung, meldet bynku es früh und behutsam." },
        { label: "Gesamtkosten, nicht die Rate", body: "Der Helfer wägt Vollpreis, Finanzierungskosten und den Schlag für deinen Puffer ab." },
      ],
      [
        { label: "Montant sûr à dépenser", body: "Factures, prêts et objectifs sont déjà réservés : ce chiffre est sans culpabilité." },
        { label: "Niveau de besoin, pas jugement", body: "Étiquetez d'essentiel à plaisir ; bynku ajuste sa tolérance, sans sermon." },
        { label: "Surveiller la dérive", body: "Quand le quotidien dépasse votre estimation, bynku le signale tôt et en douceur." },
        { label: "Coût total, pas la mensualité", body: "L'assistant pèse le prix total, le coût du crédit et l'entaille à votre coussin." },
      ],
    ),
    callout: L(
      "A treat is part of a healthy budget, not a failure of one. The point of tracking isn't to spend less — it's to spend on purpose.",
      "Um miminho faz parte de um orçamento saudável, não é uma falha. O objetivo de registar não é gastar menos — é gastar com intenção.",
      "Un capricho es parte de un presupuesto sano, no un fallo. El objetivo de registrar no es gastar menos, sino gastar a propósito.",
      "Ein Vergnügen gehört zu einem gesunden Budget, es ist kein Versagen. Ziel des Erfassens ist nicht, weniger auszugeben — sondern bewusst.",
      "Un plaisir fait partie d'un budget sain, ce n'est pas un échec. Le but du suivi n'est pas de dépenser moins, mais de dépenser à dessein.",
    ),
  },

  // ------------------------------------------------------------ saving well
  {
    id: "savingWell",
    icon: "PiggyBank",
    audience: "personal",
    title: L(
      "Pay yourself first",
      "Paga a ti primeiro",
      "Págate a ti primero",
      "Zahle zuerst dir selbst",
      "Payez-vous d'abord",
    ),
    paragraphs: L(
      [
        "Saving rarely fails for lack of will — it fails because it's the leftover, and leftovers are unreliable. Flip it: decide what goes aside first, then live on the rest. bynku builds this in — from your surplus you set money into projects before it can leak into everyday spending, and your savings rate is measured on what you actually moved, not what was theoretically spare.",
        "Not all saving is the same. A safety net is money you hope never to touch — it turns a crisis into an inconvenience and keeps you from borrowing at 20% to fix a 200 problem. Goals are money with a name and a date — a deposit, a trip, a laptop. bynku separates them as projects (emergency, savings, investment) so the buffer you mustn't raid never gets confused with the fun you're funding.",
        "Two numbers make saving feel real: months of cover — how long your reserve would last if income stopped — and your savings rate, the share of income you set aside. bynku tracks both against sensible milestones — a first month of cover, then three, then six — so progress is visible even when the totals are small.",
      ],
      [
        "Poupar raramente falha por falta de vontade — falha por ser a sobra, e as sobras não são de confiança. Inverte: decide primeiro o que pões de lado e vive com o resto. O bynku faz isto — do teu excedente colocas dinheiro em projetos antes que fuja para o dia a dia, e a taxa de poupança mede o que mexeste, não o que teoricamente sobrava.",
        "Nem toda a poupança é igual. Uma rede de segurança é dinheiro que esperas nunca tocar — transforma uma crise num incómodo e evita que peças crédito a 20% para resolver um problema de 200. Os objetivos são dinheiro com nome e data — uma entrada, uma viagem, um portátil. O bynku separa-os como projetos (emergência, poupança, investimento) para a almofada que não deves mexer nunca se confundir com o que estás a financiar por prazer.",
        "Dois números tornam a poupança real: meses de cobertura — quanto duraria a reserva se o rendimento parasse — e a taxa de poupança, a parte do rendimento que pões de lado. O bynku acompanha ambos face a metas sensatas — um primeiro mês de cobertura, depois três, depois seis — para o progresso ser visível mesmo com valores pequenos.",
      ],
      [
        "Ahorrar rara vez falla por falta de voluntad — falla por ser el sobrante, y los sobrantes no son fiables. Dale la vuelta: decide primero qué apartas y vive con el resto. bynku lo integra — de tu excedente pones dinero en proyectos antes de que se filtre al día a día, y tu tasa de ahorro mide lo que moviste de verdad, no lo que teóricamente sobraba.",
        "No todo el ahorro es igual. Una red de seguridad es dinero que esperas no tocar nunca — convierte una crisis en una molestia y evita que pidas crédito al 20% para arreglar un problema de 200. Las metas son dinero con nombre y fecha — una entrada, un viaje, un portátil. bynku los separa como proyectos (emergencia, ahorro, inversión) para que el colchón intocable no se confunda con lo que financias por gusto.",
        "Dos números hacen real el ahorro: meses de cobertura — cuánto duraría tu reserva si pararan los ingresos — y tu tasa de ahorro, la parte de ingresos que apartas. bynku sigue ambos frente a hitos sensatos — un primer mes de cobertura, luego tres, luego seis — para que el avance se vea aunque los totales sean pequeños.",
      ],
      [
        "Sparen scheitert selten am Willen — es scheitert, weil es der Rest ist, und Reste sind unzuverlässig. Dreh es um: Entscheide zuerst, was beiseitegeht, und lebe vom Rest. bynku baut das ein — aus deinem Überschuss legst du Geld in Projekte, bevor es in den Alltag sickert, und deine Sparquote misst, was du wirklich bewegt hast, nicht das theoretisch Übrige.",
        "Nicht jedes Sparen ist gleich. Ein Notgroschen ist Geld, das du nie anrühren willst — er macht aus einer Krise ein Ärgernis und verhindert, dass du zu 20% borgst, um ein 200-Problem zu lösen. Ziele sind Geld mit Namen und Datum — eine Anzahlung, eine Reise, ein Laptop. bynku trennt sie als Projekte (Notfall, Sparen, Investieren), damit der unantastbare Puffer nie mit dem verwechselt wird, was du zum Vergnügen finanzierst.",
        "Zwei Zahlen machen Sparen greifbar: Monate Deckung — wie lange die Reserve ohne Einkommen hielte — und deine Sparquote, der Anteil des Einkommens, den du zurücklegst. bynku verfolgt beide gegen sinnvolle Meilensteine — ein erster Monat Deckung, dann drei, dann sechs — damit Fortschritt sichtbar ist, auch bei kleinen Summen.",
      ],
      [
        "L'épargne échoue rarement par manque de volonté — elle échoue parce qu'elle est le reste, et le reste n'est pas fiable. Inversez : décidez d'abord ce que vous mettez de côté, puis vivez sur le reste. bynku l'intègre — depuis votre excédent, vous placez de l'argent dans des projets avant qu'il ne fuie vers le quotidien, et votre taux d'épargne mesure ce que vous avez vraiment déplacé, pas le théoriquement disponible.",
        "Toute épargne ne se vaut pas. Un matelas de sécurité est un argent qu'on espère ne jamais toucher — il change une crise en désagrément et évite d'emprunter à 20% pour régler un souci de 200. Les objectifs sont de l'argent avec un nom et une date — un apport, un voyage, un ordinateur. bynku les sépare en projets (urgence, épargne, investissement) pour que le coussin intouchable ne se confonde jamais avec ce que vous financez par plaisir.",
        "Deux chiffres rendent l'épargne concrète : les mois de couverture — combien de temps votre réserve tiendrait sans revenu — et votre taux d'épargne, la part de revenu mise de côté. bynku suit les deux face à des paliers raisonnables — un premier mois de couverture, puis trois, puis six — pour rendre le progrès visible même avec de petits montants.",
      ],
    ),
    bullets: L(
      [
        { label: "First, not last", body: "Set aside from surplus at cycle start; what's left is safe to spend, already net of savings." },
        { label: "Two jobs, two pots", body: "Emergency money you don't touch; goal money you're building — kept separate on purpose." },
        { label: "Sinking funds", body: "Turn a big future cost into a small monthly set-aside so it never becomes a shock or a loan." },
        { label: "Milestones, not perfection", body: "One month of cover beats zero. bynku celebrates the rung you're on and shows the next." },
      ],
      [
        { label: "Primeiro, não por último", body: "Põe de lado do excedente no início do ciclo; o que sobra é seguro a gastar, já líquido de poupança." },
        { label: "Duas funções, dois potes", body: "Dinheiro de emergência que não tocas; dinheiro de objetivo que constróis — separados de propósito." },
        { label: "Fundos a acumular", body: "Transforma um custo futuro grande numa pequena reserva mensal, para nunca virar choque ou crédito." },
        { label: "Metas, não perfeição", body: "Um mês de cobertura vale mais que zero. O bynku celebra o degrau em que estás e mostra o seguinte." },
      ],
      [
        { label: "Primero, no lo último", body: "Aparta del excedente al inicio del ciclo; lo que queda es seguro para gastar, ya neto de ahorro." },
        { label: "Dos funciones, dos botes", body: "Dinero de emergencia que no tocas; dinero de meta que construyes — separados a propósito." },
        { label: "Fondos que se acumulan", body: "Convierte un gran coste futuro en un pequeño apartado mensual, para que nunca sea un susto ni un crédito." },
        { label: "Hitos, no perfección", body: "Un mes de cobertura supera a cero. bynku celebra el peldaño en que estás y muestra el siguiente." },
      ],
      [
        { label: "Zuerst, nicht zuletzt", body: "Lege am Zyklusstart aus dem Überschuss zurück; der Rest ist sicheres Ausgeben, schon nach Sparen." },
        { label: "Zwei Aufgaben, zwei Töpfe", body: "Notfallgeld, das du nicht anrührst; Zielgeld, das du aufbaust — bewusst getrennt." },
        { label: "Ansparfonds", body: "Mach aus einem großen Zukunftskosten eine kleine monatliche Rücklage — nie Schock oder Kredit." },
        { label: "Meilensteine, keine Perfektion", body: "Ein Monat Deckung schlägt null. bynku feiert deine Stufe und zeigt die nächste." },
      ],
      [
        { label: "D'abord, pas en dernier", body: "Mettez de côté depuis l'excédent en début de cycle ; le reste est sûr à dépenser, déjà net d'épargne." },
        { label: "Deux rôles, deux pots", body: "L'argent d'urgence qu'on ne touche pas ; l'argent d'objectif qu'on construit — séparés à dessein." },
        { label: "Fonds d'amortissement", body: "Transformez un gros coût futur en petite réserve mensuelle, pour éviter le choc ou l'emprunt." },
        { label: "Des paliers, pas la perfection", body: "Un mois de couverture vaut mieux que zéro. bynku fête l'échelon atteint et montre le suivant." },
      ],
    ),
    callout: L(
      "The emergency fund is the least exciting and most powerful thing you'll build. It's what lets every other plan survive a bad week.",
      "O fundo de emergência é a coisa menos entusiasmante e mais poderosa que vais construir. É o que deixa todos os outros planos sobreviver a uma má semana.",
      "El fondo de emergencia es lo menos emocionante y más poderoso que construirás. Es lo que deja que cualquier otro plan sobreviva a una mala semana.",
      "Der Notgroschen ist das Unspektakulärste und Mächtigste, das du aufbaust. Er lässt jeden anderen Plan eine schlechte Woche überstehen.",
      "Le fonds d'urgence est la chose la moins excitante et la plus puissante que vous bâtirez. C'est lui qui permet à tout autre plan de survivre à une mauvaise semaine.",
    ),
  },

  // ------------------------------------------------------------ investing basics
  {
    id: "investingBasics",
    icon: "BarChart3",
    audience: "personal",
    title: L(
      "Let time do the heavy lifting",
      "Deixa o tempo fazer o trabalho pesado",
      "Deja que el tiempo haga el trabajo pesado",
      "Lass die Zeit die Arbeit machen",
      "Laissez le temps faire le gros du travail",
    ),
    paragraphs: L(
      [
        "Investing sounds complicated, but the core is simple: money put to work can grow on its own, and growth on past growth — compounding — is the quiet force that builds wealth. A small amount invested early can outrun a larger amount invested late, purely because it had more time. Time in the market beats timing the market.",
        "Order matters. Investing comes after a starter buffer and after clearing expensive debt — paying off a 15% card is a guaranteed 15% return no fund can promise. Once those are handled, idle cash in a low-interest account is quietly losing to inflation; that's the money to put to work. bynku models this: an investment project earns an assumed return, and Fast Forward compounds it forward so you can see what years of patience are worth.",
        "Return comes with risk, and risk needs time and diversification to tame — never invest the rent, never the emergency fund. bynku keeps investment money in its own project, separate from the reserve, so a market dip never touches the cash you need this month. It won't pick stocks for you; it shows the shape of the decision and where it fits in the order.",
      ],
      [
        "Investir parece complicado, mas o essencial é simples: dinheiro posto a render pode crescer sozinho, e o crescimento sobre o crescimento passado — juro composto — é a força silenciosa que cria riqueza. Uma pequena quantia investida cedo pode ultrapassar uma maior investida tarde, só por ter tido mais tempo. Tempo no mercado vale mais do que acertar o momento.",
        "A ordem importa. Investir vem depois da almofada inicial e de liquidar a dívida cara — pagar um cartão a 15% é um retorno garantido de 15% que nenhum fundo promete. Feito isso, dinheiro parado numa conta com juro baixo perde silenciosamente para a inflação; é esse que deves pôr a render. O bynku modela isto: um projeto de investimento rende um retorno assumido, e o Avançar rápido compõe-no no tempo para veres quanto valem anos de paciência.",
        "O retorno vem com risco, e o risco precisa de tempo e diversificação para se domar — nunca invistas a renda, nunca o fundo de emergência. O bynku mantém o dinheiro de investimento num projeto próprio, separado da reserva, para que uma queda do mercado nunca toque no dinheiro deste mês. Não escolhe ações por ti; mostra o formato da decisão e onde ela encaixa na ordem.",
      ],
      [
        "Invertir suena complicado, pero el núcleo es simple: el dinero puesto a trabajar puede crecer solo, y el crecimiento sobre el crecimiento pasado — el interés compuesto — es la fuerza silenciosa que crea riqueza. Una cantidad pequeña invertida pronto puede superar a una mayor invertida tarde, solo por haber tenido más tiempo. Tiempo en el mercado supera a acertar el momento.",
        "El orden importa. Invertir va después del colchón inicial y de saldar la deuda cara — pagar una tarjeta al 15% es un retorno garantizado del 15% que ningún fondo promete. Hecho eso, el dinero parado en una cuenta de bajo interés pierde en silencio ante la inflación; ese es el que hay que poner a trabajar. bynku lo modela: un proyecto de inversión rinde un retorno supuesto, y Avance rápido lo compone en el tiempo para que veas cuánto valen los años de paciencia.",
        "El retorno viene con riesgo, y el riesgo necesita tiempo y diversificación para domarse — nunca inviertas el alquiler, nunca el fondo de emergencia. bynku mantiene el dinero de inversión en su propio proyecto, aparte de la reserva, para que una caída del mercado nunca toque el dinero de este mes. No elige acciones por ti; muestra la forma de la decisión y dónde encaja en el orden.",
      ],
      [
        "Investieren klingt kompliziert, doch der Kern ist einfach: arbeitendes Geld kann von selbst wachsen, und Wachstum auf früherem Wachstum — Zinseszins — ist die leise Kraft, die Vermögen aufbaut. Eine kleine, früh investierte Summe kann eine größere, spät investierte überholen, nur weil sie mehr Zeit hatte. Zeit im Markt schlägt das Timen des Marktes.",
        "Die Reihenfolge zählt. Investieren kommt nach dem Startpuffer und nach dem Tilgen teurer Schuld — eine 15%-Karte zu tilgen ist eine garantierte Rendite von 15%, die kein Fonds verspricht. Danach verliert ruhendes Geld auf einem Niedrigzinskonto leise gegen die Inflation; genau das gehört an die Arbeit. bynku bildet das ab: Ein Investitionsprojekt erzielt eine angenommene Rendite, und Vorspulen verzinst sie in die Zukunft, damit du siehst, was Jahre Geduld wert sind.",
        "Rendite bringt Risiko, und Risiko braucht Zeit und Streuung zur Zähmung — investiere nie die Miete, nie den Notgroschen. bynku hält Investitionsgeld in einem eigenen Projekt, getrennt von der Reserve, damit ein Markteinbruch nie das Geld dieses Monats berührt. Es wählt keine Aktien für dich; es zeigt die Form der Entscheidung und wo sie in der Reihenfolge steht.",
      ],
      [
        "Investir semble compliqué, mais le cœur est simple : un argent mis au travail peut croître seul, et la croissance sur la croissance passée — les intérêts composés — est la force silencieuse qui bâtit la richesse. Une petite somme investie tôt peut dépasser une plus grosse investie tard, juste parce qu'elle a eu plus de temps. Le temps dans le marché vaut mieux que le bon moment.",
        "L'ordre compte. Investir vient après le coussin de départ et après avoir soldé la dette chère — rembourser une carte à 15% est un rendement garanti de 15% qu'aucun fonds ne promet. Ensuite, un argent dormant sur un compte peu rémunéré perd en silence face à l'inflation ; c'est celui-là qu'il faut faire travailler. bynku le modélise : un projet d'investissement gagne un rendement supposé, et Avance rapide le capitalise pour montrer ce que valent des années de patience.",
        "Le rendement s'accompagne de risque, et le risque se dompte par le temps et la diversification — n'investissez jamais le loyer, jamais le fonds d'urgence. bynku garde l'argent d'investissement dans son propre projet, séparé de la réserve, pour qu'une baisse des marchés ne touche jamais l'argent du mois. Il ne choisit pas d'actions pour vous ; il montre la forme de la décision et sa place dans l'ordre.",
      ],
    ),
    bullets: L(
      [
        { label: "Compounding", body: "Growth earns growth. Starting small but early usually beats starting big but late." },
        { label: "After the essentials", body: "Buffer and dear debt first — then invest the surplus instead of letting it idle." },
        { label: "Risk in its own pot", body: "Investment is a separate project; the emergency fund stays untouched and liquid." },
        { label: "See patience pay off", body: "Fast Forward compounds an assumed return so long horizons stop feeling abstract." },
      ],
      [
        { label: "Juro composto", body: "O crescimento gera crescimento. Começar pequeno mas cedo costuma bater começar grande mas tarde." },
        { label: "Depois do essencial", body: "Primeiro almofada e dívida cara — depois investe o excedente em vez de o deixar parado." },
        { label: "Risco em pote próprio", body: "O investimento é um projeto à parte; o fundo de emergência fica intocado e líquido." },
        { label: "Vê a paciência render", body: "O Avançar rápido compõe um retorno assumido para os longos prazos deixarem de ser abstratos." },
      ],
      [
        { label: "Interés compuesto", body: "El crecimiento genera crecimiento. Empezar pequeño pero pronto suele ganar a empezar grande pero tarde." },
        { label: "Tras lo esencial", body: "Primero colchón y deuda cara — luego invierte el excedente en vez de dejarlo parado." },
        { label: "Riesgo en su propio bote", body: "La inversión es un proyecto aparte; el fondo de emergencia sigue intacto y líquido." },
        { label: "Ve rendir la paciencia", body: "Avance rápido compone un retorno supuesto para que los plazos largos dejen de ser abstractos." },
      ],
      [
        { label: "Zinseszins", body: "Wachstum bringt Wachstum. Klein aber früh schlägt meist groß aber spät." },
        { label: "Nach dem Wesentlichen", body: "Erst Puffer und teure Schuld — dann den Überschuss investieren, statt ihn ruhen zu lassen." },
        { label: "Risiko im eigenen Topf", body: "Investieren ist ein eigenes Projekt; der Notgroschen bleibt unberührt und liquide." },
        { label: "Geduld zahlt sich aus", body: "Vorspulen verzinst eine angenommene Rendite, damit lange Horizonte greifbar werden." },
      ],
      [
        { label: "Intérêts composés", body: "La croissance nourrit la croissance. Petit mais tôt bat souvent gros mais tard." },
        { label: "Après l'essentiel", body: "Coussin et dette chère d'abord — puis investir l'excédent plutôt que le laisser dormir." },
        { label: "Le risque dans son pot", body: "L'investissement est un projet à part ; le fonds d'urgence reste intact et liquide." },
        { label: "Voir la patience payer", body: "Avance rapide capitalise un rendement supposé pour rendre les longs horizons concrets." },
      ],
    ),
    callout: L(
      "bynku won't tell you what to buy — that's not its job, and be wary of anyone paid to. It shows why investing comes when it does, and what time can do.",
      "O bynku não te diz o que comprar — não é o seu papel, e desconfia de quem é pago para isso. Mostra porque é que investir vem quando vem, e o que o tempo pode fazer.",
      "bynku no te dice qué comprar — no es su función, y desconfía de quien cobra por ello. Muestra por qué invertir llega cuando llega, y lo que el tiempo puede hacer.",
      "bynku sagt dir nicht, was du kaufen sollst — das ist nicht seine Aufgabe, und sei vorsichtig bei jedem, der dafür bezahlt wird. Es zeigt, warum Investieren dann kommt, und was Zeit bewirken kann.",
      "bynku ne vous dit pas quoi acheter — ce n'est pas son rôle, et méfiez-vous de qui est payé pour ça. Il montre pourquoi investir vient à ce moment, et ce que le temps peut faire.",
    ),
  },

  // ------------------------------------------------------------ understanding debt
  {
    id: "understandingDebt",
    icon: "CreditCard",
    audience: "personal",
    title: L(
      "Borrowing, and the true cost of it",
      "Pedir emprestado, e o seu custo real",
      "Endeudarse, y su coste real",
      "Kredit — und was er wirklich kostet",
      "Emprunter, et son coût réel",
    ),
    paragraphs: L(
      [
        "Debt isn't good or bad by itself — it's a tool with a price. A low-rate loan for a home or a productive asset can be sensible; a card balance rolling at 20% is a leak that quietly drains everything else. The number that matters is the rate; the number lenders love to show instead is the monthly payment — small, friendly, and silent about the total you'll actually hand over.",
        "bynku always works in total cost. Enter a loan and it reconstructs the real amortization — how much of each payment is interest versus principal, when it's truly gone, and the actual annual rate even when only the instalment was advertised. Seeing that a 'cheap' 60-month plan costs a third more than the sticker is often all it takes to change a decision.",
        "When there's spare money, expensive debt usually deserves it before investing — clearing it is a risk-free return at the debt's rate. Two proven orders help: the avalanche (attack the highest rate first, least interest paid) and the snowball (clear the smallest balance first, fastest sense of progress). bynku's overpay simulator shows what an extra amount saves in interest and months, and the coach — with nothing to sell — will happily suggest overpaying, refinancing, or renegotiating with your bank.",
      ],
      [
        "A dívida não é boa nem má por si — é uma ferramenta com preço. Um empréstimo a taxa baixa para casa ou um bem produtivo pode fazer sentido; um saldo de cartão a 20% é uma fuga que drena silenciosamente tudo o resto. O número que importa é a taxa; o que os credores adoram mostrar é a mensalidade — pequena, simpática e calada quanto ao total que vais mesmo pagar.",
        "O bynku trabalha sempre em custo total. Insere um empréstimo e ele reconstrói a amortização real — quanto de cada pagamento é juro e quanto é capital, quando fica mesmo pago, e a taxa anual real mesmo quando só a prestação foi anunciada. Ver que um plano 'barato' a 60 meses custa mais um terço do que o preço à vista costuma bastar para mudar a decisão.",
        "Havendo dinheiro a mais, a dívida cara costuma merecê-lo antes de investir — liquidá-la é um retorno sem risco à taxa da dívida. Duas ordens comprovadas ajudam: a avalanche (atacar primeiro a taxa mais alta, menos juro pago) e a bola de neve (liquidar primeiro o saldo mais pequeno, sensação de progresso mais rápida). O simulador de amortização do bynku mostra o que um valor extra poupa em juro e meses, e o coach — sem nada para vender — sugere de bom grado amortizar, refinanciar ou renegociar com o banco.",
      ],
      [
        "La deuda no es buena ni mala en sí — es una herramienta con precio. Un préstamo a tipo bajo para una casa o un activo productivo puede ser sensato; un saldo de tarjeta al 20% es una fuga que drena en silencio todo lo demás. El número que importa es el tipo; el que a los prestamistas les encanta mostrar es la cuota — pequeña, amable y callada sobre el total que de verdad pagarás.",
        "bynku siempre trabaja en coste total. Introduce un préstamo y reconstruye la amortización real — cuánto de cada pago es interés y cuánto principal, cuándo queda de verdad saldado, y el tipo anual real aunque solo se anunciara la cuota. Ver que un plan 'barato' a 60 meses cuesta un tercio más que el precio suele bastar para cambiar una decisión.",
        "Cuando sobra dinero, la deuda cara suele merecerlo antes que invertir — saldarla es un retorno sin riesgo al tipo de la deuda. Dos órdenes probados ayudan: la avalancha (atacar primero el tipo más alto, menos interés pagado) y la bola de nieve (saldar primero el saldo más pequeño, sensación de avance más rápida). El simulador de amortización de bynku muestra lo que un extra ahorra en interés y meses, y el asistente — sin nada que vender — sugiere con gusto amortizar, refinanciar o renegociar con tu banco.",
      ],
      [
        "Schulden sind an sich weder gut noch schlecht — ein Werkzeug mit Preis. Ein zinsgünstiges Darlehen für ein Zuhause oder einen produktiven Wert kann sinnvoll sein; ein Kartensaldo zu 20% ist ein Leck, das leise alles andere leert. Es zählt der Zins; Kreditgeber zeigen lieber die Rate — klein, freundlich und still zum Gesamtbetrag, den du wirklich zahlst.",
        "bynku rechnet immer in Gesamtkosten. Gib einen Kredit ein, und es rekonstruiert die echte Tilgung — wie viel jeder Zahlung Zins und wie viel Kapital ist, wann er wirklich weg ist, und den tatsächlichen Jahreszins, selbst wenn nur die Rate beworben wurde. Zu sehen, dass ein 'günstiger' 60-Monats-Plan ein Drittel mehr kostet als der Preis, reicht oft, um eine Entscheidung zu ändern.",
        "Gibt es Übriges, verdient teure Schuld es meist vor dem Investieren — sie zu tilgen ist eine risikofreie Rendite zum Schuldzins. Zwei bewährte Reihenfolgen helfen: die Lawine (zuerst den höchsten Zins, am wenigsten Zins gezahlt) und der Schneeball (zuerst den kleinsten Saldo, schnellstes Erfolgsgefühl). bynkus Sondertilgungs-Simulator zeigt, was ein Extra an Zins und Monaten spart, und der Coach — ohne etwas zu verkaufen — schlägt gern Sondertilgung, Umschuldung oder Neuverhandlung mit der Bank vor.",
      ],
      [
        "La dette n'est ni bonne ni mauvaise en soi — c'est un outil avec un prix. Un prêt à taux bas pour un logement ou un actif productif peut être sensé ; un solde de carte à 20% est une fuite qui vide en silence tout le reste. Le chiffre qui compte est le taux ; celui que les prêteurs adorent montrer est la mensualité — petite, aimable et muette sur le total que vous paierez vraiment.",
        "bynku raisonne toujours en coût total. Saisissez un prêt et il reconstruit l'amortissement réel — la part d'intérêts et de capital de chaque paiement, la vraie date de fin, et le taux annuel réel même quand seule l'échéance était affichée. Voir qu'un plan « pas cher » sur 60 mois coûte un tiers de plus que le prix suffit souvent à changer une décision.",
        "Quand il reste de l'argent, la dette chère le mérite souvent avant d'investir — la solder est un rendement sans risque au taux de la dette. Deux ordres éprouvés aident : l'avalanche (attaquer d'abord le taux le plus élevé, moins d'intérêts) et la boule de neige (solder d'abord le plus petit solde, progression la plus rapide). Le simulateur de remboursement de bynku montre ce qu'un extra économise en intérêts et en mois, et l'assistant — sans rien à vendre — suggère volontiers de rembourser par anticipation, refinancer ou renégocier avec votre banque.",
      ],
    ),
    bullets: L(
      [
        { label: "Rate over monthly", body: "A low payment can hide a high total. bynku surfaces the APR and full cost, always." },
        { label: "Real amortization", body: "See interest vs principal, the payoff date, and the deduced true rate from just the instalment." },
        { label: "Avalanche vs snowball", body: "Highest-rate first saves the most; smallest-balance first feels the best. Pick your motivator." },
        { label: "Overpay, refinance, negotiate", body: "The simulator quantifies overpayments; the coach suggests moves a bank never would." },
      ],
      [
        { label: "Taxa acima da mensalidade", body: "Uma prestação baixa pode esconder um total alto. O bynku mostra sempre a taxa e o custo total." },
        { label: "Amortização real", body: "Vê juro vs capital, a data de fim e a taxa real deduzida só a partir da prestação." },
        { label: "Avalanche vs bola de neve", body: "Taxa mais alta primeiro poupa mais; saldo mais pequeno primeiro sabe melhor. Escolhe o teu motor." },
        { label: "Amortizar, refinanciar, negociar", body: "O simulador quantifica amortizações; o coach sugere jogadas que um banco nunca faria." },
      ],
      [
        { label: "Tipo sobre la cuota", body: "Una cuota baja puede ocultar un total alto. bynku muestra siempre el tipo y el coste total." },
        { label: "Amortización real", body: "Ve interés vs principal, la fecha de fin y el tipo real deducido solo desde la cuota." },
        { label: "Avalancha vs bola de nieve", body: "El tipo más alto primero ahorra más; el saldo menor primero sienta mejor. Elige tu motor." },
        { label: "Amortizar, refinanciar, negociar", body: "El simulador cuantifica amortizaciones; el asistente sugiere jugadas que un banco nunca haría." },
      ],
      [
        { label: "Zins vor Rate", body: "Eine niedrige Rate kann einen hohen Gesamtbetrag verbergen. bynku zeigt immer Zins und Gesamtkosten." },
        { label: "Echte Tilgung", body: "Sieh Zins vs Kapital, das Enddatum und den echten Zins, abgeleitet nur aus der Rate." },
        { label: "Lawine vs Schneeball", body: "Höchster Zins zuerst spart am meisten; kleinster Saldo zuerst fühlt sich am besten an. Wähle deinen Antrieb." },
        { label: "Tilgen, umschulden, verhandeln", body: "Der Simulator beziffert Sondertilgungen; der Coach schlägt Züge vor, die keine Bank täte." },
      ],
      [
        { label: "Le taux avant la mensualité", body: "Une petite échéance peut cacher un gros total. bynku affiche toujours le taux et le coût total." },
        { label: "Amortissement réel", body: "Voyez intérêts vs capital, la date de fin et le vrai taux déduit de la seule échéance." },
        { label: "Avalanche vs boule de neige", body: "Le taux le plus haut d'abord économise le plus ; le plus petit solde d'abord motive le plus. À vous de choisir." },
        { label: "Rembourser, refinancer, négocier", body: "Le simulateur chiffre les remboursements ; l'assistant suggère des coups qu'une banque ne ferait jamais." },
      ],
    ),
    callout: L(
      "The cheapest debt is the one you understand before you sign. bynku's job is to make the total cost impossible to miss — and to always take your side against it.",
      "A dívida mais barata é a que percebes antes de assinar. O papel do bynku é tornar o custo total impossível de ignorar — e estar sempre do teu lado contra ela.",
      "La deuda más barata es la que entiendes antes de firmar. El papel de bynku es hacer el coste total imposible de pasar por alto — y ponerse siempre de tu lado frente a ella.",
      "Die günstigste Schuld ist die, die du vor der Unterschrift verstehst. bynkus Aufgabe ist, die Gesamtkosten unübersehbar zu machen — und immer auf deiner Seite gegen sie zu stehen.",
      "La dette la moins chère est celle que vous comprenez avant de signer. Le rôle de bynku est de rendre le coût total impossible à manquer — et de toujours prendre votre parti contre elle.",
    ),
  },

  // ------------------------------------------------------------ time value of money
  {
    id: "timeValue",
    icon: "Calculator",
    title: L(
      "The time value of money",
      "O valor do dinheiro no tempo",
      "El valor del dinero en el tiempo",
      "Der Zeitwert des Geldes",
      "La valeur temporelle de l'argent",
    ),
    paragraphs: L(
      [
        "A euro today is worth more than a euro a year from now — not out of greed, but because today's euro can be put to work: earning a return, or clearing a debt that's charging interest. A future euro just sits in the future. The same amount is simply more useful the sooner you hold it.",
        "So 'sooner' beats 'later' for money coming in, and 'later' is cheaper for money going out. A sum promised next year should be discounted — valued a little below the same sum today. Almost every serious money decision, from paying a debt early to waiting for a payout, is a time-value question in disguise.",
        "bynku's Fast Forward is built on this idea: it rolls your position forward month by month, compounding returns and amortizing debt, so a choice made today is shown as the position it leads to later — the future value of a decision, made visible.",
      ],
      [
        "Um euro hoje vale mais do que um euro daqui a um ano — não por ganância, mas porque o euro de hoje pode trabalhar: render um retorno ou pagar uma dívida que cobra juros. Um euro futuro fica no futuro. O mesmo valor é simplesmente mais útil quanto mais cedo o tens.",
        "Por isso 'mais cedo' vence 'mais tarde' para o que entra, e 'mais tarde' é mais barato para o que sai. Um valor prometido para o próximo ano deve ser descontado — vale um pouco menos do que o mesmo valor hoje. Quase toda a decisão séria de dinheiro, de pagar uma dívida cedo a esperar por um recebimento, é uma questão de valor no tempo disfarçada.",
        "O Avançar rápido do bynku assenta nesta ideia: leva a tua posição para a frente mês a mês, compondo retornos e amortizando dívida, para uma escolha de hoje ser mostrada como a posição a que leva mais tarde — o valor futuro de uma decisão, tornado visível.",
      ],
      [
        "Un euro hoy vale más que un euro dentro de un año — no por codicia, sino porque el euro de hoy puede ponerse a trabajar: rentar un retorno o saldar una deuda que cobra intereses. Un euro futuro solo espera en el futuro. La misma cantidad es sencillamente más útil cuanto antes la tengas.",
        "Así, 'antes' gana a 'después' para lo que entra, y 'después' es más barato para lo que sale. Una suma prometida para el año que viene debe descontarse — vale algo menos que la misma suma hoy. Casi toda decisión seria de dinero, de pagar una deuda pronto a esperar un cobro, es una cuestión de valor temporal disfrazada.",
        "El Avance rápido de bynku se basa en esta idea: lleva tu posición hacia delante mes a mes, componiendo retornos y amortizando deuda, para que una elección de hoy se muestre como la posición a la que lleva después — el valor futuro de una decisión, hecho visible.",
      ],
      [
        "Ein Euro heute ist mehr wert als ein Euro in einem Jahr — nicht aus Gier, sondern weil der heutige Euro arbeiten kann: eine Rendite erzielen oder eine verzinste Schuld tilgen. Ein künftiger Euro sitzt nur in der Zukunft. Dieselbe Summe ist schlicht nützlicher, je früher du sie hast.",
        "Also schlägt 'früher' das 'später' beim Eingang, und 'später' ist günstiger beim Ausgang. Eine für nächstes Jahr versprochene Summe sollte abgezinst werden — sie ist etwas weniger wert als dieselbe Summe heute. Fast jede ernste Geldentscheidung, vom frühen Tilgen bis zum Warten auf eine Zahlung, ist verkappt eine Frage des Zeitwerts.",
        "bynkus Vorspulen beruht darauf: Es trägt deine Lage Monat für Monat voran, verzinst Renditen und tilgt Schulden, sodass eine heutige Wahl als die Lage erscheint, zu der sie später führt — der Zukunftswert einer Entscheidung, sichtbar gemacht.",
      ],
      [
        "Un euro aujourd'hui vaut plus qu'un euro dans un an — non par cupidité, mais parce que l'euro d'aujourd'hui peut travailler : gagner un rendement, ou solder une dette qui porte intérêt. Un euro futur ne fait qu'attendre dans le futur. La même somme est simplement plus utile plus tôt vous l'avez.",
        "Ainsi « plus tôt » l'emporte sur « plus tard » pour ce qui entre, et « plus tard » coûte moins pour ce qui sort. Une somme promise l'an prochain doit être actualisée — elle vaut un peu moins que la même somme aujourd'hui. Presque toute décision sérieuse d'argent, du remboursement anticipé à l'attente d'un versement, est une question de valeur temporelle déguisée.",
        "L'Avance rapide de bynku repose là-dessus : il projette votre position mois après mois, capitalise les rendements et amortit la dette, pour montrer un choix d'aujourd'hui comme la position qu'il produit plus tard — la valeur future d'une décision, rendue visible.",
      ],
    ),
    bullets: L(
      [
        { label: "Sooner is worth more", body: "The earlier money arrives, the longer it can earn or save interest — so it's worth more." },
        { label: "Discount the future", body: "A sum promised later is worth less than the same sum now; how much less depends on the rate." },
        { label: "Waiting has a cost", body: "Idle money isn't free — it's the return or interest you could have had instead." },
        { label: "Decisions are time trades", body: "Pay now or later, take it now or wait — each is a time-value comparison in disguise." },
      ],
      [
        { label: "Mais cedo vale mais", body: "Quanto mais cedo o dinheiro chega, mais tempo tem para render ou poupar juros — vale mais." },
        { label: "Descontar o futuro", body: "Um valor prometido mais tarde vale menos que o mesmo hoje; quanto menos depende da taxa." },
        { label: "Esperar tem custo", body: "Dinheiro parado não é grátis — é o retorno ou juro que podias ter tido." },
        { label: "Decisões são trocas no tempo", body: "Pagar já ou depois, receber já ou esperar — cada uma é uma comparação de valor no tempo." },
      ],
      [
        { label: "Antes vale más", body: "Cuanto antes llega el dinero, más tiempo tiene para rentar o ahorrar intereses — vale más." },
        { label: "Descontar el futuro", body: "Una suma prometida después vale menos que la misma hoy; cuánto menos depende del tipo." },
        { label: "Esperar tiene coste", body: "El dinero parado no es gratis — es el retorno o interés que podrías haber tenido." },
        { label: "Decisiones son canjes de tiempo", body: "Pagar ya o después, cobrar ya o esperar — cada una es una comparación de valor temporal." },
      ],
      [
        { label: "Früher ist mehr wert", body: "Je früher Geld kommt, desto länger kann es Zinsen verdienen oder sparen — es ist mehr wert." },
        { label: "Die Zukunft abzinsen", body: "Eine später versprochene Summe ist weniger wert als dieselbe heute; wie viel, hängt vom Zins ab." },
        { label: "Warten kostet", body: "Ruhendes Geld ist nicht umsonst — es ist die Rendite oder der Zins, den du sonst gehabt hättest." },
        { label: "Entscheidungen sind Zeittausche", body: "Jetzt oder später zahlen, jetzt nehmen oder warten — je ein verkappter Zeitwert-Vergleich." },
      ],
      [
        { label: "Plus tôt vaut plus", body: "Plus l'argent arrive tôt, plus il peut gagner ou économiser des intérêts — donc il vaut plus." },
        { label: "Actualiser le futur", body: "Une somme promise plus tard vaut moins que la même aujourd'hui ; combien dépend du taux." },
        { label: "Attendre a un coût", body: "L'argent dormant n'est pas gratuit — c'est le rendement ou l'intérêt que vous auriez pu avoir." },
        { label: "Décider, c'est troquer du temps", body: "Payer tôt ou tard, prendre ou attendre — chaque fois une comparaison de valeur temporelle." },
      ],
    ),
    callout: L(
      "Time is the one input you can't buy more of. Used well, it does more for your money than any clever product.",
      "O tempo é o único recurso que não podes comprar mais. Bem usado, faz mais pelo teu dinheiro do que qualquer produto engenhoso.",
      "El tiempo es el único recurso del que no puedes comprar más. Bien usado, hace más por tu dinero que cualquier producto ingenioso.",
      "Zeit ist die eine Ressource, von der du nicht mehr kaufen kannst. Gut genutzt bewirkt sie mehr für dein Geld als jedes clevere Produkt.",
      "Le temps est la seule ressource dont on ne peut acheter plus. Bien utilisé, il fait plus pour votre argent que tout produit malin.",
    ),
    businessNote: L(
      "Companies formalise this as discounting: future cash flows are converted to today's value (present value), and an investment only makes sense if its discounted returns beat the cost of the capital tied up. It's the backbone of every 'should we spend on this?' decision — the same question the 'Plan a purchase' and Fast Forward tools help you weigh.",
      "As empresas formalizam isto como desconto: os fluxos de caixa futuros são convertidos ao valor de hoje (valor atual), e um investimento só faz sentido se os retornos descontados superarem o custo do capital imobilizado. É a base de toda a decisão de 'vale a pena gastar nisto?' — a mesma pergunta que o 'Planear uma compra' e o Avançar rápido ajudam a pesar.",
      "Las empresas lo formalizan como descuento: los flujos de caja futuros se convierten a valor de hoy (valor actual), y una inversión solo tiene sentido si sus retornos descontados superan el coste del capital inmovilizado. Es la base de toda decisión de '¿merece la pena gastar en esto?' — la misma que 'Planear una compra' y Avance rápido ayudan a sopesar.",
      "Unternehmen formalisieren das als Abzinsung: Künftige Cashflows werden auf den heutigen Wert (Barwert) gebracht, und eine Investition lohnt nur, wenn ihre abgezinsten Erträge die Kosten des gebundenen Kapitals schlagen. Das ist der Kern jeder 'Sollen wir dafür Geld ausgeben?'-Entscheidung — dieselbe Frage, die 'Kauf planen' und Vorspulen abwägen helfen.",
      "Les entreprises le formalisent par l'actualisation : les flux futurs sont ramenés à leur valeur d'aujourd'hui (valeur actuelle), et un investissement n'a de sens que si ses rendements actualisés dépassent le coût du capital immobilisé. C'est le socle de toute décision « faut-il dépenser pour cela ? » — la question que « Planifier un achat » et Avance rapide aident à peser.",
    ),
  },

  // ------------------------------------------------------------ compounding
  {
    id: "compounding",
    icon: "Calculator",
    title: L(
      "Compound interest: growth on growth",
      "Juro composto: crescimento sobre crescimento",
      "Interés compuesto: crecimiento sobre crecimiento",
      "Zinseszins: Wachstum auf Wachstum",
      "Intérêts composés : croissance sur croissance",
    ),
    paragraphs: L(
      [
        "Simple interest earns on the original amount. Compound interest earns on the original amount plus all the interest already added — so growth itself starts earning. Over a short time the difference is small; over decades it's enormous. It is the quiet engine behind both building wealth and sinking into debt.",
        "A handy shortcut, the Rule of 72: divide 72 by the yearly rate to estimate how long money takes to double. At 6% that's about twelve years; at 12%, about six. The same maths runs in reverse on debt — a balance left to compound doubles just as fast, which is how a small unpaid card becomes a large one.",
        "The lesson is direction. Make compounding work for you — start early, reinvest returns, leave savings to grow — and stop it working against you by clearing compounding debt first. bynku compounds an assumed return in its projections and reconstructs the real interest on a loan, so both sides of the coin show up in your own numbers.",
      ],
      [
        "O juro simples rende sobre o valor inicial. O juro composto rende sobre o valor inicial mais todo o juro já acrescentado — por isso o próprio crescimento começa a render. Em pouco tempo a diferença é pequena; ao longo de décadas é enorme. É o motor silencioso por detrás tanto de criar riqueza como de afundar em dívida.",
        "Um atalho útil, a Regra dos 72: divide 72 pela taxa anual para estimar quanto tempo o dinheiro demora a duplicar. A 6% são cerca de doze anos; a 12%, cerca de seis. A mesma conta corre ao contrário na dívida — um saldo deixado a compor duplica igual de depressa, e é assim que um pequeno cartão por pagar se torna grande.",
        "A lição é a direção. Põe o juro composto a teu favor — começa cedo, reinveste retornos, deixa a poupança crescer — e trava-o a teu desfavor liquidando primeiro a dívida que compõe. O bynku compõe um retorno assumido nas projeções e reconstrói o juro real de um empréstimo, para os dois lados da moeda aparecerem nos teus números.",
      ],
      [
        "El interés simple renta sobre la cantidad inicial. El compuesto renta sobre la cantidad inicial más todo el interés ya añadido — así el propio crecimiento empieza a rentar. En poco tiempo la diferencia es pequeña; en décadas es enorme. Es el motor silencioso tras crear riqueza y tras hundirse en deuda.",
        "Un atajo útil, la Regla del 72: divide 72 entre el tipo anual para estimar cuánto tarda el dinero en duplicarse. Al 6% son unos doce años; al 12%, unos seis. La misma cuenta corre al revés en la deuda — un saldo dejado componer se duplica igual de rápido, y así una tarjeta pequeña sin pagar se hace grande.",
        "La lección es la dirección. Pon el interés compuesto a tu favor — empieza pronto, reinvierte retornos, deja crecer el ahorro — y frénalo en tu contra saldando primero la deuda que compone. bynku compone un retorno supuesto en sus proyecciones y reconstruye el interés real de un préstamo, para que ambas caras salgan en tus números.",
      ],
      [
        "Einfacher Zins verdient auf dem Ausgangsbetrag. Zinseszins verdient auf dem Ausgangsbetrag plus allen bereits zugefügten Zinsen — so beginnt das Wachstum selbst zu verdienen. Kurzfristig ist der Unterschied klein; über Jahrzehnte gewaltig. Es ist der leise Motor hinter Vermögensaufbau wie hinter dem Abrutschen in Schulden.",
        "Eine handliche Faustregel, die 72er-Regel: Teile 72 durch den Jahreszins, um zu schätzen, wie lange Geld zum Verdoppeln braucht. Bei 6% etwa zwölf Jahre; bei 12% etwa sechs. Dieselbe Rechnung läuft rückwärts bei Schulden — ein sich verzinsender Saldo verdoppelt sich genauso schnell, so wird aus einer kleinen offenen Karte eine große.",
        "Die Lehre ist die Richtung. Lass Zinseszins für dich arbeiten — früh anfangen, Erträge reinvestieren, Erspartes wachsen lassen — und stoppe ihn gegen dich, indem du sich verzinsende Schuld zuerst tilgst. bynku verzinst eine angenommene Rendite in Projektionen und rekonstruiert den echten Kreditzins, damit beide Seiten in deinen Zahlen auftauchen.",
      ],
      [
        "L'intérêt simple rapporte sur le montant initial. L'intérêt composé rapporte sur le montant initial plus tous les intérêts déjà ajoutés — la croissance elle-même se met à rapporter. À court terme la différence est faible ; sur des décennies, énorme. C'est le moteur discret derrière la constitution de richesse comme derrière l'enlisement dans la dette.",
        "Un raccourci pratique, la règle de 72 : divisez 72 par le taux annuel pour estimer le temps de doublement. À 6%, environ douze ans ; à 12%, environ six. Le même calcul joue à l'envers sur la dette — un solde laissé se composer double aussi vite, et c'est ainsi qu'une petite carte impayée devient grosse.",
        "La leçon, c'est le sens. Mettez les intérêts composés de votre côté — commencez tôt, réinvestissez, laissez l'épargne croître — et stoppez-les contre vous en soldant d'abord la dette qui se compose. bynku capitalise un rendement supposé dans ses projections et reconstruit l'intérêt réel d'un prêt, pour que les deux faces apparaissent dans vos chiffres.",
      ],
    ),
    bullets: L(
      [
        { label: "Growth earns growth", body: "Returns are added to the base, then earn returns too — the effect accelerates over time." },
        { label: "Rule of 72", body: "72 ÷ rate ≈ years to double. A quick gut-check for any rate, working for you or against." },
        { label: "Time is the multiplier", body: "Small amounts compounding for long beat large amounts compounding for a short while." },
        { label: "It cuts both ways", body: "The same force that grows savings grows debt. Direction is everything." },
      ],
      [
        { label: "Crescimento gera crescimento", body: "Os retornos somam-se à base e passam a render — o efeito acelera com o tempo." },
        { label: "Regra dos 72", body: "72 ÷ taxa ≈ anos para duplicar. Um teste rápido para qualquer taxa, a favor ou contra." },
        { label: "O tempo é o multiplicador", body: "Valores pequenos a compor muito tempo batem valores grandes a compor pouco." },
        { label: "Corta para os dois lados", body: "A mesma força que faz crescer a poupança faz crescer a dívida. A direção é tudo." },
      ],
      [
        { label: "El crecimiento genera crecimiento", body: "Los retornos se suman a la base y pasan a rentar — el efecto acelera con el tiempo." },
        { label: "Regla del 72", body: "72 ÷ tipo ≈ años para duplicar. Un test rápido para cualquier tipo, a favor o en contra." },
        { label: "El tiempo es el multiplicador", body: "Cantidades pequeñas componiendo mucho baten a grandes componiendo poco." },
        { label: "Corta por ambos lados", body: "La misma fuerza que hace crecer el ahorro hace crecer la deuda. La dirección lo es todo." },
      ],
      [
        { label: "Wachstum bringt Wachstum", body: "Erträge kommen zur Basis und verdienen dann selbst — der Effekt beschleunigt sich mit der Zeit." },
        { label: "72er-Regel", body: "72 ÷ Zins ≈ Jahre zum Verdoppeln. Ein schneller Check für jeden Zins, für oder gegen dich." },
        { label: "Zeit ist der Multiplikator", body: "Kleine Beträge, lange verzinst, schlagen große, kurz verzinst." },
        { label: "Es schneidet beidseitig", body: "Dieselbe Kraft lässt Ersparnis und Schuld wachsen. Die Richtung ist alles." },
      ],
      [
        { label: "La croissance nourrit la croissance", body: "Les rendements s'ajoutent à la base puis rapportent — l'effet s'accélère avec le temps." },
        { label: "Règle de 72", body: "72 ÷ taux ≈ années pour doubler. Un test éclair pour tout taux, pour ou contre vous." },
        { label: "Le temps est le multiplicateur", body: "De petits montants capitalisés longtemps battent de gros capitalisés peu." },
        { label: "Ça coupe des deux côtés", body: "La force qui fait croître l'épargne fait croître la dette. Le sens fait tout." },
      ],
    ),
    callout: L(
      "Compounding rewards patience and punishes procrastination. The best day to start was years ago; the second best is today.",
      "O juro composto premeia a paciência e castiga o adiamento. O melhor dia para começar foi há anos; o segundo melhor é hoje.",
      "El interés compuesto premia la paciencia y castiga la demora. El mejor día para empezar fue hace años; el segundo mejor es hoy.",
      "Zinseszins belohnt Geduld und bestraft Aufschieben. Der beste Tag zum Start war vor Jahren; der zweitbeste ist heute.",
      "Les intérêts composés récompensent la patience et punissent la procrastination. Le meilleur jour pour commencer était il y a des années ; le deuxième, c'est aujourd'hui.",
    ),
    businessNote: L(
      "For a business, retained profit reinvested at a good return compounds the value of the whole company — that is how enterprises grow. The mirror risk is revolving credit and overdrafts, where compounding interest quietly eats operating margin. bynku's loan tools surface that true cost; the finance statements show reinvested surplus building equity over time.",
      "Numa empresa, o lucro retido reinvestido a um bom retorno compõe o valor de toda a empresa — é assim que os negócios crescem. O risco espelhado é o crédito rotativo e os descobertos, onde o juro composto come em silêncio a margem operacional. As ferramentas de crédito do bynku mostram esse custo real; as demonstrações financeiras mostram o excedente reinvestido a construir capital próprio ao longo do tempo.",
      "En una empresa, el beneficio retenido reinvertido a un buen retorno compone el valor de toda la compañía — así crecen los negocios. El riesgo espejo es el crédito revolving y los descubiertos, donde el interés compuesto come en silencio el margen operativo. Las herramientas de préstamo de bynku muestran ese coste real; los estados financieros muestran el excedente reinvertido construyendo patrimonio con el tiempo.",
      "Für ein Unternehmen verzinst reinvestierter Gewinn bei guter Rendite den Wert der ganzen Firma — so wachsen Unternehmen. Das Spiegelrisiko sind revolvierende Kredite und Dispo, wo Zinseszins leise die operative Marge frisst. bynkus Kredit-Tools zeigen diese echten Kosten; die Finanzberichte zeigen, wie reinvestierter Überschuss über die Zeit Eigenkapital aufbaut.",
      "Pour une entreprise, le bénéfice réinvesti à bon rendement capitalise la valeur de toute la société — c'est ainsi qu'on grandit. Le risque miroir est le crédit renouvelable et les découverts, où l'intérêt composé ronge en silence la marge d'exploitation. Les outils de prêt de bynku exposent ce coût réel ; les états financiers montrent l'excédent réinvesti bâtir des capitaux propres au fil du temps.",
    ),
  },

  // ------------------------------------------------------------ inflation
  {
    id: "inflation",
    icon: "BarChart3",
    title: L(
      "Inflation and real returns",
      "Inflação e retornos reais",
      "Inflación y retornos reales",
      "Inflation und reale Renditen",
      "Inflation et rendements réels",
    ),
    paragraphs: L(
      [
        "Inflation is the slow rise in prices that means the same money buys a little less each year. It's why a coffee costs more than it did a decade ago — and why money left completely still doesn't stay still in value. It quietly shrinks.",
        "This splits every return into two numbers. The nominal return is the headline (an account paying 1%); the real return subtracts inflation (with 3% inflation, that 1% account is really losing about 2% a year in buying power). 'Safe' and 'keeping up' are not the same thing — beating inflation usually needs some growth, not just a locked box.",
        "You can't control inflation, but you can see it and plan around it. bynku shows the current inflation rate in its market snapshot and uprates its spending benchmarks so comparisons stay fair over time — a reminder that the goalposts move, and a plan should move with them.",
      ],
      [
        "A inflação é a subida lenta dos preços que faz o mesmo dinheiro comprar um pouco menos a cada ano. É por isso que um café custa mais do que há uma década — e porque o dinheiro deixado totalmente parado não fica parado em valor. Encolhe em silêncio.",
        "Isto divide cada retorno em dois números. O retorno nominal é o anunciado (uma conta a 1%); o retorno real subtrai a inflação (com 3% de inflação, essa conta a 1% está mesmo a perder cerca de 2% ao ano em poder de compra). 'Seguro' e 'acompanhar' não são a mesma coisa — bater a inflação costuma exigir algum crescimento, não só uma caixa fechada.",
        "Não controlas a inflação, mas podes vê-la e planear com ela. O bynku mostra a taxa de inflação atual no panorama de mercado e atualiza as referências de gasto para as comparações se manterem justas ao longo do tempo — um lembrete de que a meta se move, e o plano deve mover-se com ela.",
      ],
      [
        "La inflación es la subida lenta de precios que hace que el mismo dinero compre un poco menos cada año. Por eso un café cuesta más que hace una década — y por eso el dinero dejado totalmente quieto no se queda quieto en valor. Encoge en silencio.",
        "Esto divide cada retorno en dos números. El retorno nominal es el anunciado (una cuenta al 1%); el real resta la inflación (con 3% de inflación, esa cuenta al 1% pierde de verdad un 2% anual de poder de compra). 'Seguro' y 'seguir el ritmo' no son lo mismo — batir la inflación suele necesitar algo de crecimiento, no una caja cerrada.",
        "No controlas la inflación, pero puedes verla y planificar con ella. bynku muestra la tasa de inflación actual en el panorama de mercado y actualiza sus referencias de gasto para que las comparaciones sigan siendo justas — un recordatorio de que la meta se mueve, y el plan debe moverse con ella.",
      ],
      [
        "Inflation ist der langsame Preisanstieg, der bedeutet, dass dasselbe Geld jedes Jahr etwas weniger kauft. Deshalb kostet ein Kaffee mehr als vor zehn Jahren — und deshalb bleibt völlig ruhendes Geld nicht ruhig im Wert. Es schrumpft leise.",
        "Das teilt jede Rendite in zwei Zahlen. Die nominale Rendite ist die Schlagzeile (ein Konto zu 1%); die reale Rendite zieht die Inflation ab (bei 3% Inflation verliert dieses 1%-Konto real etwa 2% Kaufkraft pro Jahr). 'Sicher' und 'Schritt halten' sind nicht dasselbe — die Inflation zu schlagen braucht meist etwas Wachstum, keine verschlossene Kiste.",
        "Inflation lässt sich nicht steuern, aber sehen und einplanen. bynku zeigt die aktuelle Inflationsrate im Marktüberblick und schreibt seine Ausgaben-Benchmarks fort, damit Vergleiche über die Zeit fair bleiben — eine Erinnerung, dass sich die Ziellinie bewegt und der Plan mit ihr.",
      ],
      [
        "L'inflation est la hausse lente des prix qui fait que le même argent achète un peu moins chaque année. C'est pourquoi un café coûte plus qu'il y a dix ans — et pourquoi l'argent laissé totalement immobile ne reste pas immobile en valeur. Il rétrécit en silence.",
        "Cela scinde chaque rendement en deux chiffres. Le rendement nominal est l'affiché (un compte à 1%) ; le réel retranche l'inflation (avec 3% d'inflation, ce compte à 1% perd en fait environ 2% de pouvoir d'achat par an). « Sûr » et « suivre le rythme » ne sont pas la même chose — battre l'inflation demande d'habitude un peu de croissance, pas une boîte fermée.",
        "On ne contrôle pas l'inflation, mais on peut la voir et composer avec. bynku affiche le taux d'inflation courant dans son panorama de marché et réévalue ses repères de dépense pour que les comparaisons restent justes dans le temps — un rappel que la cible bouge, et que le plan doit bouger avec.",
      ],
    ),
    bullets: L(
      [
        { label: "Prices drift up", body: "The same money buys a little less each year — a small percentage that compounds." },
        { label: "Nominal vs real", body: "Real return = nominal return − inflation. That's the number that changes your buying power." },
        { label: "Idle cash shrinks", body: "Money earning less than inflation loses value while sitting perfectly still." },
        { label: "Plan in real terms", body: "A goal years away costs more by then; some growth is just standing still." },
      ],
      [
        { label: "Os preços sobem", body: "O mesmo dinheiro compra um pouco menos a cada ano — uma pequena percentagem que compõe." },
        { label: "Nominal vs real", body: "Retorno real = retorno nominal − inflação. É o número que muda o teu poder de compra." },
        { label: "Dinheiro parado encolhe", body: "Dinheiro a render menos que a inflação perde valor totalmente parado." },
        { label: "Planeia em termos reais", body: "Um objetivo a anos custa mais nessa altura; algum crescimento é só ficar na mesma." },
      ],
      [
        { label: "Los precios suben", body: "El mismo dinero compra un poco menos cada año — un pequeño porcentaje que compone." },
        { label: "Nominal vs real", body: "Retorno real = retorno nominal − inflación. Ese es el número que cambia tu poder de compra." },
        { label: "El efectivo parado encoge", body: "El dinero que renta menos que la inflación pierde valor totalmente quieto." },
        { label: "Planifica en términos reales", body: "Una meta a años cuesta más para entonces; algo de crecimiento es solo no perder." },
      ],
      [
        { label: "Preise steigen", body: "Dasselbe Geld kauft jedes Jahr etwas weniger — ein kleiner Prozentsatz, der sich verzinst." },
        { label: "Nominal vs real", body: "Reale Rendite = nominale Rendite − Inflation. Diese Zahl ändert deine Kaufkraft." },
        { label: "Ruhendes Geld schrumpft", body: "Geld, das weniger als die Inflation bringt, verliert völlig ruhend an Wert." },
        { label: "In realen Größen planen", body: "Ein Ziel in Jahren kostet dann mehr; etwas Wachstum ist nur Stehenbleiben." },
      ],
      [
        { label: "Les prix montent", body: "Le même argent achète un peu moins chaque année — un petit pourcentage qui se compose." },
        { label: "Nominal vs réel", body: "Rendement réel = nominal − inflation. C'est le chiffre qui change votre pouvoir d'achat." },
        { label: "Le cash dormant rétrécit", body: "L'argent qui rapporte moins que l'inflation perd de la valeur en restant immobile." },
        { label: "Planifier en termes réels", body: "Un objectif à des années coûte plus d'ici là ; un peu de croissance, c'est juste ne pas reculer." },
      ],
    ),
    callout: L(
      "Inflation is the tax nobody votes for. You can't avoid it, but you can stop pretending nominal numbers tell the whole story.",
      "A inflação é o imposto que ninguém vota. Não a podes evitar, mas podes deixar de fingir que os números nominais contam a história toda.",
      "La inflación es el impuesto que nadie vota. No puedes evitarla, pero puedes dejar de fingir que los números nominales cuentan toda la historia.",
      "Inflation ist die Steuer, die niemand wählt. Vermeiden kannst du sie nicht, aber aufhören, so zu tun, als sagten nominale Zahlen die ganze Wahrheit.",
      "L'inflation est l'impôt que personne ne vote. On ne l'évite pas, mais on peut cesser de croire que les chiffres nominaux disent tout.",
    ),
    businessNote: L(
      "For a company, input-cost inflation erodes margin unless prices keep pace — repricing is a real management decision, not a courtesy. Cash reserves held for safety also lose real value the longer they sit, which is the trade-off behind holding runway versus deploying capital.",
      "Numa empresa, a inflação dos custos corrói a margem a menos que os preços acompanhem — rever preços é uma decisão de gestão, não uma cortesia. As reservas de caixa guardadas por segurança também perdem valor real quanto mais tempo ficam, e é esse o dilema entre manter autonomia e aplicar capital.",
      "En una empresa, la inflación de costes erosiona el margen salvo que los precios sigan el ritmo — repreciar es una decisión de gestión, no una cortesía. Las reservas de caja por seguridad también pierden valor real cuanto más quietas, y ese es el dilema entre mantener autonomía y desplegar capital.",
      "Für ein Unternehmen frisst Kosteninflation die Marge, wenn die Preise nicht mithalten — Neupreisung ist eine Managemententscheidung, keine Höflichkeit. Als Sicherheit gehaltene Barreserven verlieren real an Wert, je länger sie liegen — der Zielkonflikt zwischen Reichweite halten und Kapital einsetzen.",
      "Pour une entreprise, l'inflation des coûts érode la marge sauf si les prix suivent — reprézer est une décision de gestion, pas une politesse. Les réserves de trésorerie de sécurité perdent aussi de la valeur réelle en dormant, d'où l'arbitrage entre garder de l'autonomie et déployer le capital.",
    ),
  },

  // ------------------------------------------------------------ risk & return
  {
    id: "riskReturn",
    icon: "ShieldCheck",
    title: L(
      "Risk, return and diversification",
      "Risco, retorno e diversificação",
      "Riesgo, retorno y diversificación",
      "Risiko, Rendite und Streuung",
      "Risque, rendement et diversification",
    ),
    paragraphs: L(
      [
        "Higher expected return almost always comes with higher risk — the chance the result is worse, or more volatile, than hoped. There is no reliable high return with no risk; anything advertised that way deserves suspicion. The skill isn't avoiding risk, it's taking the right amount for your time horizon.",
        "Diversification is the closest thing to a free lunch in finance: spreading money across several unrelated things reduces the damage any one can do, without giving up much expected return. One holding, one client, one bet — all are concentration, and concentration is fragility.",
        "Risk also needs time. Money you'll need soon should sit somewhere safe and reachable; only money you can leave for years belongs anywhere volatile. bynku keeps that separation concrete — the emergency reserve stays liquid and apart from anything invested — and its comparisons show where you stand rather than promising an outcome.",
      ],
      [
        "Um retorno esperado mais alto vem quase sempre com mais risco — a hipótese de o resultado ser pior, ou mais volátil, do que se esperava. Não existe retorno alto e fiável sem risco; o que for anunciado assim merece desconfiança. A arte não é evitar o risco, é assumir a dose certa para o teu horizonte.",
        "A diversificação é o mais próximo de um almoço grátis nas finanças: espalhar o dinheiro por várias coisas não relacionadas reduz o estrago que qualquer uma pode fazer, sem abdicar de muito retorno esperado. Uma posição, um cliente, uma aposta — tudo é concentração, e concentração é fragilidade.",
        "O risco também precisa de tempo. Dinheiro de que vais precisar em breve deve estar num sítio seguro e acessível; só o dinheiro que podes deixar anos pertence a algo volátil. O bynku mantém essa separação concreta — a reserva de emergência fica líquida e à parte do que está investido — e as comparações mostram onde estás em vez de prometer um resultado.",
      ],
      [
        "Un retorno esperado más alto casi siempre viene con más riesgo — la posibilidad de que el resultado sea peor, o más volátil, de lo esperado. No existe un retorno alto y fiable sin riesgo; lo que se anuncia así merece sospecha. El arte no es evitar el riesgo, es tomar la dosis correcta para tu horizonte.",
        "La diversificación es lo más parecido a un almuerzo gratis en finanzas: repartir el dinero entre varias cosas no relacionadas reduce el daño que cualquiera puede hacer, sin renunciar a mucho retorno esperado. Una posición, un cliente, una apuesta — todo es concentración, y la concentración es fragilidad.",
        "El riesgo también necesita tiempo. El dinero que vas a necesitar pronto debe estar en un sitio seguro y accesible; solo el que puedes dejar años pertenece a algo volátil. bynku mantiene esa separación concreta — la reserva de emergencia sigue líquida y aparte de lo invertido — y sus comparaciones muestran dónde estás en vez de prometer un resultado.",
      ],
      [
        "Höhere erwartete Rendite kommt fast immer mit höherem Risiko — der Chance, dass das Ergebnis schlechter oder schwankender ausfällt als erhofft. Es gibt keine verlässlich hohe Rendite ohne Risiko; was so beworben wird, verdient Misstrauen. Die Kunst ist nicht, Risiko zu meiden, sondern das richtige Maß für deinen Horizont zu nehmen.",
        "Streuung ist das Nächste zu einem Gratis-Mittagessen in der Finanz: Geld auf mehrere unverbundene Dinge zu verteilen mindert den Schaden, den eines anrichten kann, ohne viel erwartete Rendite aufzugeben. Eine Position, ein Kunde, eine Wette — alles ist Konzentration, und Konzentration ist Fragilität.",
        "Risiko braucht auch Zeit. Geld, das du bald brauchst, gehört an einen sicheren, erreichbaren Ort; nur Geld, das du Jahre liegen lassen kannst, gehört ins Volatile. bynku hält diese Trennung konkret — die Notreserve bleibt liquide und getrennt vom Investierten — und seine Vergleiche zeigen, wo du stehst, statt ein Ergebnis zu versprechen.",
      ],
      [
        "Un rendement attendu plus élevé s'accompagne presque toujours d'un risque plus grand — la possibilité que le résultat soit pire, ou plus volatil, qu'espéré. Il n'existe pas de rendement élevé et fiable sans risque ; ce qui est présenté ainsi mérite la méfiance. L'art n'est pas d'éviter le risque, mais d'en prendre la juste dose pour votre horizon.",
        "La diversification est ce qui ressemble le plus à un repas gratuit en finance : répartir l'argent sur plusieurs choses non liées réduit le dégât que l'une peut causer, sans sacrifier beaucoup de rendement attendu. Une position, un client, un pari — tout est concentration, et la concentration est fragilité.",
        "Le risque a aussi besoin de temps. L'argent dont vous aurez besoin bientôt doit être en lieu sûr et accessible ; seul l'argent qu'on peut laisser des années a sa place dans le volatil. bynku garde cette séparation concrète — la réserve d'urgence reste liquide et à part de l'investi — et ses comparaisons montrent où vous en êtes plutôt que de promettre un résultat.",
      ],
    ),
    bullets: L(
      [
        { label: "No free lunch", body: "Reliable high return with no risk doesn't exist. Be wary of anyone who says otherwise." },
        { label: "Match risk to time", body: "Soon-money stays safe; only long-horizon money belongs in volatile places." },
        { label: "Don't concentrate", body: "One holding, one client, one bet is fragile. Spreading out cuts the downside." },
        { label: "Keep the net untouched", body: "The emergency fund is not an investment. It stays safe, liquid and separate." },
      ],
      [
        { label: "Não há almoços grátis", body: "Retorno alto e fiável sem risco não existe. Desconfia de quem disser o contrário." },
        { label: "Ajusta o risco ao tempo", body: "O dinheiro de curto prazo fica seguro; só o de longo prazo pertence ao volátil." },
        { label: "Não concentres", body: "Uma posição, um cliente, uma aposta é frágil. Espalhar reduz a queda." },
        { label: "Não toques na rede", body: "O fundo de emergência não é um investimento. Fica seguro, líquido e à parte." },
      ],
      [
        { label: "No hay almuerzos gratis", body: "Un retorno alto y fiable sin riesgo no existe. Desconfía de quien diga lo contrario." },
        { label: "Ajusta el riesgo al tiempo", body: "El dinero a corto plazo se queda seguro; solo el de largo plazo pertenece a lo volátil." },
        { label: "No concentres", body: "Una posición, un cliente, una apuesta es frágil. Repartir reduce la caída." },
        { label: "No toques la red", body: "El fondo de emergencia no es una inversión. Se queda seguro, líquido y aparte." },
      ],
      [
        { label: "Kein Gratis-Mittagessen", body: "Verlässlich hohe Rendite ohne Risiko gibt es nicht. Sei vorsichtig, wer das behauptet." },
        { label: "Risiko an Zeit anpassen", body: "Kurzfristiges Geld bleibt sicher; nur Langfristiges gehört ins Volatile." },
        { label: "Nicht konzentrieren", body: "Eine Position, ein Kunde, eine Wette ist fragil. Streuen senkt das Verlustrisiko." },
        { label: "Den Notgroschen unberührt lassen", body: "Der Notfallfonds ist keine Anlage. Er bleibt sicher, liquide und getrennt." },
      ],
      [
        { label: "Pas de repas gratuit", body: "Un rendement élevé et fiable sans risque n'existe pas. Méfiez-vous de qui dit le contraire." },
        { label: "Adapter le risque au temps", body: "L'argent à court terme reste sûr ; seul le long terme a sa place dans le volatil." },
        { label: "Ne pas concentrer", body: "Une position, un client, un pari est fragile. Répartir réduit la perte." },
        { label: "Ne pas toucher au matelas", body: "Le fonds d'urgence n'est pas un placement. Il reste sûr, liquide et à part." },
      ],
    ),
    callout: L(
      "You're not paid for taking risk — you're paid for taking risk you understand and can afford to hold. The rest is gambling.",
      "Não és pago por correr risco — és pago por correr risco que percebes e podes suportar. O resto é jogo.",
      "No te pagan por asumir riesgo — te pagan por asumir riesgo que entiendes y puedes sostener. El resto es apostar.",
      "Du wirst nicht fürs Risiko bezahlt — sondern für Risiko, das du verstehst und tragen kannst. Der Rest ist Glücksspiel.",
      "On n'est pas payé pour prendre du risque — mais pour prendre un risque qu'on comprend et qu'on peut tenir. Le reste est du jeu.",
    ),
    businessNote: L(
      "For a business, concentration risk is usually revenue: leaning on one client or one product is the classic fragility. bynku's snapshot rewards diversified income, and 'How you compare' shows your spread against your sector — the corporate version of not putting every egg in one basket.",
      "Numa empresa, o risco de concentração é normalmente a receita: depender de um cliente ou de um produto é a fragilidade clássica. O snapshot do bynku premeia receita diversificada, e o 'Como me comparo' mostra a tua dispersão face ao setor — a versão corporativa de não pôr todos os ovos no mesmo cesto.",
      "En una empresa, el riesgo de concentración suele ser el ingreso: depender de un cliente o un producto es la fragilidad clásica. El snapshot de bynku premia el ingreso diversificado, y 'Cómo me comparo' muestra tu dispersión frente al sector — la versión corporativa de no poner todos los huevos en la misma cesta.",
      "Für ein Unternehmen ist Konzentrationsrisiko meist der Umsatz: sich auf einen Kunden oder ein Produkt zu stützen ist die klassische Fragilität. bynkus Snapshot belohnt diversifizierte Einnahmen, und 'Wie ich abschneide' zeigt deine Streuung gegenüber der Branche — die Unternehmensversion davon, nicht alle Eier in einen Korb zu legen.",
      "Pour une entreprise, le risque de concentration est souvent le revenu : dépendre d'un client ou d'un produit est la fragilité classique. Le snapshot de bynku récompense un revenu diversifié, et « Comment je me situe » montre votre dispersion face au secteur — la version corporate de ne pas mettre tous ses œufs dans le même panier.",
    ),
  },

  // ------------------------------------------------------------ position
  {
    id: "position",
    icon: "Wallet",
    audience: "personal",
    title: L(
      "Your financial position, simplified",
      "A tua posição financeira, simplificada",
      "Tu posición financiera, en simple",
      "Deine Finanzlage, einfach erklärt",
      "Votre situation financière, en clair",
    ),
    paragraphs: L(
      [
        "Your financial position is a handful of moving parts: what comes in (income), what goes out (costs — fixed, estimated, real and planned), what you owe (debt and loans), what you own (assets), and what you set aside (saving and investment projects). bynku holds all of them in one place, so you see the whole picture, not just this month's bank balance.",
        "They only make sense together. Income pays your costs and funds your projects; what's left after costs and debt is your surplus, the raw material for everything else. Debt quietly drains it through interest. Assets are what you've built. Projects turn surplus into a safety net and goals. Move one and the others move: clear a loan and surplus jumps; buy a car and cash becomes an asset. bynku does that arithmetic for you.",
        "Not deciding is itself a decision. Money you don't direct doesn't wait politely: it gets spent, sits idle losing value to inflation, or a debt keeps charging interest month after month. bynku's job is to make the easy default a good one, showing what's safe to spend, what's coming, and nudging the small choices so you don't carry it all in your head.",
        "You don't need to be an expert, just a clear picture and a sensible order to build in. The layers below are the order the coach follows; the rest of this guide shows the tool for each step.",
      ],
      [
        "A tua posição financeira são algumas peças em movimento: o que entra (rendimento), o que sai (custos — fixos, estimados, reais e planeados), o que deves (dívidas e créditos), o que tens (ativos) e o que pões de lado (projetos de poupança e investimento). O bynku junta tudo num só sítio, para veres o quadro completo e não só o saldo deste mês.",
        "Só fazem sentido em conjunto. O rendimento paga os custos e financia os projetos; o que sobra depois de custos e dívida é o teu excedente, a matéria-prima de tudo o resto. A dívida vai-o drenando através de juros. Os ativos são o que construíste. Os projetos transformam o excedente em rede de segurança e objetivos. Mexe numa peça e as outras mexem: paga um crédito e o excedente sobe; compra um carro e o dinheiro vira ativo. O bynku faz essa conta por ti.",
        "Não decidir é, em si, uma decisão. O dinheiro que não diriges não espera educadamente: é gasto, fica parado a perder valor com a inflação, ou uma dívida continua a cobrar juros mês após mês. O papel do bynku é tornar boa a opção fácil, mostrando o que é seguro gastar, o que aí vem, e sugerindo as pequenas escolhas para não teres de guardar tudo na cabeça.",
        "Não precisas de ser especialista, só de um quadro claro e de uma ordem sensata para construir. As camadas abaixo são a ordem que o coach segue; o resto deste guia mostra a ferramenta de cada passo.",
      ],
      [
        "Tu posición financiera son unas cuantas piezas en movimiento: lo que entra (ingresos), lo que sale (costes — fijos, estimados, reales y planificados), lo que debes (deudas y préstamos), lo que tienes (activos) y lo que apartas (proyectos de ahorro e inversión). bynku lo reúne todo en un sitio, para que veas el cuadro completo y no solo el saldo de este mes.",
        "Solo tienen sentido juntas. Los ingresos pagan tus costes y financian tus proyectos; lo que queda tras costes y deuda es tu excedente, la materia prima de todo lo demás. La deuda lo drena en silencio con los intereses. Los activos son lo que has construido. Los proyectos convierten el excedente en colchón y objetivos. Mueve una pieza y las demás se mueven: salda un préstamo y el excedente sube; compra un coche y el dinero se vuelve activo. bynku hace esa cuenta por ti.",
        "No decidir es, en sí, una decisión. El dinero que no diriges no espera con paciencia: se gasta, se queda parado perdiendo valor por la inflación, o una deuda sigue cobrando intereses mes tras mes. La función de bynku es hacer buena la opción fácil, mostrando lo seguro para gastar, lo que viene, y sugiriendo las pequeñas decisiones para que no lo lleves todo en la cabeza.",
        "No necesitas ser experto, solo un cuadro claro y un orden sensato para construir. Las capas de abajo son el orden que sigue el asistente; el resto de esta guía muestra la herramienta de cada paso.",
      ],
      [
        "Deine Finanzlage besteht aus wenigen beweglichen Teilen: was reinkommt (Einkommen), was rausgeht (Kosten — fix, geschätzt, real und geplant), was du schuldest (Schulden und Kredite), was du besitzt (Vermögen) und was du zurücklegst (Spar- und Investitionsprojekte). bynku bündelt alles an einem Ort, damit du das ganze Bild siehst, nicht nur den Kontostand dieses Monats.",
        "Sie ergeben nur zusammen Sinn. Einkommen zahlt Kosten und finanziert Projekte; was nach Kosten und Schulden bleibt, ist dein Überschuss, der Rohstoff für alles Weitere. Schulden zehren ihn still über Zinsen. Vermögen ist, was du aufgebaut hast. Projekte machen aus Überschuss einen Notgroschen und Ziele. Bewegt sich eins, bewegen sich die anderen: tilgst du einen Kredit, springt der Überschuss; kaufst du ein Auto, wird Geld zu Vermögen. bynku rechnet das für dich.",
        "Nicht zu entscheiden ist selbst eine Entscheidung. Geld, das du nicht lenkst, wartet nicht höflich: es wird ausgegeben, liegt brach und verliert durch Inflation an Wert, oder eine Schuld kostet Monat für Monat Zinsen. bynkus Aufgabe ist, die bequeme Standardwahl zu einer guten zu machen, indem es zeigt, was sicher ausgegeben werden kann, was kommt, und die kleinen Entscheidungen anstößt, damit du nicht alles im Kopf behalten musst.",
        "Du musst kein Experte sein, nur ein klares Bild und eine sinnvolle Reihenfolge zum Aufbauen. Die Stufen unten sind die Reihenfolge, der der Coach folgt; der Rest dieses Leitfadens zeigt das Werkzeug für jeden Schritt.",
      ],
      [
        "Votre situation financière tient en quelques pièces mobiles : ce qui entre (revenus), ce qui sort (coûts — fixes, estimés, réels et prévus), ce que vous devez (dettes et prêts), ce que vous possédez (actifs) et ce que vous mettez de côté (projets d'épargne et d'investissement). bynku réunit tout au même endroit, pour voir l'ensemble et pas seulement le solde du mois.",
        "Elles n'ont de sens qu'ensemble. Les revenus paient vos coûts et financent vos projets ; ce qui reste après coûts et dette est votre excédent, la matière première du reste. La dette le grignote en silence via les intérêts. Les actifs sont ce que vous avez bâti. Les projets transforment l'excédent en matelas et en objectifs. Bougez une pièce et les autres bougent : soldez un prêt et l'excédent grimpe ; achetez une voiture et l'argent devient un actif. bynku fait ce calcul pour vous.",
        "Ne pas décider est en soi une décision. L'argent que vous ne dirigez pas n'attend pas poliment : il se dépense, dort en perdant de la valeur avec l'inflation, ou une dette continue de facturer des intérêts mois après mois. Le rôle de bynku est de rendre le choix facile bon par défaut, en montrant ce qu'il est prudent de dépenser, ce qui arrive, et en suggérant les petites décisions pour ne pas tout garder en tête.",
        "Pas besoin d'être expert, juste une image claire et un ordre sensé pour construire. Les couches ci-dessous sont l'ordre que suit le coach ; le reste de ce guide montre l'outil de chaque étape.",
      ],
    ),
    bullets: L(
      [
        { label: "1. Emergency fund — about 3 cycles of essentials", body: "Your first cushion: roughly three cycles' worth of the money you truly need (rent, food, bills). It turns an emergency from a crisis into an inconvenience. Tag a project as your Emergency fund and the coach protects it and counts it first." },
        { label: "2. Safety net — 6 to 9 months of take-home income", body: "Beyond the emergency fund, aim for a fuller reserve of roughly six to nine times your monthly household take-home. It's what lets you weather a job loss or a big shock without touching investments or borrowing." },
        { label: "3. Tackle debt actively — anticipate and negotiate", body: "Don't just service debt; assess it every cycle. Paying early is often a risk-free, high-return move: overpaying a 12% loan is a guaranteed 12% return, better than almost any savings account. Example: €5,000 off a 12% loan saves about €600 of interest a year, every year until it's gone. A quick call to renegotiate a rate can be worth thousands. bynku shows each debt's rate, payoff date and the effect of overpaying." },
        { label: "4. Invest what's left over", body: "Once the reserves are built and expensive debt is gone, idle surplus should work for you. bynku is not a broker and won't tell you which securities to buy — but by giving you the safety, the tools and the know-how, it helps you invest from a position of strength instead of fear." },
        { label: "5. Assets, liquidity and net worth", body: "Assets are the real value you hold — a home, a car, investments, a business. Net worth (what you own minus what you owe) is the truest scoreboard. Liquidity matters too: how fast an asset becomes cash. And it interconnects — an asset can produce income (rent), a project can become an asset (a house deposit), and income funds both. bynku tracks assets and net worth so the big picture stays visible." },
      ],
      [
        { label: "1. Fundo de emergência — cerca de 3 ciclos de essenciais", body: "A tua primeira almofada: cerca de três ciclos do dinheiro de que precisas mesmo (renda, comida, contas). Transforma uma emergência de crise em incómodo. Marca um projeto como Fundo de emergência e o coach protege-o e conta-o primeiro." },
        { label: "2. Rede de segurança — 6 a 9 meses do rendimento líquido", body: "Além do fundo de emergência, procura uma reserva mais completa de cerca de seis a nove vezes o rendimento líquido mensal do agregado. É o que te permite aguentar a perda de emprego ou um grande choque sem tocar em investimentos nem pedir crédito." },
        { label: "3. Gere a dívida ativamente — antecipa e negoceia", body: "Não te limites a pagar a dívida; avalia-a a cada ciclo. Antecipar é muitas vezes risco zero e alto retorno: amortizar um crédito a 12% é um retorno garantido de 12%, melhor que quase qualquer conta poupança. Exemplo: 5.000€ a menos num crédito a 12% poupam cerca de 600€ de juros por ano, todos os anos até acabar. Um telefonema para renegociar a taxa pode valer milhares. O bynku mostra a taxa, a data de fim e o efeito de amortizar de cada dívida." },
        { label: "4. Investe o que sobra", body: "Feitas as reservas e paga a dívida cara, o excedente parado deve trabalhar por ti. O bynku não é corretora e não te diz que títulos comprar — mas, dando-te a segurança, as ferramentas e o conhecimento, ajuda-te a investir a partir de uma posição de força, não de medo." },
        { label: "5. Ativos, liquidez e património", body: "Os ativos são o valor real que tens — casa, carro, investimentos, um negócio. O património líquido (o que tens menos o que deves) é o placar mais verdadeiro. A liquidez também conta: a rapidez com que um ativo vira dinheiro. E tudo se interliga — um ativo pode gerar rendimento (renda), um projeto pode virar ativo (entrada de uma casa) e o rendimento financia ambos. O bynku acompanha ativos e património para o quadro geral estar sempre à vista." },
      ],
      [
        { label: "1. Fondo de emergencia — unos 3 ciclos de esenciales", body: "Tu primer colchón: unos tres ciclos del dinero que de verdad necesitas (alquiler, comida, facturas). Convierte una emergencia de crisis en molestia. Marca un proyecto como Fondo de emergencia y el asistente lo protege y lo cuenta primero." },
        { label: "2. Red de seguridad — 6 a 9 meses de ingreso neto", body: "Más allá del fondo de emergencia, busca una reserva más amplia de unas seis a nueve veces el ingreso neto mensual del hogar. Es lo que te permite aguantar un despido o un gran golpe sin tocar inversiones ni endeudarte." },
        { label: "3. Gestiona la deuda activamente — anticipa y negocia", body: "No te limites a pagar la deuda; evalúala cada ciclo. Anticipar suele ser riesgo cero y alto retorno: amortizar un préstamo al 12% es un retorno garantizado del 12%, mejor que casi cualquier cuenta de ahorro. Ejemplo: 5.000€ menos en un préstamo al 12% ahorran unos 600€ de intereses al año, cada año hasta saldarlo. Una llamada para renegociar el tipo puede valer miles. bynku muestra el tipo, la fecha de fin y el efecto de amortizar de cada deuda." },
        { label: "4. Invierte lo que sobra", body: "Hechas las reservas y fuera la deuda cara, el excedente parado debe trabajar para ti. bynku no es un bróker y no te dice qué valores comprar — pero, al darte la seguridad, las herramientas y el conocimiento, te ayuda a invertir desde una posición de fuerza, no de miedo." },
        { label: "5. Activos, liquidez y patrimonio", body: "Los activos son el valor real que tienes — casa, coche, inversiones, un negocio. El patrimonio neto (lo que tienes menos lo que debes) es el marcador más veraz. La liquidez también importa: la rapidez con que un activo se vuelve dinero. Y todo se interconecta — un activo puede generar ingresos (alquiler), un proyecto puede volverse activo (la entrada de una casa) y el ingreso financia ambos. bynku sigue activos y patrimonio para que el cuadro general esté siempre a la vista." },
      ],
      [
        { label: "1. Notgroschen — etwa 3 Zyklen an Essenzausgaben", body: "Dein erstes Polster: rund drei Zyklen des Geldes, das du wirklich brauchst (Miete, Essen, Rechnungen). Es macht aus einem Notfall statt einer Krise eine Unannehmlichkeit. Markiere ein Projekt als Notgroschen, und der Coach schützt und zählt es zuerst." },
        { label: "2. Sicherheitsnetz — 6 bis 9 Monate Nettoeinkommen", body: "Über den Notgroschen hinaus ziele auf eine vollere Reserve von etwa sechs bis neun Mal dem monatlichen Haushalts-Nettoeinkommen. Sie lässt dich einen Jobverlust oder großen Schock überstehen, ohne Investitionen anzutasten oder Kredite aufzunehmen." },
        { label: "3. Schulden aktiv angehen — vorziehen und verhandeln", body: "Bediene Schulden nicht nur, bewerte sie jeden Zyklus. Vorzeitig zu tilgen ist oft risikofrei und ertragreich: einen 12%-Kredit sonderzutilgen bringt garantiert 12%, besser als fast jedes Sparkonto. Beispiel: 5.000€ weniger bei 12% sparen rund 600€ Zinsen pro Jahr, jedes Jahr bis zum Ende. Ein Anruf zum Neuverhandeln des Zinses kann Tausende wert sein. bynku zeigt Zinssatz, Enddatum und die Wirkung von Sondertilgungen je Schuld." },
        { label: "4. Investiere, was übrig bleibt", body: "Sind die Reserven aufgebaut und teure Schuld getilgt, sollte brachliegender Überschuss für dich arbeiten. bynku ist keine Bank und sagt dir nicht, welche Wertpapiere du kaufen sollst — aber indem es dir Sicherheit, Werkzeuge und Wissen gibt, hilft es dir, aus einer Position der Stärke statt der Angst zu investieren." },
        { label: "5. Vermögen, Liquidität und Nettovermögen", body: "Vermögen ist der echte Wert, den du hältst — ein Zuhause, ein Auto, Anlagen, ein Unternehmen. Das Nettovermögen (Besitz minus Schulden) ist die ehrlichste Anzeigetafel. Liquidität zählt auch: wie schnell ein Vermögenswert zu Bargeld wird. Und alles hängt zusammen — ein Wert kann Einkommen bringen (Miete), ein Projekt kann zum Wert werden (Anzahlung fürs Haus), und Einkommen finanziert beides. bynku verfolgt Vermögen und Nettovermögen, damit das Gesamtbild sichtbar bleibt." },
      ],
      [
        { label: "1. Fonds d'urgence — environ 3 cycles d'essentiels", body: "Votre premier coussin : environ trois cycles de l'argent dont vous avez vraiment besoin (loyer, nourriture, factures). Il transforme une urgence de crise en désagrément. Marquez un projet comme Fonds d'urgence et le coach le protège et le compte en premier." },
        { label: "2. Matelas de sécurité — 6 à 9 mois de revenu net", body: "Au-delà du fonds d'urgence, visez une réserve plus complète d'environ six à neuf fois le revenu net mensuel du foyer. C'est ce qui permet d'encaisser une perte d'emploi ou un gros choc sans toucher aux placements ni emprunter." },
        { label: "3. Gérer la dette activement — anticiper et négocier", body: "Ne vous contentez pas de rembourser ; évaluez la dette à chaque cycle. Anticiper est souvent un placement à risque nul et fort rendement : rembourser d'avance un prêt à 12% rapporte 12% garantis, mieux que presque tout compte d'épargne. Exemple : 5 000€ de moins sur un prêt à 12% économisent environ 600€ d'intérêts par an, chaque année jusqu'au bout. Un appel pour renégocier le taux peut valoir des milliers. bynku montre le taux, la date de fin et l'effet d'un remboursement anticipé pour chaque dette." },
        { label: "4. Investir ce qui reste", body: "Une fois les réserves constituées et la dette chère soldée, l'excédent dormant doit travailler pour vous. bynku n'est pas un courtier et ne vous dit pas quels titres acheter — mais en vous donnant la sécurité, les outils et le savoir, il vous aide à investir en position de force, non de peur." },
        { label: "5. Actifs, liquidité et patrimoine", body: "Les actifs sont la valeur réelle que vous détenez — un logement, une voiture, des placements, une entreprise. Le patrimoine net (ce que vous avez moins ce que vous devez) est le tableau de bord le plus juste. La liquidité compte aussi : la vitesse à laquelle un actif devient liquide. Et tout s'interconnecte — un actif peut produire un revenu (loyer), un projet peut devenir un actif (l'apport d'un logement), et le revenu finance les deux. bynku suit actifs et patrimoine pour garder l'ensemble en vue." },
      ],
    ),
    callout: L(
      "The layers aren't a race. Do the first two, then you can build several at once — a little to the net, a little off the debt, a little invested — weighted to what's most urgent. bynku shows where you stand on each.",
      "As camadas não são uma corrida. Faz as duas primeiras e depois podes construir várias ao mesmo tempo — um pouco para a rede, um pouco à dívida, um pouco investido — dando mais peso ao mais urgente. O bynku mostra onde estás em cada uma.",
      "Las capas no son una carrera. Haz las dos primeras y luego puedes construir varias a la vez — algo al colchón, algo a la deuda, algo invertido — con más peso en lo más urgente. bynku muestra dónde estás en cada una.",
      "Die Stufen sind kein Wettlauf. Mach die ersten beiden, dann kannst du mehrere zugleich aufbauen — etwas ins Netz, etwas gegen die Schuld, etwas investiert — gewichtet nach dem Dringendsten. bynku zeigt, wo du auf jeder stehst.",
      "Les couches ne sont pas une course. Faites les deux premières, puis construisez-en plusieurs à la fois — un peu au matelas, un peu à la dette, un peu investi — en pondérant vers le plus urgent. bynku montre où vous en êtes sur chacune.",
    ),
    businessNote: L(
      "In a company space these layers map to working capital and runway: the emergency fund is a cash reserve for lean months, the safety net is several months of operating costs, debt still deserves active management, and 'assets' include equipment and receivables. The same net-worth and cash-flow maths applies to the business.",
      "Num espaço de empresa, estas camadas correspondem a fundo de maneio e autonomia: o fundo de emergência é uma reserva de tesouraria para meses fracos, a rede de segurança são vários meses de custos operacionais, a dívida continua a merecer gestão ativa e os 'ativos' incluem equipamento e valores a receber. A mesma matemática de património e fluxo de caixa aplica-se ao negócio.",
      "En un espacio de empresa, estas capas equivalen a capital de trabajo y autonomía: el fondo de emergencia es una reserva de caja para meses flojos, la red de seguridad son varios meses de costes operativos, la deuda sigue mereciendo gestión activa y los 'activos' incluyen equipo y cobros pendientes. La misma matemática de patrimonio y flujo de caja se aplica al negocio.",
      "In einem Firmenraum entsprechen diese Stufen Betriebskapital und Runway: der Notgroschen ist eine Bar-Reserve für schwache Monate, das Sicherheitsnetz mehrere Monate Betriebskosten, Schulden verdienen weiter aktives Management, und 'Vermögen' umfasst Ausrüstung und Forderungen. Dieselbe Nettovermögens- und Cashflow-Mathematik gilt fürs Unternehmen.",
      "Dans un espace entreprise, ces couches correspondent au fonds de roulement et à l'autonomie : le fonds d'urgence est une réserve de trésorerie pour les mois creux, le matelas plusieurs mois de charges d'exploitation, la dette mérite toujours une gestion active, et les « actifs » incluent équipements et créances. La même arithmétique de patrimoine et de trésorerie s'applique à l'entreprise.",
    ),
  },

  // ------------------------------------------------------------ cycles
  {
    id: "cycles",
    icon: "Calendar",
    audience: "personal",
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
    audience: "personal",
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
    audience: "personal",
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
    audience: "personal",
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
    audience: "personal",
    title: L(
      "Safe to spend & Available",
      "Podes gastar & Disponível",
      "Puedes gastar y Disponible",
      "Sicher ausgeben & Verfügbar",
      "À dépenser & Disponible",
    ),
    formula:
      "everyday pool = baseline − fixed bills − loan payments\n" +
      "             = everyday estimate + safety margin\n\n" +
      "safe to spend = everyday pool − spent this cycle\n" +
      "available     = income − fixed bills − loan payments\n" +
      "                      − project funding this cycle − spent this cycle\n\n" +
      "shown safe to spend = the lower of (safe to spend, available)",
    paragraphs: L(
      [
        "'Safe to spend today' is your everyday pool divided by the days left in the cycle. It's the answer to 'if I spend this much today, I'll be fine'.",
        "The card shows two figures. Safe to spend is your everyday pool minus what you've already spent this cycle (and, for the daily view, spread over the days remaining). The everyday pool is your baseline — what a normal month costs — with your fixed bills and loan payments taken back out, which leaves your estimated everyday spending plus the small safety margin you set in Settings.",
        "Available is the stricter, reality-check figure: exactly what's left of your income once fixed costs, loan payments, the money you've actually moved into projects this cycle, and everything spent so far are accounted for. It's your genuine free cash right now.",
        "Why lead with safe to spend? It's a target you set for yourself, built from your own cost estimate and savings margin, so it's deliberately a little ambitious. Keeping your spending under it is exactly what generates surplus to save and invest. Available, by contrast, is the plain truth of what's left — the gap between the two is the head start you're giving yourself.",
        "Safe to spend is never shown higher than Available. If you've funded projects more aggressively than your income surplus covers, your real free cash falls below the everyday target, so the card caps safe to spend at Available. You'll never be told it's safe to spend money that's already committed.",
        "It moves as you spend. Big grocery run today? Tomorrow's number shrinks a little. A refund? It grows. Your fixed bills don't touch this number — they're already reserved.",
      ],
      [
        "'Podes gastar hoje' é a tua reserva do dia a dia dividida pelos dias que faltam no ciclo. Responde a 'se gastar isto hoje, fico bem'.",
        "O cartão mostra dois valores. O Podes gastar é a tua reserva do dia a dia menos o que já gastaste neste ciclo (e, na vista diária, distribuído pelos dias que faltam). A reserva do dia a dia é a tua baseline — quanto custa um mês normal — retirando de novo as contas fixas e os pagamentos de empréstimos, o que deixa a tua estimativa de gasto do dia a dia mais a pequena margem de segurança que definiste nas Definições.",
        "O Disponível é o valor mais rigoroso, de verificação: exatamente o que sobra do teu rendimento depois de contar custos fixos, pagamentos de empréstimos, o dinheiro que realmente moveste para projetos neste ciclo e tudo o que já gastaste. É o teu dinheiro verdadeiramente livre agora.",
        "Porquê destacar o Podes gastar? É um objetivo que defines para ti, construído a partir da tua estimativa de custos e da tua margem de poupança, por isso é propositadamente um pouco ambicioso. Manter os gastos abaixo dele é precisamente o que gera excedente para poupar e investir. O Disponível, por outro lado, é a verdade simples do que resta — a diferença entre os dois é a vantagem que estás a dar a ti mesmo.",
        "O Podes gastar nunca é mostrado acima do Disponível. Se financiaste projetos de forma mais agressiva do que o excedente do teu rendimento permite, o teu dinheiro livre real fica abaixo do objetivo do dia a dia, por isso o cartão limita o Podes gastar ao Disponível. Nunca te será dito que é seguro gastar dinheiro já comprometido.",
        "Muda à medida que gastas. Compra grande hoje? Amanhã o número desce um pouco. Um reembolso? Sobe. As contas fixas não afetam este número — já estão reservadas.",
      ],
      [
        "'Puedes gastar hoy' es tu bolsa del día a día dividida entre los días que quedan del ciclo. Responde a 'si gasto esto hoy, no me pasa nada'.",
        "La tarjeta muestra dos cifras. Puedes gastar es tu bolsa del día a día menos lo que ya has gastado este ciclo (y, en la vista diaria, repartido entre los días que quedan). La bolsa del día a día es tu baseline — lo que cuesta un mes normal — quitando de nuevo los gastos fijos y los pagos de préstamos, lo que deja tu estimación de gasto diario más el pequeño margen de seguridad que fijaste en Ajustes.",
        "El Disponible es la cifra más estricta, de comprobación: exactamente lo que queda de tus ingresos una vez contados los costes fijos, los pagos de préstamos, el dinero que realmente has movido a proyectos este ciclo y todo lo gastado hasta ahora. Es tu dinero realmente libre ahora.",
        "¿Por qué destacar Puedes gastar? Es un objetivo que te fijas tú, construido a partir de tu estimación de costes y tu margen de ahorro, así que es a propósito algo ambicioso. Mantener el gasto por debajo de él es justo lo que genera excedente para ahorrar e invertir. El Disponible, en cambio, es la verdad simple de lo que queda — la diferencia entre ambos es la ventaja que te das a ti mismo.",
        "Puedes gastar nunca se muestra por encima del Disponible. Si has financiado proyectos de forma más agresiva de lo que cubre el excedente de tus ingresos, tu dinero libre real cae por debajo del objetivo diario, así que la tarjeta limita Puedes gastar al Disponible. Nunca se te dirá que es seguro gastar dinero ya comprometido.",
        "Cambia según gastas. ¿Compra grande hoy? Mañana el número baja algo. ¿Devolución? Sube. Los gastos fijos no tocan este número — ya están reservados.",
      ],
      [
        "'Heute sicher ausgeben' ist dein Alltagsbudget geteilt durch die verbleibenden Tage im Zyklus. Es beantwortet: 'wenn ich das heute ausgebe, bin ich noch im Rahmen'.",
        "Die Karte zeigt zwei Werte. Sicher ausgeben ist dein Alltagsbudget minus dem, was du in diesem Zyklus bereits ausgegeben hast (und in der Tagesansicht auf die verbleibenden Tage verteilt). Das Alltagsbudget ist deine Baseline — was ein normaler Monat kostet — abzüglich deiner Fixkosten und Kreditraten, sodass deine geschätzten Alltagsausgaben plus die kleine Sicherheitsmarge übrig bleiben, die du in den Einstellungen festgelegt hast.",
        "Verfügbar ist der strengere Kontrollwert: genau das, was von deinem Einkommen übrig bleibt, nachdem Fixkosten, Kreditraten, das in diesem Zyklus tatsächlich in Projekte verschobene Geld und alle bisherigen Ausgaben berücksichtigt sind. Es ist dein echtes freies Geld im Moment.",
        "Warum steht Sicher ausgeben im Vordergrund? Es ist ein Ziel, das du dir selbst setzt, aufgebaut aus deiner eigenen Kostenschätzung und Sparmarge, also bewusst etwas ehrgeizig. Deine Ausgaben darunter zu halten, ist genau das, was Überschuss zum Sparen und Investieren schafft. Verfügbar dagegen ist die schlichte Wahrheit über das, was bleibt — die Lücke zwischen beiden ist der Vorsprung, den du dir gibst.",
        "Sicher ausgeben wird nie höher angezeigt als Verfügbar. Hast du Projekte stärker finanziert, als dein Einkommensüberschuss deckt, sinkt dein echtes freies Geld unter das Alltagsziel, also begrenzt die Karte Sicher ausgeben auf Verfügbar. Dir wird nie gesagt, dass es sicher ist, bereits gebundenes Geld auszugeben.",
        "Es bewegt sich mit deinen Ausgaben. Großer Einkauf heute? Morgen sinkt der Wert etwas. Rückerstattung? Er steigt. Fixkosten sind bereits reserviert und ändern diesen Wert nicht.",
      ],
      [
        "« À dépenser aujourd'hui » est ton enveloppe quotidienne divisée par les jours restants du cycle. C'est la réponse à « si je dépense ça aujourd'hui, ça va ».",
        "La carte affiche deux chiffres. À dépenser correspond à ton enveloppe quotidienne moins ce que tu as déjà dépensé ce cycle (et, en vue journalière, réparti sur les jours restants). L'enveloppe quotidienne, c'est ta baseline — ce que coûte un mois normal — en retirant de nouveau tes charges fixes et tes remboursements de prêts, ce qui laisse ton estimation de dépenses courantes plus la petite marge de sécurité définie dans les Réglages.",
        "Disponible est le chiffre plus strict, de vérification : exactement ce qu'il reste de tes revenus une fois pris en compte les charges fixes, les remboursements de prêts, l'argent réellement transféré vers des projets ce cycle et tout ce qui a déjà été dépensé. C'est ton argent réellement libre maintenant.",
        "Pourquoi mettre À dépenser en avant ? C'est un objectif que tu te fixes, construit à partir de ta propre estimation de coûts et de ta marge d'épargne, donc volontairement un peu ambitieux. Garder tes dépenses en dessous, c'est justement ce qui génère l'excédent à épargner et investir. Disponible, lui, est la vérité simple de ce qui reste — l'écart entre les deux est l'avance que tu te donnes.",
        "À dépenser n'est jamais affiché au-dessus de Disponible. Si tu as financé des projets plus agressivement que ne le permet ton excédent de revenus, ton argent réellement libre passe sous l'objectif quotidien, donc la carte plafonne À dépenser à Disponible. On ne te dira jamais qu'il est sûr de dépenser de l'argent déjà engagé.",
        "Il évolue quand tu dépenses. Grosses courses aujourd'hui ? Demain le chiffre baisse un peu. Un remboursement ? Il monte. Les charges fixes n'y touchent pas — déjà réservées.",
      ],
    ),
    bullets: L(
      [
        { label: "Safe to spend", body: "Your everyday pool (estimate + margin) minus what you've spent — a target that builds surplus." },
        { label: "Available", body: "Your true free cash: income minus fixed costs, loans, project funding and spending so far." },
        { label: "Capped", body: "Safe to spend is never higher than Available, so it never counts money already committed." },
        { label: "Received", body: "Refunds, gifts and one-off inflows go back into the pool and lift both figures." },
        { label: "Rolling forward", body: "End the cycle under budget? What's left carries to the next cycle so you're rewarded for restraint." },
      ],
      [
        { label: "Podes gastar", body: "A tua reserva do dia a dia (estimativa + margem) menos o que gastaste — um objetivo que cria excedente." },
        { label: "Disponível", body: "O teu dinheiro realmente livre: rendimento menos custos fixos, empréstimos, financiamento de projetos e o que já gastaste." },
        { label: "Limitado", body: "O Podes gastar nunca é superior ao Disponível, por isso nunca conta dinheiro já comprometido." },
        { label: "Recebido", body: "Reembolsos, prendas e entradas pontuais voltam para a reserva e sobem os dois valores." },
        { label: "Segue em frente", body: "Terminas o ciclo abaixo do orçamento? O que sobra passa para o ciclo seguinte — a contenção é recompensada." },
      ],
      [
        { label: "Puedes gastar", body: "Tu bolsa del día a día (estimación + margen) menos lo gastado — un objetivo que crea excedente." },
        { label: "Disponible", body: "Tu dinero realmente libre: ingresos menos costes fijos, préstamos, financiación de proyectos y lo gastado." },
        { label: "Limitado", body: "Puedes gastar nunca supera al Disponible, así que nunca cuenta dinero ya comprometido." },
        { label: "Recibido", body: "Devoluciones, regalos e ingresos puntuales vuelven a la bolsa y suben ambas cifras." },
        { label: "Se traslada", body: "¿Cierras el ciclo por debajo del presupuesto? Lo que sobra pasa al siguiente — se premia la contención." },
      ],
      [
        { label: "Sicher ausgeben", body: "Dein Alltagsbudget (Schätzung + Marge) minus Ausgaben — ein Ziel, das Überschuss aufbaut." },
        { label: "Verfügbar", body: "Dein echtes freies Geld: Einkommen minus Fixkosten, Kredite, Projektfinanzierung und bisherige Ausgaben." },
        { label: "Gedeckelt", body: "Sicher ausgeben ist nie höher als Verfügbar, zählt also nie bereits gebundenes Geld." },
        { label: "Erhalten", body: "Rückerstattungen, Geschenke und Einmalzuflüsse gehen zurück ins Budget und heben beide Werte." },
        { label: "Rollt weiter", body: "Unter Budget geblieben? Der Rest wandert in den nächsten Zyklus — Sparen wird belohnt." },
      ],
      [
        { label: "À dépenser", body: "Ton enveloppe quotidienne (estimation + marge) moins tes dépenses — un objectif qui crée de l'excédent." },
        { label: "Disponible", body: "Ton argent réellement libre : revenus moins charges fixes, prêts, financement des projets et dépenses déjà faites." },
        { label: "Plafonné", body: "À dépenser n'est jamais supérieur à Disponible, il ne compte donc jamais d'argent déjà engagé." },
        { label: "Reçu", body: "Remboursements, cadeaux et entrées ponctuelles reviennent dans l'enveloppe et font monter les deux chiffres." },
        { label: "Report", body: "Cycle bouclé sous le budget ? Le reste passe au cycle suivant — la modération est récompensée." },
      ],
    ),
    callout: L(
      "Think of it as ambition versus reality: safe to spend is the target, Available is the truth. Spend under the target and the difference becomes surplus — fuel for your projects and investing.",
      "Pensa nisto como ambição versus realidade: o Podes gastar é o objetivo, o Disponível é a verdade. Gasta abaixo do objetivo e a diferença torna-se excedente — combustível para os teus projetos e investimentos.",
      "Piénsalo como ambición frente a realidad: Puedes gastar es el objetivo, el Disponible es la verdad. Gasta por debajo del objetivo y la diferencia se vuelve excedente — combustible para tus proyectos e inversiones.",
      "Sieh es als Ehrgeiz gegen Wirklichkeit: Sicher ausgeben ist das Ziel, Verfügbar ist die Wahrheit. Bleib unter dem Ziel, und die Differenz wird zu Überschuss — Treibstoff für deine Projekte und Investitionen.",
      "Vois cela comme l'ambition face à la réalité : À dépenser est l'objectif, Disponible est la vérité. Dépense sous l'objectif et la différence devient de l'excédent — le carburant de tes projets et de tes investissements.",
    ),
  },

  // ------------------------------------------------------------ progressOverTime
  {
    id: "progressOverTime",
    icon: "BarChart3",
    title: L(
      "Your progress over time",
      "O seu progresso ao longo do tempo",
      "Tu progreso a lo largo del tiempo",
      "Dein Fortschritt im Zeitverlauf",
      "Votre progression dans le temps",
    ),
    paragraphs: L(
      [
        "bynku gets more useful the longer you use it. At the end of each cycle it quietly saves a snapshot — your score, what you earned and spent, what you set aside — so it can show how you're doing over months, not just today.",
        "On the Analysis page you'll find four views of that history: how your financial score is trending, how your own estimates compare with what really happened, how this cycle stacks up against the last few, and whether your nice-to-have and treat spending is drifting up or down.",
        "The coach reads the same history. When your everyday spending has run above your estimate for a few cycles, it can suggest nudging your baseline up so safe-to-spend gets more accurate — small course-corrections instead of guesswork.",
        "None of this needs extra work from you. Keep recording your cycle as usual and the history builds itself. The first trends appear once you have two closed cycles on record.",
      ],
      [
        "O bynku torna-se mais útil quanto mais o usa. No fim de cada ciclo guarda discretamente um retrato — a sua pontuação, o que ganhou e gastou, o que reservou — para mostrar como está a evoluir ao longo dos meses, e não só hoje.",
        "Na página de Análise encontra quatro vistas desse histórico: como está a evoluir a sua pontuação, como as suas estimativas se comparam com o que realmente aconteceu, como este ciclo se compara com os anteriores, e se os gastos supérfluos estão a subir ou a descer.",
        "O coach lê o mesmo histórico. Quando os seus gastos do dia a dia superam a estimativa há alguns ciclos, pode sugerir subir a baseline para que o valor seguro fique mais exato — pequenas correções em vez de adivinhação.",
        "Nada disto exige trabalho extra. Continue a registar o seu ciclo como sempre e o histórico constrói-se sozinho. As primeiras tendências aparecem quando tiver dois ciclos fechados registados.",
      ],
      [
        "bynku es más útil cuanto más lo usas. Al final de cada ciclo guarda discretamente una instantánea — tu puntuación, lo que ingresaste y gastaste, lo que reservaste — para mostrar cómo evolucionas a lo largo de los meses, no solo hoy.",
        "En la página de Análisis encontrarás cuatro vistas de ese historial: cómo evoluciona tu puntuación, cómo se comparan tus estimaciones con lo que realmente pasó, cómo se compara este ciclo con los anteriores, y si tu gasto en caprichos sube o baja.",
        "El coach lee el mismo historial. Cuando tu gasto diario supera tu estimación durante varios ciclos, puede sugerir subir tu baseline para que el gasto seguro sea más exacto — pequeñas correcciones en vez de adivinar.",
        "Nada de esto requiere trabajo extra. Sigue registrando tu ciclo como siempre y el historial se construye solo. Las primeras tendencias aparecen cuando tengas dos ciclos cerrados registrados.",
      ],
      [
        "bynku wird nützlicher, je länger du es nutzt. Am Ende jedes Zyklus speichert es still eine Momentaufnahme — deinen Score, Einnahmen und Ausgaben, Zurückgelegtes —, um zu zeigen, wie du dich über Monate entwickelst, nicht nur heute.",
        "Auf der Analyse-Seite findest du vier Ansichten dieser Historie: wie sich dein Score entwickelt, wie deine Schätzungen mit der Realität übereinstimmen, wie dieser Zyklus im Vergleich zu den letzten dasteht, und ob deine Ausgaben für Nice-to-haves steigen oder sinken.",
        "Der Coach liest dieselbe Historie. Wenn deine Alltagsausgaben über mehrere Zyklen über der Schätzung lagen, kann er vorschlagen, deine Baseline anzuheben, damit der sichere Betrag genauer wird — kleine Korrekturen statt Raten.",
        "Nichts davon macht Mehrarbeit. Erfasse deinen Zyklus wie gewohnt, und die Historie baut sich von selbst auf. Die ersten Trends erscheinen, sobald zwei abgeschlossene Zyklen vorliegen.",
      ],
      [
        "bynku devient plus utile à mesure que vous l'utilisez. À la fin de chaque cycle, il enregistre discrètement un instantané — votre score, ce que vous avez gagné et dépensé, ce que vous avez mis de côté — pour montrer votre évolution sur les mois, pas seulement aujourd'hui.",
        "Sur la page Analyse, vous trouverez quatre vues de cet historique : l'évolution de votre score, la comparaison de vos estimations avec la réalité, ce cycle face aux précédents, et si vos dépenses plaisir montent ou descendent.",
        "Le coach lit le même historique. Quand vos dépenses courantes dépassent votre estimation depuis plusieurs cycles, il peut suggérer de relever votre baseline pour que le montant sûr soit plus juste — de petits ajustements plutôt que des suppositions.",
        "Rien de tout cela ne demande de travail en plus. Continuez à enregistrer votre cycle comme d'habitude et l'historique se construit tout seul. Les premières tendances apparaissent dès deux cycles clôturés.",
      ],
    ),
    bullets: L(
      [
        { label: "Score over time", body: "A line of your health score across cycles, with the change since last cycle." },
        { label: "Estimates vs reality", body: "How your everyday and income estimates compared with what actually happened, so you can fine-tune them." },
        { label: "Cycle vs cycle", body: "This cycle's income, spending, saving and surplus against the previous one and your recent average." },
        { label: "Momentum", body: "Small celebrations when you string together good cycles — saving, cutting back, or a rising score." },
      ],
      [
        { label: "Pontuação ao longo do tempo", body: "Uma linha da sua pontuação ao longo dos ciclos, com a variação desde o último ciclo." },
        { label: "Estimativas vs. realidade", body: "Como as suas estimativas de dia a dia e de rendimento se compararam com o que aconteceu, para as afinar." },
        { label: "Ciclo a ciclo", body: "O rendimento, gastos, poupança e excedente deste ciclo face ao anterior e à sua média recente." },
        { label: "Ritmo", body: "Pequenas celebrações quando encadeia bons ciclos — poupar, conter gastos ou uma pontuação a subir." },
      ],
      [
        { label: "Puntuación a lo largo del tiempo", body: "Una línea de tu puntuación a través de los ciclos, con el cambio desde el último." },
        { label: "Estimaciones vs. realidad", body: "Cómo se compararon tus estimaciones de día a día e ingresos con lo que ocurrió, para afinarlas." },
        { label: "Ciclo a ciclo", body: "Los ingresos, gasto, ahorro y excedente de este ciclo frente al anterior y tu media reciente." },
        { label: "Impulso", body: "Pequeñas celebraciones cuando encadenas buenos ciclos — ahorrar, moderarte o una puntuación que sube." },
      ],
      [
        { label: "Score im Zeitverlauf", body: "Eine Linie deines Scores über die Zyklen, mit der Veränderung seit dem letzten." },
        { label: "Schätzungen vs. Realität", body: "Wie deine Alltags- und Einkommensschätzungen mit der Realität verglichen — zum Feinjustieren." },
        { label: "Zyklus für Zyklus", body: "Einkommen, Ausgaben, Sparen und Überschuss dieses Zyklus gegenüber dem letzten und deinem jüngsten Durchschnitt." },
        { label: "Momentum", body: "Kleine Erfolge, wenn du gute Zyklen aneinanderreihst — sparen, kürzertreten oder ein steigender Score." },
      ],
      [
        { label: "Score dans le temps", body: "Une courbe de votre score au fil des cycles, avec l'écart depuis le dernier." },
        { label: "Estimations vs réalité", body: "Comment vos estimations quotidiennes et de revenus se sont comparées à la réalité, pour les affiner." },
        { label: "Cycle par cycle", body: "Revenus, dépenses, épargne et excédent de ce cycle face au précédent et à votre moyenne récente." },
        { label: "Élan", body: "De petites célébrations quand vous enchaînez de bons cycles — épargner, se modérer ou un score qui monte." },
      ],
    ),
    callout: L(
      "Estimates that drift are normal — the point is to notice and adjust. A rising score over several cycles is the real signal that your position is improving.",
      "Estimativas que variam são normais — o importante é reparar e ajustar. Uma pontuação a subir ao longo de vários ciclos é o verdadeiro sinal de que a sua posição está a melhorar.",
      "Que las estimaciones varíen es normal — lo importante es notarlo y ajustar. Una puntuación que sube durante varios ciclos es la señal real de que tu posición mejora.",
      "Schwankende Schätzungen sind normal — es geht darum, sie zu bemerken und anzupassen. Ein über mehrere Zyklen steigender Score ist das echte Zeichen, dass sich deine Lage verbessert.",
      "Des estimations qui varient, c'est normal — l'important est de le remarquer et d'ajuster. Un score qui monte sur plusieurs cycles est le vrai signe que votre situation s'améliore.",
    ),
  },

  // ------------------------------------------------------------ projects (save & invest)
  {
    id: "projects",
    icon: "PiggyBank",
    audience: "personal",
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
    audience: "personal",
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
    audience: "personal",
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
    audience: "personal",
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

  // ------------------------------------------------------------ coach
  {
    id: "coach",
    icon: "Bell",
    title: L(
      "Your coach, proactively",
      "O teu coach, proativo",
      "Tu coach, proactivo",
      "Dein Coach, proaktiv",
      "Ton coach, proactif",
    ),
    paragraphs: L(
      [
        "bynku does more than answer when asked. The bell at the top opens your coach inbox, where bynku posts the one thing worth your attention: an end-of-cycle recap with a single next step, a nudge when spending outpaces the plan, a reminder to set aside for a known upcoming cost, and a note when you reach a milestone.",
        "The inbox is always on. If you want the same nudges to reach you off-app, turn on email or web push in Settings. Each message appears once, and the timing follows your cycle, not the clock.",
      ],
      [
        "O bynku faz mais do que responder quando lhe perguntas. O sino no topo abre a caixa do coach, onde o bynku publica aquilo que merece a tua atenção: um resumo no fim do ciclo com um próximo passo, um aviso quando os gastos ultrapassam o plano, um lembrete para pôr de lado um custo já conhecido e uma nota quando atinges um marco.",
        "A caixa está sempre ativa. Se quiseres receber os mesmos avisos fora da app, ativa o e-mail ou as notificações push nas Definições. Cada mensagem aparece uma vez e o momento segue o teu ciclo, não o relógio.",
      ],
      [
        "bynku hace más que responder cuando le preguntas. La campana de arriba abre la bandeja del coach, donde bynku publica lo que merece tu atención: un resumen al cerrar el ciclo con un siguiente paso, un aviso cuando el gasto supera el plan, un recordatorio para apartar un coste ya conocido y una nota cuando alcanzas un hito.",
        "La bandeja está siempre activa. Si quieres recibir los mismos avisos fuera de la app, activa el correo o las notificaciones push en Ajustes. Cada mensaje aparece una vez y el momento sigue tu ciclo, no el reloj.",
      ],
      [
        "bynku antwortet nicht nur auf Nachfrage. Die Glocke oben öffnet den Coach-Posteingang, in dem bynku das eine Wichtige postet: eine Zusammenfassung am Zyklusende mit einem nächsten Schritt, einen Hinweis, wenn die Ausgaben den Plan übertreffen, eine Erinnerung, für bekannte künftige Kosten zurückzulegen, und eine Notiz, wenn du einen Meilenstein erreichst.",
        "Der Posteingang ist immer an. Wenn dich dieselben Hinweise auch außerhalb der App erreichen sollen, aktiviere E-Mail oder Web-Push in den Einstellungen. Jede Nachricht erscheint einmal, und der Zeitpunkt folgt deinem Zyklus, nicht der Uhr.",
      ],
      [
        "bynku ne se contente pas de répondre quand on l'interroge. La cloche en haut ouvre la boîte du coach, où bynku publie ce qui mérite votre attention : un récapitulatif de fin de cycle avec une prochaine étape, une alerte quand les dépenses dépassent le plan, un rappel pour mettre de côté un coût connu à venir, et une note quand vous atteignez un jalon.",
        "La boîte est toujours active. Pour recevoir les mêmes alertes hors de l'app, activez l'e-mail ou les notifications push dans les Réglages. Chaque message apparaît une fois, et le moment suit votre cycle, pas l'horloge.",
      ],
    ),
    bullets: L(
      [
        { label: "Cycle recap", body: "When a cycle closes: what happened, and the single most useful next move." },
        { label: "Drift alerts", body: "A heads-up when you pass 80% or 100% of your everyday budget." },
        { label: "Cost reminders", body: "Ahead of a known plan like a car service or tax, so you can set money aside in time." },
        { label: "Milestones", body: "A quiet well done when your score jumps or your surplus streak grows." },
      ],
      [
        { label: "Resumo do ciclo", body: "Quando um ciclo fecha: o que aconteceu e o passo seguinte mais útil." },
        { label: "Alertas de desvio", body: "Um aviso quando passas 80% ou 100% do teu orçamento do dia a dia." },
        { label: "Lembretes de custos", body: "Antes de um plano conhecido, como a revisão do carro ou impostos, para pores dinheiro de lado a tempo." },
        { label: "Marcos", body: "Um discreto parabéns quando a tua pontuação sobe ou a tua sequência de excedentes cresce." },
      ],
      [
        { label: "Resumen del ciclo", body: "Cuando un ciclo cierra: qué pasó y el siguiente paso más útil." },
        { label: "Avisos de desvío", body: "Un aviso cuando superas el 80% o el 100% de tu presupuesto del día a día." },
        { label: "Recordatorios de gastos", body: "Antes de un plan conocido, como la revisión del coche o impuestos, para apartar dinero a tiempo." },
        { label: "Hitos", body: "Una discreta enhorabuena cuando tu puntuación sube o crece tu racha de excedente." },
      ],
      [
        { label: "Zyklus-Zusammenfassung", body: "Wenn ein Zyklus endet: was passiert ist und der nützlichste nächste Schritt." },
        { label: "Abweichungs-Hinweise", body: "Ein Hinweis, wenn du 80% oder 100% deines Alltagsbudgets überschreitest." },
        { label: "Kostenerinnerungen", body: "Vor einem bekannten Plan wie Autoinspektion oder Steuer, um rechtzeitig zurückzulegen." },
        { label: "Meilensteine", body: "Ein leises Gut gemacht, wenn dein Score steigt oder deine Überschuss-Serie wächst." },
      ],
      [
        { label: "Récapitulatif de cycle", body: "Quand un cycle se termine : ce qui s'est passé et la prochaine action la plus utile." },
        { label: "Alertes d'écart", body: "Un signal quand vous dépassez 80% ou 100% de votre budget du quotidien." },
        { label: "Rappels de coûts", body: "Avant un plan connu comme une révision auto ou un impôt, pour mettre de côté à temps." },
        { label: "Jalons", body: "Un discret bravo quand votre score grimpe ou que votre série d'excédents s'allonge." },
      ],
    ),
    businessNote: L(
      "For companies, the coach also watches runway and receivables: it warns as runway falls under three, two, and one month, and nudges you to chase overdue invoices with a ready-to-send message.",
      "Para empresas, o coach também vigia a autonomia e os valores a receber: avisa quando a autonomia desce abaixo de três, dois e um mês, e lembra-te de cobrar faturas em atraso com uma mensagem pronta a enviar.",
      "Para empresas, el coach también vigila la autonomía y los cobros: avisa cuando la autonomía baja de tres, dos y un mes, y te recuerda reclamar facturas vencidas con un mensaje listo para enviar.",
      "Für Unternehmen beobachtet der Coach auch Reichweite und Forderungen: Er warnt, wenn die Reichweite unter drei, zwei und einen Monat fällt, und erinnert dich, überfällige Rechnungen mit einer fertigen Nachricht anzumahnen.",
      "Pour les entreprises, le coach surveille aussi la trésorerie et les créances : il alerte quand la trésorerie passe sous trois, deux et un mois, et vous rappelle de relancer les factures en retard avec un message prêt à envoyer.",
    ),
  },

  // ------------------------------------------------------------ analysis
  {
    id: "analysis",
    icon: "BarChart3",
    audience: "personal",
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

  // ------------------------------------------------------------ principles
  {
    id: "principles",
    icon: "PiggyBank",
    audience: "personal",
    diagram: "ladder",
    title: L(
      "Money principles: the order that works",
      "Princípios do dinheiro: a ordem que funciona",
      "Principios del dinero: el orden que funciona",
      "Geldprinzipien: die Reihenfolge, die funktioniert",
      "Principes de l'argent : l'ordre qui marche",
    ),
    paragraphs: L(
      [
        "Good money decisions usually follow an order, not a mood. bynku's coach applies the same ladder to your numbers, so its advice stays consistent. Here's the thinking behind it, so you can use it yourself.",
        "The order matters because of interest. Money you owe grows against you at the debt's rate; money you save or invest grows for you. Paying off a debt at 15% is a guaranteed 15% return, usually better than any investment, so expensive debt comes before investing. And a small cash buffer comes before everything, because without it a single surprise forces you back into borrowing.",
        "Once the essentials are in place you don't have to do one thing at a time. Beyond the starter buffer you can split your surplus, a little to the safety net, a little to debt, a little invested, weighting toward whatever is most urgent.",
      ],
      [
        "As boas decisões financeiras seguem uma ordem, não um estado de espírito. O coach do bynku aplica a mesma escada aos teus números, para o conselho ser coerente. Aqui está o raciocínio, para o usares também.",
        "A ordem importa por causa dos juros. O que deves cresce contra ti à taxa da dívida; o que poupas ou investes cresce a teu favor. Pagar uma dívida a 15% é um retorno garantido de 15%, normalmente melhor que qualquer investimento, por isso a dívida cara vem antes de investir. E uma pequena almofada vem antes de tudo, porque sem ela uma surpresa obriga-te a voltar ao crédito.",
        "Com o essencial no lugar, não tens de fazer uma coisa de cada vez. Depois da almofada inicial podes dividir o excedente, um pouco para a reserva, um pouco para a dívida, um pouco investido, dando mais peso ao que for mais urgente.",
      ],
      [
        "Las buenas decisiones de dinero siguen un orden, no un ánimo. El asistente de bynku aplica la misma escalera a tus números, para que el consejo sea coherente. Aquí está la lógica, para que la uses tú.",
        "El orden importa por los intereses. Lo que debes crece en tu contra al tipo de la deuda; lo que ahorras o inviertes crece a tu favor. Pagar una deuda al 15% es un retorno garantizado del 15%, normalmente mejor que cualquier inversión, así que la deuda cara va antes de invertir. Y un pequeño colchón va antes de todo, porque sin él un imprevisto te obliga a volver a endeudarte.",
        "Con lo esencial en su sitio, no tienes que ir de una en una. Tras el colchón inicial puedes repartir tu excedente, algo al colchón, algo a la deuda, algo invertido, dando más peso a lo más urgente.",
      ],
      [
        "Gute Geldentscheidungen folgen einer Reihenfolge, keiner Stimmung. Der bynku-Coach legt dieselbe Leiter an deine Zahlen an, damit der Rat konsistent bleibt. Hier ist der Gedanke dahinter, damit du ihn selbst nutzen kannst.",
        "Die Reihenfolge zählt wegen der Zinsen. Schulden wachsen zum Schuldzins gegen dich; Erspartes oder Investiertes wächst für dich. Eine Schuld zu 15% zu tilgen ist eine garantierte Rendite von 15%, meist besser als jede Anlage, deshalb kommt teure Schuld vor dem Investieren. Und ein kleiner Puffer kommt vor allem anderen, weil dich sonst eine einzige Überraschung zurück in die Verschuldung zwingt.",
        "Ist das Wesentliche geregelt, musst du nicht eins nach dem anderen tun. Nach dem Startpuffer kannst du deinen Überschuss aufteilen, etwas in den Notgroschen, etwas in Schulden, etwas investiert, mit mehr Gewicht auf dem Dringendsten.",
      ],
      [
        "Les bonnes décisions financières suivent un ordre, pas une humeur. Le coach de bynku applique la même échelle à vos chiffres pour que le conseil reste cohérent. Voici le raisonnement, pour que vous l'utilisiez vous-même.",
        "L'ordre compte à cause des intérêts. Ce que vous devez croît contre vous au taux de la dette ; ce que vous épargnez ou investissez croît pour vous. Rembourser une dette à 15% est un rendement garanti de 15%, souvent meilleur que tout placement, donc la dette chère passe avant d'investir. Et un petit coussin passe avant tout, car sans lui un imprévu vous renvoie à l'emprunt.",
        "Une fois l'essentiel en place, inutile de faire une chose à la fois. Après le coussin de départ, répartissez votre excédent, un peu au matelas, un peu à la dette, un peu investi, en pondérant vers le plus urgent.",
      ],
    ),
    bullets: L(
      [
        { label: "1. Starter buffer", body: "Keep about one month of essentials always reachable, so a surprise doesn't become a loan." },
        { label: "2. Kill high-APR debt", body: "Clear expensive debt first (credit cards, overdrafts). Paying it off earns its interest rate, risk-free." },
        { label: "3. Full safety net", body: "Build the reserve toward roughly six months of net income. First milestone: three months of expenses. bynku tracks both." },
        { label: "4. Invest the surplus", body: "Once the net is funded and dear debt is gone, put idle money to work for long-term growth rather than letting it sit." },
        { label: "5. Smart buying", body: "Compare total cost, not the monthly. Keep new commitments within your safe amount, and let a want sit a few days before saying yes." },
      ],
      [
        { label: "1. Almofada inicial", body: "Mantém cerca de um mês de essenciais sempre acessível, para uma surpresa não virar empréstimo." },
        { label: "2. Elimina dívida cara", body: "Liquida primeiro a dívida cara (cartões, descobertos). Pagá-la rende a sua taxa de juro, sem risco." },
        { label: "3. Rede de segurança completa", body: "Constrói a reserva até cerca de seis meses de rendimento líquido. Primeira meta: três meses de despesas. O bynku acompanha ambos." },
        { label: "4. Investe o excedente", body: "Com a rede feita e a dívida cara paga, põe o dinheiro parado a trabalhar para crescer a longo prazo." },
        { label: "5. Compra com cabeça", body: "Compara o custo total, não a mensalidade. Mantém novos compromissos dentro do valor seguro e deixa um desejo repousar uns dias antes de dizer sim." },
      ],
      [
        { label: "1. Colchón inicial", body: "Ten siempre a mano cerca de un mes de gastos esenciales, para que un imprevisto no acabe en préstamo." },
        { label: "2. Elimina la deuda cara", body: "Salda primero la deuda cara (tarjetas, descubiertos). Pagarla rinde su tipo de interés, sin riesgo." },
        { label: "3. Red de seguridad completa", body: "Lleva la reserva hacia unos seis meses de ingreso neto. Primer hito: tres meses de gastos. bynku sigue ambos." },
        { label: "4. Invierte el excedente", body: "Con la red hecha y la deuda cara fuera, pon el dinero parado a trabajar para crecer a largo plazo." },
        { label: "5. Compra con cabeza", body: "Compara el coste total, no la cuota. Mantén los nuevos compromisos dentro de tu importe seguro y deja reposar un capricho unos días antes de decir sí." },
      ],
      [
        { label: "1. Startpuffer", body: "Halte etwa einen Monat an Essenzausgaben immer griffbereit, damit eine Überraschung kein Kredit wird." },
        { label: "2. Teure Schuld tilgen", body: "Zuerst teure Schulden abbauen (Kreditkarten, Dispo). Die Tilgung bringt den Schuldzins, risikofrei." },
        { label: "3. Voller Notgroschen", body: "Baue die Reserve auf etwa sechs Monate Nettoeinkommen. Erster Meilenstein: drei Monate Ausgaben. bynku verfolgt beides." },
        { label: "4. Überschuss investieren", body: "Ist der Notgroschen voll und teure Schuld weg, lass ruhendes Geld für langfristiges Wachstum arbeiten." },
        { label: "5. Klug kaufen", body: "Vergleiche die Gesamtkosten, nicht die Rate. Halte neue Verpflichtungen im sicheren Rahmen und lass einen Wunsch ein paar Tage ruhen, bevor du zusagst." },
      ],
      [
        { label: "1. Coussin de départ", body: "Gardez environ un mois de dépenses essentielles toujours accessible, pour qu'un imprévu ne devienne pas un prêt." },
        { label: "2. Éliminer la dette chère", body: "Soldez d'abord la dette chère (cartes, découverts). La rembourser rapporte son taux d'intérêt, sans risque." },
        { label: "3. Matelas de sécurité complet", body: "Constituez la réserve vers environ six mois de revenu net. Premier palier : trois mois de dépenses. bynku suit les deux." },
        { label: "4. Investir l'excédent", body: "Une fois le matelas constitué et la dette chère soldée, faites travailler l'argent dormant pour le long terme." },
        { label: "5. Acheter malin", body: "Comparez le coût total, pas la mensualité. Gardez les nouveaux engagements dans votre montant sûr et laissez une envie reposer quelques jours avant de dire oui." },
      ],
    ),
    callout: L(
      "These are defaults, not dogma. bynku shows where you stand on each rung and adapts to your situation; the point is a clear order to fall back on, not a rigid script.",
      "São predefinições, não dogma. O bynku mostra em que degrau estás e adapta-se à tua situação; o objetivo é uma ordem clara para seguir, não um guião rígido.",
      "Son valores por defecto, no dogma. bynku muestra en qué peldaño estás y se adapta a tu situación; la idea es tener un orden claro al que volver, no un guion rígido.",
      "Das sind Voreinstellungen, kein Dogma. bynku zeigt, auf welcher Stufe du stehst, und passt sich deiner Lage an; es geht um eine klare Reihenfolge als Rückhalt, kein starres Skript.",
      "Ce sont des repères, pas un dogme. bynku montre où vous en êtes sur chaque échelon et s'adapte à votre situation ; le but est un ordre clair sur lequel s'appuyer, pas un script rigide.",
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

  // ------------------------------------------------------------ smartHelp
  {
    id: "smartHelp",
    icon: "Sparkles",
    title: L(
      "Smart help: tips, comparisons and the coach",
      "Ajuda inteligente: dicas, comparações e o coach",
      "Ayuda inteligente: consejos, comparativas y el asistente",
      "Kluge Hilfe: Tipps, Vergleiche und der Coach",
      "Aide intelligente : conseils, comparaisons et le coach",
    ),
    paragraphs: L(
      [
        "bynku does more than record numbers — it reads your situation and helps you act. Four features do most of that work, and all of them are grounded in your real figures, never generic.",
        "Tips and issues are small, contextual nudges on your dashboard, generated from what's actually happening this cycle. They flag things worth a glance and link straight to the screen where you can act. Typical ones: a category running over its estimate, a project falling behind its goal, a shortfall month coming up in your plans, a big one-off you haven't started saving for, or high-interest debt that's cheaper to attack than to sit on.",
        "How you compare places your spending and saving next to national averages for your country, income band and household size — drawn from public statistics (Eurostat and national institutes), never from other users. Its value is perspective: it shows where you genuinely stand out, high or low, so you know which habits are worth changing. It's a reference, not a rule, and it waits until enough of the cycle has passed before judging, so day one doesn't crown you a saint.",
        "The coach is a chat that already knows your numbers — income, surplus, debts, goals, plans, assets — so its advice is specific, not boilerplate. Ask it real questions: can I afford this house, should I overpay this loan or invest, what do I do with a bonus, am I on track. It follows sound principles (safety net, then expensive debt, then invest) and cites the figures it used. Toggle Brief for short answers or Deep think for a full, numbers-grounded reply. It's a coach, not a licensed advisor — for regulated products it points you to a professional.",
        "Should I buy this? is the coach at the moment of temptation. Tell it what you're eyeing, the price, and how much you want it on the Essential → Treat scale, and it answers honestly: can you afford it now, what it costs your goals and safety net, buy-vs-finance if relevant, and how to make it work if it's borderline. It also weighs how much you've already spent on treats this cycle — if you've been indulging, it gently suggests sleeping on it, rewarding restraint rather than scolding. The same Essential / Important / Nice-to-have / Treat scale you can tag expenses with feeds this, so the more you classify, the sharper the calls.",
      ],
      [
        "O bynku faz mais do que registar números — lê a tua situação e ajuda-te a agir. Quatro funções fazem a maior parte desse trabalho, todas assentes nos teus números reais, nunca genéricas.",
        "As dicas e alertas são pequenos avisos com contexto no painel, gerados a partir do que está mesmo a acontecer neste ciclo. Sinalizam o que vale a pena ver e ligam diretamente ao ecrã onde podes agir. Típicos: uma categoria acima da estimativa, um projeto atrasado face ao objetivo, um mês em défice nos teus planos, um gasto grande pontual que ainda não começaste a poupar, ou dívida cara que sai mais barato atacar do que manter.",
        "O como comparo coloca os teus gastos e poupança ao lado das médias nacionais para o teu país, escalão de rendimento e dimensão do agregado — a partir de estatísticas públicas (Eurostat e institutos nacionais), nunca de outros utilizadores. O valor é a perspetiva: mostra onde te destacas mesmo, para cima ou para baixo, para saberes que hábitos vale a pena mudar. É uma referência, não uma regra, e espera até o ciclo estar mais avançado antes de julgar, para o dia um não te fazer santo.",
        "O coach é um chat que já conhece os teus números — rendimento, excedente, dívidas, objetivos, planos, ativos — por isso o conselho é específico, não genérico. Faz-lhe perguntas reais: consigo comprar esta casa, amortizo este crédito ou invisto, o que faço com um bónus, estou no bom caminho. Segue princípios sólidos (rede de segurança, depois dívida cara, depois investir) e cita os números que usou. Ativa Breve para respostas curtas ou Análise profunda para uma resposta completa e ancorada em números. É um coach, não um consultor licenciado — para produtos regulados encaminha-te para um profissional.",
        "O devo comprar isto? é o coach no momento da tentação. Diz-lhe o que namoras, o preço e quanto o queres na escala Essencial → Miminho, e ele responde com honestidade: podes pagar já, o que custa aos teus objetivos e à reserva, à vista vs financiado se fizer sentido, e como fazer resultar se estiver renhido. Também pesa quanto já gastaste em miminhos neste ciclo — se andas a exagerar, sugere com jeito dormir sobre o assunto, premiando a contenção em vez de repreender. A mesma escala Essencial / Importante / Bom ter / Miminho com que podes marcar despesas alimenta isto, por isso quanto mais classificas, melhores as decisões.",
      ],
      [
        "bynku hace más que registrar números — lee tu situación y te ayuda a actuar. Cuatro funciones hacen casi todo ese trabajo, todas basadas en tus cifras reales, nunca genéricas.",
        "Los consejos y avisos son pequeñas señales con contexto en tu panel, generadas por lo que de verdad pasa este ciclo. Marcan lo que merece un vistazo y enlazan directo a la pantalla donde actuar. Típicos: una categoría por encima de su estimación, un proyecto atrasado respecto a su objetivo, un mes en déficit en tus planes, un gasto grande puntual que aún no empiezas a ahorrar, o deuda cara que sale más barato atacar que mantener.",
        "El cómo comparo coloca tu gasto y ahorro junto a las medias nacionales de tu país, tramo de ingresos y tamaño del hogar — a partir de estadísticas públicas (Eurostat e institutos nacionales), nunca de otros usuarios. Su valor es la perspectiva: muestra dónde destacas de verdad, arriba o abajo, para saber qué hábitos conviene cambiar. Es una referencia, no una regla, y espera a que el ciclo avance antes de juzgar, para que el día uno no te haga un santo.",
        "El asistente es un chat que ya conoce tus números — ingresos, excedente, deudas, objetivos, planes, activos — así que su consejo es específico, no de manual. Hazle preguntas reales: puedo permitirme esta casa, amortizo este préstamo o invierto, qué hago con un bonus, voy bien. Sigue principios sólidos (colchón, luego deuda cara, luego invertir) y cita las cifras que usó. Activa Breve para respuestas cortas o Pensar a fondo para una respuesta completa y basada en números. Es un asistente, no un asesor con licencia — para productos regulados te remite a un profesional.",
        "El ¿debería comprar esto? es el asistente en el momento de la tentación. Dile qué te tienta, el precio y cuánto lo quieres en la escala Esencial → Capricho, y responde con honestidad: puedes permitírtelo ahora, qué le cuesta a tus objetivos y colchón, al contado vs financiado si aplica, y cómo lograrlo si está justo. También pesa cuánto has gastado ya en caprichos este ciclo — si te estás dando muchos, sugiere con tacto consultarlo con la almohada, premiando la contención en vez de reñir. La misma escala Esencial / Importante / Estaría bien / Capricho con la que puedes etiquetar gastos lo alimenta, así que cuanto más clasificas, más afinadas las decisiones.",
      ],
      [
        "bynku erfasst nicht nur Zahlen — es liest deine Lage und hilft dir zu handeln. Vier Funktionen leisten das meiste davon, alle in deinen echten Zahlen verankert, nie generisch.",
        "Tipps und Hinweise sind kleine, kontextbezogene Anstöße auf deinem Dashboard, erzeugt aus dem, was in diesem Zyklus tatsächlich passiert. Sie markieren, was einen Blick wert ist, und verlinken direkt zum Bildschirm zum Handeln. Typisch: eine Kategorie über ihrer Schätzung, ein Projekt hinter dem Ziel, ein Defizitmonat in deinen Plänen, ein großer Einmalposten, für den du noch nicht sparst, oder teure Schuld, die billiger anzugehen als auszusitzen ist.",
        "Der Vergleich stellt deine Ausgaben und Ersparnisse neben nationale Durchschnitte für Land, Einkommensklasse und Haushaltsgröße — aus öffentlichen Statistiken (Eurostat und nationale Institute), nie von anderen Nutzern. Sein Wert ist die Perspektive: er zeigt, wo du wirklich heraussticht, hoch oder niedrig, damit du weißt, welche Gewohnheiten sich zu ändern lohnen. Eine Referenz, keine Regel, und er wartet, bis genug vom Zyklus vorbei ist, bevor er urteilt, damit Tag eins dich nicht heiligspricht.",
        "Der Coach ist ein Chat, der deine Zahlen bereits kennt — Einkommen, Überschuss, Schulden, Ziele, Pläne, Vermögen — also ist der Rat konkret, nicht Schema F. Stell echte Fragen: kann ich mir dieses Haus leisten, tilge ich diesen Kredit sonder oder investiere ich, was mache ich mit einem Bonus, bin ich auf Kurs. Er folgt soliden Prinzipien (Sicherheitsnetz, dann teure Schuld, dann investieren) und nennt die verwendeten Zahlen. Schalte Kurz für knappe Antworten oder Tiefes Nachdenken für eine volle, zahlengestützte Antwort. Ein Coach, kein zugelassener Berater — für regulierte Produkte verweist er auf eine Fachperson.",
        "Soll ich das kaufen? ist der Coach im Moment der Versuchung. Sag ihm, was dir vorschwebt, den Preis und wie sehr du es willst auf der Skala Notwendig → Vergnügen, und er antwortet ehrlich: kannst du es dir jetzt leisten, was es deine Ziele und dein Netz kostet, bar vs. finanziert falls relevant, und wie es klappt, wenn es knapp ist. Er wägt auch ab, wie viel du diesen Zyklus schon für Vergnügen ausgegeben hast — wenn du geschlemmt hast, schlägt er sanft vor, eine Nacht darüber zu schlafen, und belohnt Zurückhaltung statt zu tadeln. Dieselbe Skala Notwendig / Wichtig / Schön zu haben / Vergnügen, mit der du Ausgaben markieren kannst, speist das — je mehr du einordnest, desto treffsicherer die Urteile.",
      ],
      [
        "bynku ne fait pas qu'enregistrer des chiffres — il lit votre situation et vous aide à agir. Quatre fonctions font l'essentiel de ce travail, toutes ancrées dans vos vrais chiffres, jamais génériques.",
        "Les conseils et alertes sont de petits rappels contextuels sur votre tableau de bord, générés d'après ce qui se passe vraiment ce cycle. Ils signalent ce qui mérite un coup d'œil et mènent directement à l'écran où agir. Typiques : une catégorie au-dessus de son estimation, un projet en retard sur son objectif, un mois déficitaire dans vos plans, une grosse dépense ponctuelle non encore épargnée, ou une dette chère qu'il vaut mieux attaquer que subir.",
        "Le comment je me situe place vos dépenses et votre épargne à côté des moyennes nationales pour votre pays, tranche de revenu et taille du foyer — à partir de statistiques publiques (Eurostat et instituts nationaux), jamais d'autres utilisateurs. Sa valeur est la perspective : il montre où vous vous démarquez vraiment, en haut ou en bas, pour savoir quelles habitudes changer. Une référence, pas une règle, et il attend qu'assez du cycle soit passé avant de juger, pour que le jour un ne vous sacre pas saint.",
        "Le coach est une conversation qui connaît déjà vos chiffres — revenus, excédent, dettes, objectifs, plans, actifs — donc son conseil est précis, pas passe-partout. Posez de vraies questions : puis-je m'offrir cette maison, dois-je rembourser ce prêt ou investir, que faire d'une prime, suis-je sur la bonne voie. Il suit des principes sains (matelas, puis dette chère, puis investir) et cite les chiffres utilisés. Activez Bref pour des réponses courtes ou Réflexion approfondie pour une réponse complète et chiffrée. Un coach, pas un conseiller agréé — pour les produits réglementés, il vous renvoie à un professionnel.",
        "Le devrais-je acheter ceci ? est le coach au moment de la tentation. Dites-lui ce qui vous tente, le prix et à quel point vous le voulez sur l'échelle Essentiel → Petit plaisir, et il répond honnêtement : pouvez-vous vous le permettre maintenant, ce que cela coûte à vos objectifs et à votre matelas, comptant vs crédit le cas échéant, et comment y arriver si c'est juste. Il pèse aussi combien vous avez déjà dépensé en plaisirs ce cycle — si vous avez fait des écarts, il suggère avec tact d'y dormir, récompensant la retenue plutôt que de gronder. La même échelle Essentiel / Important / Agréable à avoir / Petit plaisir avec laquelle vous étiquetez les dépenses l'alimente : plus vous classez, plus les avis sont fins.",
      ],
    ),
    callout: L(
      "None of this replaces your judgement — it sharpens it. The numbers are yours; bynku just makes them easy to reason about.",
      "Nada disto substitui o teu discernimento — afia-o. Os números são teus; o bynku só os torna fáceis de pensar.",
      "Nada de esto sustituye tu criterio — lo afina. Los números son tuyos; bynku solo te los hace fáciles de razonar.",
      "Nichts davon ersetzt dein Urteil — es schärft es. Die Zahlen sind deine; bynku macht sie nur leicht durchdenkbar.",
      "Rien de tout cela ne remplace votre jugement — cela l'affine. Les chiffres sont les vôtres ; bynku les rend juste faciles à raisonner.",
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
