import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Heart } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  MAX_VALUES,
  VALUE_KEYS,
  valueDescKey,
  valueLabelKey,
  type HouseholdValue,
  type ValueKey,
} from "@/lib/values";

/**
 * "What is your money for?" — the household ranks up to three values. Order is
 * the rank (first tapped = most important), which is what makes the #1 value
 * strong enough to change how spending is judged. Nothing here is mandatory:
 * skipping just leaves the app on its neutral defaults.
 */
export function ValuesPicker({
  value,
  onChange,
  compact = false,
}: {
  value: HouseholdValue[];
  onChange: (next: HouseholdValue[]) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [other, setOther] = useState(
    value.find((v) => v.key === "other")?.text ?? "",
  );

  const chosen = (k: ValueKey | "other") => value.findIndex((v) => v.key === k);

  function toggle(k: ValueKey | "other", text?: string) {
    const idx = chosen(k);
    if (idx >= 0) {
      onChange(value.filter((_, i) => i !== idx));
      return;
    }
    if (value.length >= MAX_VALUES) return;
    onChange([...value, k === "other" ? { key: "other", text: text ?? null } : { key: k }]);
  }

  return (
    <div>
      {!compact && (
        <div className="mb-4">
          <p className="flex items-center gap-2 font-display text-xl">
            <Heart className="size-5 text-primary" /> {t("values.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("values.subtitle")}</p>
        </div>
      )}
      <p className="mb-2 text-xs text-muted-foreground">{t("values.pickHint")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {VALUE_KEYS.map((k) => {
          const rank = chosen(k);
          const on = rank >= 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={on}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                on ? "border-primary bg-primary/10" : "hover:bg-muted/60"
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  on ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
                }`}
              >
                {on ? rank + 1 : ""}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(valueLabelKey(k) as MessageKey)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(valueDescKey(k) as MessageKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={other}
          placeholder={t("values.otherPh")}
          onChange={(e) => setOther(e.target.value)}
        />
        <Button
          variant={chosen("other") >= 0 ? "default" : "outline"}
          size="sm"
          disabled={!other.trim() && chosen("other") < 0}
          onClick={() => toggle("other", other.trim() || undefined)}
        >
          <Check className="size-4" /> {t("values.other")}
        </Button>
      </div>
    </div>
  );
}
