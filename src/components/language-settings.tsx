import { useI18n, SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";

const AUTO = "__auto";

export function LanguageSettings() {
  const { locale, isAuto, setLocale, t } = useI18n();
  const value = isAuto ? AUTO : locale;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="size-4" /> {t("settings.language.title")}
        </CardTitle>
        <CardDescription>{t("settings.language.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select
          value={value}
          onValueChange={(v) => setLocale(v === AUTO ? "auto" : (v as Locale))}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t("common.auto")}</SelectItem>
            {SUPPORTED_LOCALES.map((l) => (
              <SelectItem key={l} value={l}>
                {LOCALE_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAuto && (
          <p className="text-xs text-muted-foreground">
            {t("settings.language.autoNote", { detected: LOCALE_LABELS[locale] })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
