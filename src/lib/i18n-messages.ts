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

  // Settings
  "settings.title": "Settings",
  "settings.subtitle": "Configure your household budget.",
  "settings.language.title": "Language",
  "settings.language.description": "Choose the language used across the app. AI coach replies also follow this choice.",
  "settings.language.autoNote": "Following your browser ({detected}).",
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

  "settings.title": "Definições",
  "settings.subtitle": "Configure o orçamento do agregado familiar.",
  "settings.language.title": "Idioma",
  "settings.language.description": "Escolha o idioma da aplicação. As respostas do assistente IA também seguem esta escolha.",
  "settings.language.autoNote": "A seguir o navegador ({detected}).",
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

  "settings.title": "Ajustes",
  "settings.subtitle": "Configura el presupuesto de tu hogar.",
  "settings.language.title": "Idioma",
  "settings.language.description": "Elige el idioma usado en la aplicación. Las respuestas del asistente IA también lo seguirán.",
  "settings.language.autoNote": "Siguiendo tu navegador ({detected}).",
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

  "settings.title": "Einstellungen",
  "settings.subtitle": "Verwalte das Haushaltsbudget.",
  "settings.language.title": "Sprache",
  "settings.language.description": "Wähle die Sprache der App. Auch der KI-Coach antwortet in dieser Sprache.",
  "settings.language.autoNote": "Folgt deinem Browser ({detected}).",
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

  "settings.title": "Paramètres",
  "settings.subtitle": "Configurez le budget du foyer.",
  "settings.language.title": "Langue",
  "settings.language.description": "Choisissez la langue de l'application. Le coach IA répondra également dans cette langue.",
  "settings.language.autoNote": "Suit votre navigateur ({detected}).",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, pt, es, de, fr };
