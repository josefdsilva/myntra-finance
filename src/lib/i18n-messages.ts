export const SUPPORTED_LOCALES = ["en", "pt", "es", "de", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
};

export const LOCALE_NAMES_EN: Record<Locale, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  de: "German",
  fr: "French",
};

// Keep keys stable — used by t(key). English is the source of truth.
const en = {
  // Nav
  "nav.dashboard": "Dashboard",
  "nav.expenses": "Expenses",
  "nav.analysis": "Analysis",
  "nav.allocations": "Allocations",
  "nav.settings": "Settings",
  "nav.wiki": "Wiki",
  "nav.privacy": "Privacy",

  // Sidebar / top bar
  "shell.subtitle": "Budget & planning",
  "shell.lightTheme": "Light theme",
  "shell.darkTheme": "Dark theme",
  "shell.showNumbers": "Show numbers",
  "shell.hideNumbers": "Hide numbers",
  "shell.signOut": "Sign out",

  // Common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.edit": "Edit",
  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.language": "Language",
  "common.auto": "Auto (browser)",
  "common.saveChanges": "Save changes",
  "common.total": "Total",

  // Settings
  "settings.title": "Settings",
  "settings.subtitle": "Configure your household budget.",
  "settings.language.title": "Language",
  "settings.language.description":
    "Choose the language used across the app. AI coach replies also follow this choice.",
  "settings.language.autoNote": "Following your browser ({detected}).",
  "settings.loadError": "Couldn't load your household.",

  // Household
  "hh.title": "Household",
  "hh.description":
    "The monthly baseline is calculated from your fixed expenses, variable estimates and safety margin.",
  "hh.name": "Household name",
  "hh.safetyMargin": "Safety margin: {value}%",
  "hh.fixedMonthly": "Fixed monthly expenses",
  "hh.variableEst": "Estimated variable costs",
  "hh.marginRow": "Safety margin ({value}%)",
  "hh.baseline": "Monthly baseline",

  // Incomes
  "income.title": "Monthly income",
  "income.placeholder": "e.g. Alex salary",

  // Fixed expenses
  "fixed.title": "Fixed monthly expenses",
  "fixed.description": "Rent, loans, utilities, subscriptions.",
  "fixed.placeholder": "e.g. Rent",

  // Variable estimates
  "var.title": "Estimated variable costs",
  "var.description": "Groceries, fuel, transport, goods — what you typically spend per month.",
  "var.placeholder": "e.g. Groceries",

  // Buckets
  "buckets.title": "Allocation buckets",
  "buckets.description":
    "Distribute your surplus (income − baseline). % buckets currently total {pct}% of surplus.",
  "buckets.add": "Add bucket",
  "buckets.name": "Name",
  "buckets.color": "Color",
  "buckets.targetType": "Target type",
  "buckets.pctSurplus": "% of monthly surplus",
  "buckets.fixedMonthly": "Fixed € per month",
  "buckets.fixedYearly": "Fixed € per year",
  "buckets.goalByDate": "Goal € by date",
  "buckets.targetPct": "Target: {value}%",
  "buckets.goalAmount": "Goal amount (€)",
  "buckets.targetAmount": "Target amount (€)",
  "buckets.reachBy": "Reach by",
  "buckets.reachByHint": "Monthly contribution = goal ÷ months remaining.",

  // Members
  "members.title": "Household members",
  "members.description":
    "Both adults see the same budget. Invite your partner with a shareable link.",
  "members.inviteBtn": "Create invite link",
  "members.pending": "Pending invites",

  // Credit usage
  "credits.title": "Credit usage",
  "credits.description":
    "AI features (coach, voice/text/statement parsing) and Cloud infrastructure consume credits. Each household has its own monthly cap.",
  "credits.remaining": "{value} remaining",
  "credits.overBy": "Over by {value}",
  "credits.capNote": "Monthly cap is fixed at {cap} credits per household.",
  "credits.byFeature": "This month by feature",
  "credits.noActivity": "No AI or Cloud activity recorded yet this month.",
  "credits.recent": "Recent activity ({count})",
  "credits.pricingNote":
    "Credit costs are calculated from actual token counts (Gemini 3 Flash) and per-call transcription rates. These are estimates aligned with Lovable's AI Gateway pricing; final billing is settled at the workspace level.",

  // Notifications
  "notif.title": "Notifications",
  "notif.description": "Web push alerts about your budget. Each type is opt-in per member.",
  "notif.unsupported":
    "This browser doesn't support web push. On iPhone, add the app to the home screen first.",
  "notif.thisDevice": "This device",
  "notif.registered": "Registered for push.",
  "notif.notRegistered": "Not registered yet.",
  "notif.enable": "Enable",
  "notif.disable": "Disable",
  "notif.testThis": "Send test to this device",
  "notif.testAll": "Test all",
  "notif.removeAll": "Remove all",
  "notif.registeredDevices": "Registered devices ({count})",
  "notif.weeklyDigest": "Weekly digest",
  "notif.weeklyDigestDesc":
    "Monday 08:00 (Porto): last-week spending, top items, WoW change, AI outlook.",
  "notif.baselineWarn": "Baseline limit warnings",
  "notif.baselineWarnDesc": "Alert when the variable pool is at 80% and when it's fully consumed.",
  "notif.emergencyWarn": "Emergency pool warnings",
  "notif.emergencyWarnDesc": "Alert when overspend starts eating the monthly surplus (80% & 100%).",
  "notif.iosHint":
    "On iPhone, push only works from the app installed to the Home Screen (PWA). Regular Safari tabs cannot receive them.",

  // Danger zone
  "danger.title": "Privacy & erasure",
  "danger.description":
    "Under GDPR you can erase your data at any time. These actions are permanent. See our privacy notice for details.",
  "danger.export.title": "Export my data",
  "danger.export.body":
    "Download a JSON file containing your profile, memberships, and every record from the households you belong to (incomes, fixed costs, buckets, expenses, allocations, notifications). GDPR right to data portability.",
  "danger.export.button": "Download JSON",
  "danger.export.busy": "Preparing…",
  "danger.leave.title": "Leave this household",
  "danger.leave.body":
    "Remove yourself from “{name}”. Your personal account stays. Other members keep the shared data.",
  "danger.leave.button": "Leave household",
  "danger.leave.confirmTitle": "Leave “{name}”?",
  "danger.leave.confirmBody":
    "You will lose access to this household's budget, expenses, and buckets. If you are the only owner you must delete the household or promote another owner first.",
  "danger.leave.confirmAction": "Yes, leave",
  "danger.deleteHh.title": "Delete this household",
  "danger.deleteHh.body":
    "Permanently erase “{name}” and every associated record — incomes, fixed costs, buckets, expenses, allocations, invitations. This cannot be undone and also affects other members.",
  "danger.deleteHh.button": "Delete household",
  "danger.deleteHh.confirmTitle": "Delete “{name}”?",
  "danger.deleteHh.confirmBody":
    "This erases all financial data for every member of this household. Type DELETE to confirm.",
  "danger.deleteHh.action": "Permanently delete",
  "danger.deleteAcc.title": "Delete my account",
  "danger.deleteAcc.body":
    "Erase your account, profile, notification preferences, and all households where you are the only owner. In shared households your membership is removed and the remaining owner keeps the data.",
  "danger.deleteAcc.button": "Delete my account",
  "danger.deleteAcc.confirmTitle": "Erase your Myntra account?",
  "danger.deleteAcc.confirmBody":
    "This is your GDPR right to erasure. It cannot be undone. Households where you are the sole owner will also be deleted. Type DELETE MY ACCOUNT to confirm.",
  "danger.deleteAcc.action": "Permanently erase",
  "danger.confirmLabel": "Confirmation",
} as const;

export type MessageKey = keyof typeof en;

const pt: Record<MessageKey, string> = {
  "nav.dashboard": "Painel",
  "nav.expenses": "Despesas",
  "nav.analysis": "Análise",
  "nav.allocations": "Alocações",
  "nav.settings": "Definições",
  "nav.wiki": "Wiki",
  "nav.privacy": "Privacidade",

  "shell.subtitle": "Orçamento e planeamento",
  "shell.lightTheme": "Tema claro",
  "shell.darkTheme": "Tema escuro",
  "shell.showNumbers": "Mostrar valores",
  "shell.hideNumbers": "Ocultar valores",
  "shell.signOut": "Terminar sessão",

  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.add": "Adicionar",
  "common.edit": "Editar",
  "common.retry": "Tentar novamente",
  "common.loading": "A carregar…",
  "common.language": "Idioma",
  "common.auto": "Automático (navegador)",
  "common.saveChanges": "Guardar alterações",
  "common.total": "Total",

  "settings.title": "Definições",
  "settings.subtitle": "Configure o orçamento do agregado familiar.",
  "settings.language.title": "Idioma",
  "settings.language.description":
    "Escolha o idioma da aplicação. As respostas do assistente IA também seguem esta escolha.",
  "settings.language.autoNote": "A seguir o navegador ({detected}).",
  "settings.loadError": "Não foi possível carregar o agregado.",

  "hh.title": "Agregado familiar",
  "hh.description":
    "A base mensal é calculada a partir das despesas fixas, estimativas variáveis e margem de segurança.",
  "hh.name": "Nome do agregado",
  "hh.safetyMargin": "Margem de segurança: {value}%",
  "hh.fixedMonthly": "Despesas fixas mensais",
  "hh.variableEst": "Custos variáveis estimados",
  "hh.marginRow": "Margem de segurança ({value}%)",
  "hh.baseline": "Base mensal",

  "income.title": "Rendimento mensal",
  "income.placeholder": "ex.: Salário Alex",

  "fixed.title": "Despesas fixas mensais",
  "fixed.description": "Renda, empréstimos, utilidades, subscrições.",
  "fixed.placeholder": "ex.: Renda",

  "var.title": "Custos variáveis estimados",
  "var.description": "Compras, combustível, transportes, bens — o que costuma gastar por mês.",
  "var.placeholder": "ex.: Supermercado",

  "buckets.title": "Baldes de alocação",
  "buckets.description":
    "Distribua o excedente (rendimento − base). Os baldes em % somam atualmente {pct}% do excedente.",
  "buckets.add": "Adicionar balde",
  "buckets.name": "Nome",
  "buckets.color": "Cor",
  "buckets.targetType": "Tipo de objetivo",
  "buckets.pctSurplus": "% do excedente mensal",
  "buckets.fixedMonthly": "€ fixo por mês",
  "buckets.fixedYearly": "€ fixo por ano",
  "buckets.goalByDate": "Objetivo € até uma data",
  "buckets.targetPct": "Objetivo: {value}%",
  "buckets.goalAmount": "Valor do objetivo (€)",
  "buckets.targetAmount": "Valor alvo (€)",
  "buckets.reachBy": "Atingir até",
  "buckets.reachByHint": "Contribuição mensal = objetivo ÷ meses restantes.",

  "members.title": "Membros do agregado",
  "members.description":
    "Ambos os adultos veem o mesmo orçamento. Convide o parceiro com uma ligação partilhável.",
  "members.inviteBtn": "Criar link de convite",
  "members.pending": "Convites pendentes",

  "credits.title": "Utilização de créditos",
  "credits.description":
    "As funcionalidades de IA (assistente, análise de voz/texto/extratos) e a infraestrutura Cloud consomem créditos. Cada agregado tem o seu limite mensal.",
  "credits.remaining": "{value} restantes",
  "credits.overBy": "Excesso de {value}",
  "credits.capNote": "O limite mensal está fixado em {cap} créditos por agregado.",
  "credits.byFeature": "Este mês por funcionalidade",
  "credits.noActivity": "Sem atividade de IA ou Cloud registada este mês.",
  "credits.recent": "Atividade recente ({count})",
  "credits.pricingNote":
    "Os custos são calculados a partir de tokens reais (Gemini 3 Flash) e das taxas por chamada de transcrição. São estimativas alinhadas com o AI Gateway da Lovable; a faturação final é feita ao nível do workspace.",

  "notif.title": "Notificações",
  "notif.description": "Alertas por push sobre o seu orçamento. Cada tipo é opcional por membro.",
  "notif.unsupported":
    "Este navegador não suporta push. No iPhone, adicione a app ao ecrã principal primeiro.",
  "notif.thisDevice": "Este dispositivo",
  "notif.registered": "Registado para push.",
  "notif.notRegistered": "Ainda não registado.",
  "notif.enable": "Ativar",
  "notif.disable": "Desativar",
  "notif.testThis": "Enviar teste para este dispositivo",
  "notif.testAll": "Testar todos",
  "notif.removeAll": "Remover todos",
  "notif.registeredDevices": "Dispositivos registados ({count})",
  "notif.weeklyDigest": "Resumo semanal",
  "notif.weeklyDigestDesc":
    "Segunda 08:00 (Porto): gastos da semana, principais itens, variação semanal, perspetiva IA.",
  "notif.baselineWarn": "Avisos de limite da base",
  "notif.baselineWarnDesc":
    "Alerta quando o pool variável atinge 80% e quando está totalmente consumido.",
  "notif.emergencyWarn": "Avisos do pool de emergência",
  "notif.emergencyWarnDesc":
    "Alerta quando o excesso começa a consumir o excedente mensal (80% e 100%).",
  "notif.iosHint":
    "No iPhone, o push só funciona a partir da app instalada no ecrã principal (PWA). Separadores Safari normais não recebem notificações.",

  "danger.title": "Privacidade e apagamento",
  "danger.description":
    "Ao abrigo do RGPD pode apagar os seus dados a qualquer momento. Estas ações são permanentes. Consulte a nossa política de privacidade.",
  "danger.export.title": "Exportar os meus dados",
  "danger.export.body":
    "Descarregue um ficheiro JSON com o seu perfil, associações e todos os registos dos agregados a que pertence (rendimentos, custos fixos, baldes, despesas, alocações, notificações). Direito RGPD à portabilidade.",
  "danger.export.button": "Descarregar JSON",
  "danger.export.busy": "A preparar…",
  "danger.leave.title": "Sair deste agregado",
  "danger.leave.body":
    "Remove-o de “{name}”. A sua conta pessoal mantém-se. Os outros membros conservam os dados partilhados.",
  "danger.leave.button": "Sair do agregado",
  "danger.leave.confirmTitle": "Sair de “{name}”?",
  "danger.leave.confirmBody":
    "Vai perder acesso ao orçamento, despesas e baldes deste agregado. Se for o único proprietário, tem de eliminar o agregado ou promover outro proprietário primeiro.",
  "danger.leave.confirmAction": "Sim, sair",
  "danger.deleteHh.title": "Eliminar este agregado",
  "danger.deleteHh.body":
    "Apaga permanentemente “{name}” e todos os registos associados — rendimentos, custos fixos, baldes, despesas, alocações, convites. Não pode ser desfeito e afeta os outros membros.",
  "danger.deleteHh.button": "Eliminar agregado",
  "danger.deleteHh.confirmTitle": "Eliminar “{name}”?",
  "danger.deleteHh.confirmBody":
    "Isto apaga todos os dados financeiros de todos os membros do agregado. Escreva DELETE para confirmar.",
  "danger.deleteHh.action": "Eliminar permanentemente",
  "danger.deleteAcc.title": "Eliminar a minha conta",
  "danger.deleteAcc.body":
    "Apaga a sua conta, perfil, preferências de notificação e todos os agregados onde é o único proprietário. Em agregados partilhados a sua associação é removida e o proprietário restante mantém os dados.",
  "danger.deleteAcc.button": "Eliminar a minha conta",
  "danger.deleteAcc.confirmTitle": "Apagar a sua conta Myntra?",
  "danger.deleteAcc.confirmBody":
    "Este é o seu direito ao apagamento (RGPD). Não pode ser desfeito. Agregados onde é o único proprietário também serão eliminados. Escreva DELETE MY ACCOUNT para confirmar.",
  "danger.deleteAcc.action": "Apagar permanentemente",
  "danger.confirmLabel": "Confirmação",
};

const es: Record<MessageKey, string> = {
  "nav.dashboard": "Panel",
  "nav.expenses": "Gastos",
  "nav.analysis": "Análisis",
  "nav.allocations": "Asignaciones",
  "nav.settings": "Ajustes",
  "nav.wiki": "Wiki",
  "nav.privacy": "Privacidad",

  "shell.subtitle": "Presupuesto y planificación",
  "shell.lightTheme": "Tema claro",
  "shell.darkTheme": "Tema oscuro",
  "shell.showNumbers": "Mostrar cifras",
  "shell.hideNumbers": "Ocultar cifras",
  "shell.signOut": "Cerrar sesión",

  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.add": "Añadir",
  "common.edit": "Editar",
  "common.retry": "Reintentar",
  "common.loading": "Cargando…",
  "common.language": "Idioma",
  "common.auto": "Automático (navegador)",
  "common.saveChanges": "Guardar cambios",
  "common.total": "Total",

  "settings.title": "Ajustes",
  "settings.subtitle": "Configura el presupuesto de tu hogar.",
  "settings.language.title": "Idioma",
  "settings.language.description":
    "Elige el idioma usado en la aplicación. Las respuestas del asistente IA también lo seguirán.",
  "settings.language.autoNote": "Siguiendo tu navegador ({detected}).",
  "settings.loadError": "No se pudo cargar tu hogar.",

  "hh.title": "Hogar",
  "hh.description":
    "La base mensual se calcula a partir de tus gastos fijos, estimaciones variables y margen de seguridad.",
  "hh.name": "Nombre del hogar",
  "hh.safetyMargin": "Margen de seguridad: {value}%",
  "hh.fixedMonthly": "Gastos fijos mensuales",
  "hh.variableEst": "Costes variables estimados",
  "hh.marginRow": "Margen de seguridad ({value}%)",
  "hh.baseline": "Base mensual",

  "income.title": "Ingresos mensuales",
  "income.placeholder": "p. ej. Salario de Alex",

  "fixed.title": "Gastos fijos mensuales",
  "fixed.description": "Alquiler, préstamos, servicios, suscripciones.",
  "fixed.placeholder": "p. ej. Alquiler",

  "var.title": "Costes variables estimados",
  "var.description": "Compra, combustible, transporte, bienes — lo que sueles gastar al mes.",
  "var.placeholder": "p. ej. Compra",

  "buckets.title": "Cubos de asignación",
  "buckets.description":
    "Distribuye tu excedente (ingresos − base). Los cubos en % suman actualmente el {pct}% del excedente.",
  "buckets.add": "Añadir cubo",
  "buckets.name": "Nombre",
  "buckets.color": "Color",
  "buckets.targetType": "Tipo de objetivo",
  "buckets.pctSurplus": "% del excedente mensual",
  "buckets.fixedMonthly": "€ fijo al mes",
  "buckets.fixedYearly": "€ fijo al año",
  "buckets.goalByDate": "Meta € para una fecha",
  "buckets.targetPct": "Objetivo: {value}%",
  "buckets.goalAmount": "Importe objetivo (€)",
  "buckets.targetAmount": "Importe objetivo (€)",
  "buckets.reachBy": "Alcanzar para",
  "buckets.reachByHint": "Aporte mensual = meta ÷ meses restantes.",

  "members.title": "Miembros del hogar",
  "members.description":
    "Ambos adultos ven el mismo presupuesto. Invita a tu pareja con un enlace.",
  "members.inviteBtn": "Crear enlace de invitación",
  "members.pending": "Invitaciones pendientes",

  "credits.title": "Uso de créditos",
  "credits.description":
    "Las funciones de IA (asistente, análisis de voz/texto/extractos) y la infraestructura Cloud consumen créditos. Cada hogar tiene su propio límite mensual.",
  "credits.remaining": "{value} restantes",
  "credits.overBy": "Excedido en {value}",
  "credits.capNote": "El límite mensual está fijado en {cap} créditos por hogar.",
  "credits.byFeature": "Este mes por función",
  "credits.noActivity": "Sin actividad de IA o Cloud registrada este mes.",
  "credits.recent": "Actividad reciente ({count})",
  "credits.pricingNote":
    "Los costes se calculan a partir de tokens reales (Gemini 3 Flash) y tarifas por llamada de transcripción. Son estimaciones alineadas con el AI Gateway de Lovable; la facturación final se liquida a nivel de workspace.",

  "notif.title": "Notificaciones",
  "notif.description": "Alertas push web sobre tu presupuesto. Cada tipo es opcional por miembro.",
  "notif.unsupported":
    "Este navegador no admite push web. En iPhone, añade la app a la pantalla de inicio primero.",
  "notif.thisDevice": "Este dispositivo",
  "notif.registered": "Registrado para push.",
  "notif.notRegistered": "Aún no registrado.",
  "notif.enable": "Activar",
  "notif.disable": "Desactivar",
  "notif.testThis": "Enviar prueba a este dispositivo",
  "notif.testAll": "Probar todos",
  "notif.removeAll": "Eliminar todos",
  "notif.registeredDevices": "Dispositivos registrados ({count})",
  "notif.weeklyDigest": "Resumen semanal",
  "notif.weeklyDigestDesc":
    "Lunes 08:00 (Porto): gasto de la semana anterior, principales artículos, cambio semanal, perspectiva IA.",
  "notif.baselineWarn": "Avisos de límite de base",
  "notif.baselineWarnDesc": "Alerta cuando el pool variable llega al 80% y cuando se agota.",
  "notif.emergencyWarn": "Avisos del pool de emergencia",
  "notif.emergencyWarnDesc":
    "Alerta cuando el sobregasto empieza a consumir el excedente mensual (80% y 100%).",
  "notif.iosHint":
    "En iPhone, el push solo funciona desde la app instalada en la pantalla de inicio (PWA). Las pestañas normales de Safari no pueden recibirlas.",

  "danger.title": "Privacidad y borrado",
  "danger.description":
    "Según el RGPD puedes borrar tus datos en cualquier momento. Estas acciones son permanentes. Consulta nuestra política de privacidad.",
  "danger.export.title": "Exportar mis datos",
  "danger.export.body":
    "Descarga un archivo JSON con tu perfil, membresías y todos los registros de los hogares a los que perteneces (ingresos, costes fijos, cubos, gastos, asignaciones, notificaciones). Derecho RGPD a la portabilidad.",
  "danger.export.button": "Descargar JSON",
  "danger.export.busy": "Preparando…",
  "danger.leave.title": "Salir de este hogar",
  "danger.leave.body":
    "Elimínate de “{name}”. Tu cuenta personal se mantiene. Los demás miembros conservan los datos compartidos.",
  "danger.leave.button": "Salir del hogar",
  "danger.leave.confirmTitle": "¿Salir de “{name}”?",
  "danger.leave.confirmBody":
    "Perderás el acceso al presupuesto, gastos y cubos del hogar. Si eres el único propietario debes eliminar el hogar o promover otro propietario primero.",
  "danger.leave.confirmAction": "Sí, salir",
  "danger.deleteHh.title": "Eliminar este hogar",
  "danger.deleteHh.body":
    "Borra permanentemente “{name}” y todos los registros asociados — ingresos, costes fijos, cubos, gastos, asignaciones, invitaciones. No se puede deshacer y también afecta a otros miembros.",
  "danger.deleteHh.button": "Eliminar hogar",
  "danger.deleteHh.confirmTitle": "¿Eliminar “{name}”?",
  "danger.deleteHh.confirmBody":
    "Esto borra todos los datos financieros de todos los miembros del hogar. Escribe DELETE para confirmar.",
  "danger.deleteHh.action": "Eliminar permanentemente",
  "danger.deleteAcc.title": "Eliminar mi cuenta",
  "danger.deleteAcc.body":
    "Borra tu cuenta, perfil, preferencias de notificaciones y todos los hogares donde eres el único propietario. En hogares compartidos se elimina tu membresía y el propietario restante conserva los datos.",
  "danger.deleteAcc.button": "Eliminar mi cuenta",
  "danger.deleteAcc.confirmTitle": "¿Borrar tu cuenta Myntra?",
  "danger.deleteAcc.confirmBody":
    "Es tu derecho de supresión (RGPD). No se puede deshacer. Los hogares donde eres el único propietario también se eliminarán. Escribe DELETE MY ACCOUNT para confirmar.",
  "danger.deleteAcc.action": "Borrar permanentemente",
  "danger.confirmLabel": "Confirmación",
};

const de: Record<MessageKey, string> = {
  "nav.dashboard": "Übersicht",
  "nav.expenses": "Ausgaben",
  "nav.analysis": "Analyse",
  "nav.allocations": "Zuweisungen",
  "nav.settings": "Einstellungen",
  "nav.wiki": "Wiki",
  "nav.privacy": "Datenschutz",

  "shell.subtitle": "Budget & Planung",
  "shell.lightTheme": "Helles Design",
  "shell.darkTheme": "Dunkles Design",
  "shell.showNumbers": "Zahlen anzeigen",
  "shell.hideNumbers": "Zahlen ausblenden",
  "shell.signOut": "Abmelden",

  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.add": "Hinzufügen",
  "common.edit": "Bearbeiten",
  "common.retry": "Erneut versuchen",
  "common.loading": "Wird geladen…",
  "common.language": "Sprache",
  "common.auto": "Automatisch (Browser)",
  "common.saveChanges": "Änderungen speichern",
  "common.total": "Gesamt",

  "settings.title": "Einstellungen",
  "settings.subtitle": "Verwalte das Haushaltsbudget.",
  "settings.language.title": "Sprache",
  "settings.language.description":
    "Wähle die Sprache der App. Auch der KI-Coach antwortet in dieser Sprache.",
  "settings.language.autoNote": "Folgt deinem Browser ({detected}).",
  "settings.loadError": "Haushalt konnte nicht geladen werden.",

  "hh.title": "Haushalt",
  "hh.description":
    "Die monatliche Basis wird aus deinen Fixkosten, variablen Schätzungen und dem Sicherheitszuschlag berechnet.",
  "hh.name": "Haushaltsname",
  "hh.safetyMargin": "Sicherheitszuschlag: {value}%",
  "hh.fixedMonthly": "Monatliche Fixkosten",
  "hh.variableEst": "Geschätzte variable Kosten",
  "hh.marginRow": "Sicherheitszuschlag ({value}%)",
  "hh.baseline": "Monatliche Basis",

  "income.title": "Monatliches Einkommen",
  "income.placeholder": "z. B. Gehalt Alex",

  "fixed.title": "Monatliche Fixkosten",
  "fixed.description": "Miete, Kredite, Nebenkosten, Abos.",
  "fixed.placeholder": "z. B. Miete",

  "var.title": "Geschätzte variable Kosten",
  "var.description":
    "Lebensmittel, Kraftstoff, Transport, Waren — was du normalerweise pro Monat ausgibst.",
  "var.placeholder": "z. B. Lebensmittel",

  "buckets.title": "Zuweisungs-Töpfe",
  "buckets.description":
    "Verteile deinen Überschuss (Einkommen − Basis). %-Töpfe ergeben aktuell {pct}% des Überschusses.",
  "buckets.add": "Topf hinzufügen",
  "buckets.name": "Name",
  "buckets.color": "Farbe",
  "buckets.targetType": "Zielart",
  "buckets.pctSurplus": "% des monatlichen Überschusses",
  "buckets.fixedMonthly": "Fixe € pro Monat",
  "buckets.fixedYearly": "Fixe € pro Jahr",
  "buckets.goalByDate": "Ziel € bis Datum",
  "buckets.targetPct": "Ziel: {value}%",
  "buckets.goalAmount": "Zielbetrag (€)",
  "buckets.targetAmount": "Zielbetrag (€)",
  "buckets.reachBy": "Erreichen bis",
  "buckets.reachByHint": "Monatlicher Beitrag = Ziel ÷ verbleibende Monate.",

  "members.title": "Haushaltsmitglieder",
  "members.description":
    "Beide Erwachsenen sehen dasselbe Budget. Lade deinen Partner mit einem Link ein.",
  "members.inviteBtn": "Einladungslink erstellen",
  "members.pending": "Offene Einladungen",

  "credits.title": "Credit-Verbrauch",
  "credits.description":
    "KI-Funktionen (Coach, Sprach-/Text-/Kontoauszug-Analyse) und Cloud-Infrastruktur verbrauchen Credits. Jeder Haushalt hat eine eigene monatliche Obergrenze.",
  "credits.remaining": "{value} verbleibend",
  "credits.overBy": "Überzogen um {value}",
  "credits.capNote": "Die Monatsgrenze liegt fest bei {cap} Credits pro Haushalt.",
  "credits.byFeature": "Diesen Monat nach Funktion",
  "credits.noActivity": "Diesen Monat noch keine KI- oder Cloud-Aktivität.",
  "credits.recent": "Letzte Aktivität ({count})",
  "credits.pricingNote":
    "Kosten werden aus echten Token-Zahlen (Gemini 3 Flash) und Transkriptions-Tarifen berechnet. Schätzungen gemäß Lovable AI Gateway; die endgültige Abrechnung erfolgt auf Workspace-Ebene.",

  "notif.title": "Benachrichtigungen",
  "notif.description": "Web-Push zu deinem Budget. Jede Art ist pro Mitglied optional.",
  "notif.unsupported":
    "Dieser Browser unterstützt kein Web-Push. Auf dem iPhone die App zunächst zum Home-Bildschirm hinzufügen.",
  "notif.thisDevice": "Dieses Gerät",
  "notif.registered": "Für Push registriert.",
  "notif.notRegistered": "Noch nicht registriert.",
  "notif.enable": "Aktivieren",
  "notif.disable": "Deaktivieren",
  "notif.testThis": "Test an dieses Gerät senden",
  "notif.testAll": "Alle testen",
  "notif.removeAll": "Alle entfernen",
  "notif.registeredDevices": "Registrierte Geräte ({count})",
  "notif.weeklyDigest": "Wöchentliche Zusammenfassung",
  "notif.weeklyDigestDesc":
    "Montag 08:00 (Porto): Ausgaben der letzten Woche, Top-Posten, WoW-Änderung, KI-Ausblick.",
  "notif.baselineWarn": "Basis-Warnungen",
  "notif.baselineWarnDesc":
    "Warnung, wenn der variable Pool 80% erreicht und vollständig verbraucht ist.",
  "notif.emergencyWarn": "Notfall-Pool-Warnungen",
  "notif.emergencyWarnDesc":
    "Warnung, wenn Überziehungen den monatlichen Überschuss aufzehren (80% & 100%).",
  "notif.iosHint":
    "Auf dem iPhone funktioniert Push nur aus der zum Home-Bildschirm hinzugefügten App (PWA). Normale Safari-Tabs können keine empfangen.",

  "danger.title": "Datenschutz & Löschung",
  "danger.description":
    "Nach DSGVO kannst du deine Daten jederzeit löschen. Diese Aktionen sind endgültig. Details in unserer Datenschutzerklärung.",
  "danger.export.title": "Meine Daten exportieren",
  "danger.export.body":
    "Lade eine JSON-Datei mit deinem Profil, Mitgliedschaften und allen Datensätzen der Haushalte herunter, in denen du bist (Einkommen, Fixkosten, Töpfe, Ausgaben, Zuweisungen, Benachrichtigungen). DSGVO-Recht auf Datenübertragbarkeit.",
  "danger.export.button": "JSON herunterladen",
  "danger.export.busy": "Wird vorbereitet…",
  "danger.leave.title": "Diesen Haushalt verlassen",
  "danger.leave.body":
    "Entferne dich aus „{name}“. Dein persönliches Konto bleibt bestehen. Andere Mitglieder behalten die geteilten Daten.",
  "danger.leave.button": "Haushalt verlassen",
  "danger.leave.confirmTitle": "„{name}“ verlassen?",
  "danger.leave.confirmBody":
    "Du verlierst den Zugriff auf Budget, Ausgaben und Töpfe. Bist du einziger Eigentümer, musst du zuerst den Haushalt löschen oder einen anderen Eigentümer ernennen.",
  "danger.leave.confirmAction": "Ja, verlassen",
  "danger.deleteHh.title": "Diesen Haushalt löschen",
  "danger.deleteHh.body":
    "Löscht „{name}“ und alle zugehörigen Datensätze dauerhaft — Einkommen, Fixkosten, Töpfe, Ausgaben, Zuweisungen, Einladungen. Nicht rückgängig zu machen und betrifft auch andere Mitglieder.",
  "danger.deleteHh.button": "Haushalt löschen",
  "danger.deleteHh.confirmTitle": "„{name}“ löschen?",
  "danger.deleteHh.confirmBody":
    "Dies löscht alle Finanzdaten aller Mitglieder. Zum Bestätigen DELETE eingeben.",
  "danger.deleteHh.action": "Endgültig löschen",
  "danger.deleteAcc.title": "Mein Konto löschen",
  "danger.deleteAcc.body":
    "Löscht dein Konto, Profil, Benachrichtigungseinstellungen und alle Haushalte, in denen du einziger Eigentümer bist. In geteilten Haushalten wird deine Mitgliedschaft entfernt, der verbleibende Eigentümer behält die Daten.",
  "danger.deleteAcc.button": "Mein Konto löschen",
  "danger.deleteAcc.confirmTitle": "Myntra-Konto löschen?",
  "danger.deleteAcc.confirmBody":
    "Dein Recht auf Löschung (DSGVO). Nicht rückgängig zu machen. Haushalte, in denen du einziger Eigentümer bist, werden ebenfalls gelöscht. Zum Bestätigen DELETE MY ACCOUNT eingeben.",
  "danger.deleteAcc.action": "Endgültig löschen",
  "danger.confirmLabel": "Bestätigung",
};

const fr: Record<MessageKey, string> = {
  "nav.dashboard": "Tableau de bord",
  "nav.expenses": "Dépenses",
  "nav.analysis": "Analyse",
  "nav.allocations": "Répartitions",
  "nav.settings": "Paramètres",
  "nav.wiki": "Wiki",
  "nav.privacy": "Confidentialité",

  "shell.subtitle": "Budget et planification",
  "shell.lightTheme": "Thème clair",
  "shell.darkTheme": "Thème sombre",
  "shell.showNumbers": "Afficher les montants",
  "shell.hideNumbers": "Masquer les montants",
  "shell.signOut": "Se déconnecter",

  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.add": "Ajouter",
  "common.edit": "Modifier",
  "common.retry": "Réessayer",
  "common.loading": "Chargement…",
  "common.language": "Langue",
  "common.auto": "Automatique (navigateur)",
  "common.saveChanges": "Enregistrer les modifications",
  "common.total": "Total",

  "settings.title": "Paramètres",
  "settings.subtitle": "Configurez le budget du foyer.",
  "settings.language.title": "Langue",
  "settings.language.description":
    "Choisissez la langue de l'application. Le coach IA répondra également dans cette langue.",
  "settings.language.autoNote": "Suit votre navigateur ({detected}).",
  "settings.loadError": "Impossible de charger votre foyer.",

  "hh.title": "Foyer",
  "hh.description":
    "La base mensuelle est calculée à partir des dépenses fixes, des estimations variables et de la marge de sécurité.",
  "hh.name": "Nom du foyer",
  "hh.safetyMargin": "Marge de sécurité : {value}%",
  "hh.fixedMonthly": "Dépenses fixes mensuelles",
  "hh.variableEst": "Coûts variables estimés",
  "hh.marginRow": "Marge de sécurité ({value}%)",
  "hh.baseline": "Base mensuelle",

  "income.title": "Revenu mensuel",
  "income.placeholder": "ex. Salaire d'Alex",

  "fixed.title": "Dépenses fixes mensuelles",
  "fixed.description": "Loyer, prêts, factures, abonnements.",
  "fixed.placeholder": "ex. Loyer",

  "var.title": "Coûts variables estimés",
  "var.description":
    "Courses, carburant, transport, biens — ce que vous dépensez habituellement chaque mois.",
  "var.placeholder": "ex. Courses",

  "buckets.title": "Enveloppes de répartition",
  "buckets.description":
    "Répartissez votre excédent (revenu − base). Les enveloppes en % totalisent actuellement {pct}% de l'excédent.",
  "buckets.add": "Ajouter une enveloppe",
  "buckets.name": "Nom",
  "buckets.color": "Couleur",
  "buckets.targetType": "Type d'objectif",
  "buckets.pctSurplus": "% de l'excédent mensuel",
  "buckets.fixedMonthly": "€ fixes par mois",
  "buckets.fixedYearly": "€ fixes par an",
  "buckets.goalByDate": "Objectif € à une date",
  "buckets.targetPct": "Objectif : {value}%",
  "buckets.goalAmount": "Montant de l'objectif (€)",
  "buckets.targetAmount": "Montant cible (€)",
  "buckets.reachBy": "Atteindre pour",
  "buckets.reachByHint": "Contribution mensuelle = objectif ÷ mois restants.",

  "members.title": "Membres du foyer",
  "members.description":
    "Les deux adultes voient le même budget. Invitez votre partenaire par lien.",
  "members.inviteBtn": "Créer un lien d'invitation",
  "members.pending": "Invitations en attente",

  "credits.title": "Utilisation des crédits",
  "credits.description":
    "Les fonctions IA (coach, analyse voix/texte/relevés) et l'infrastructure Cloud consomment des crédits. Chaque foyer a son propre plafond mensuel.",
  "credits.remaining": "{value} restants",
  "credits.overBy": "Dépassé de {value}",
  "credits.capNote": "Le plafond mensuel est fixé à {cap} crédits par foyer.",
  "credits.byFeature": "Ce mois par fonction",
  "credits.noActivity": "Aucune activité IA ou Cloud enregistrée ce mois-ci.",
  "credits.recent": "Activité récente ({count})",
  "credits.pricingNote":
    "Les coûts sont calculés à partir des jetons réels (Gemini 3 Flash) et des tarifs de transcription par appel. Estimations alignées sur AI Gateway de Lovable ; la facturation finale est réglée au niveau du workspace.",

  "notif.title": "Notifications",
  "notif.description":
    "Notifications web push sur votre budget. Chaque type est optionnel par membre.",
  "notif.unsupported":
    "Ce navigateur ne prend pas en charge le push web. Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil.",
  "notif.thisDevice": "Cet appareil",
  "notif.registered": "Enregistré pour le push.",
  "notif.notRegistered": "Pas encore enregistré.",
  "notif.enable": "Activer",
  "notif.disable": "Désactiver",
  "notif.testThis": "Envoyer un test à cet appareil",
  "notif.testAll": "Tout tester",
  "notif.removeAll": "Tout supprimer",
  "notif.registeredDevices": "Appareils enregistrés ({count})",
  "notif.weeklyDigest": "Résumé hebdomadaire",
  "notif.weeklyDigestDesc":
    "Lundi 08:00 (Porto) : dépenses de la semaine, principaux postes, évolution S/S, perspective IA.",
  "notif.baselineWarn": "Alertes de limite de base",
  "notif.baselineWarnDesc": "Alerte quand le pool variable atteint 80% et quand il est épuisé.",
  "notif.emergencyWarn": "Alertes du pool d'urgence",
  "notif.emergencyWarnDesc": "Alerte quand le dépassement entame l'excédent mensuel (80% et 100%).",
  "notif.iosHint":
    "Sur iPhone, le push ne fonctionne que depuis l'app installée à l'écran d'accueil (PWA). Les onglets Safari classiques ne peuvent pas les recevoir.",

  "danger.title": "Confidentialité et effacement",
  "danger.description":
    "Selon le RGPD, vous pouvez effacer vos données à tout moment. Ces actions sont définitives. Voir notre politique de confidentialité.",
  "danger.export.title": "Exporter mes données",
  "danger.export.body":
    "Téléchargez un fichier JSON avec votre profil, adhésions et tous les enregistrements des foyers dont vous faites partie (revenus, coûts fixes, enveloppes, dépenses, répartitions, notifications). Droit RGPD à la portabilité.",
  "danger.export.button": "Télécharger le JSON",
  "danger.export.busy": "Préparation…",
  "danger.leave.title": "Quitter ce foyer",
  "danger.leave.body":
    "Se retirer de « {name} ». Votre compte personnel reste. Les autres membres conservent les données partagées.",
  "danger.leave.button": "Quitter le foyer",
  "danger.leave.confirmTitle": "Quitter « {name} » ?",
  "danger.leave.confirmBody":
    "Vous perdrez l'accès au budget, aux dépenses et aux enveloppes. Si vous êtes le seul propriétaire, vous devez d'abord supprimer le foyer ou promouvoir un autre propriétaire.",
  "danger.leave.confirmAction": "Oui, quitter",
  "danger.deleteHh.title": "Supprimer ce foyer",
  "danger.deleteHh.body":
    "Efface définitivement « {name} » et tous les enregistrements associés — revenus, coûts fixes, enveloppes, dépenses, répartitions, invitations. Irréversible et affecte aussi les autres membres.",
  "danger.deleteHh.button": "Supprimer le foyer",
  "danger.deleteHh.confirmTitle": "Supprimer « {name} » ?",
  "danger.deleteHh.confirmBody":
    "Ceci efface toutes les données financières de tous les membres. Tapez DELETE pour confirmer.",
  "danger.deleteHh.action": "Supprimer définitivement",
  "danger.deleteAcc.title": "Supprimer mon compte",
  "danger.deleteAcc.body":
    "Efface votre compte, profil, préférences de notifications et tous les foyers dont vous êtes le seul propriétaire. Dans les foyers partagés, votre adhésion est retirée et le propriétaire restant conserve les données.",
  "danger.deleteAcc.button": "Supprimer mon compte",
  "danger.deleteAcc.confirmTitle": "Effacer votre compte Myntra ?",
  "danger.deleteAcc.confirmBody":
    "C'est votre droit à l'effacement (RGPD). Irréversible. Les foyers dont vous êtes le seul propriétaire seront aussi supprimés. Tapez DELETE MY ACCOUNT pour confirmer.",
  "danger.deleteAcc.action": "Effacer définitivement",
  "danger.confirmLabel": "Confirmation",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, pt, es, de, fr };
