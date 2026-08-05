import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * AI transparency primitives (EU AI Act, Art. 50).
 *
 * `AiBadge` labels a surface whose content was produced by bynku's AI, with a
 * tooltip that says it can be inaccurate and is educational, not regulated
 * advice. `AiNotice` is the inline first-interaction disclosure for two-way
 * chat surfaces (Art. 50(1) — "you are interacting with an AI").
 *
 * Only use these on genuinely AI-generated surfaces. Rule-based, deterministic
 * output (e.g. the computed tips list) must NOT be labelled as AI.
 *
 * `AiBadge` carries its own `TooltipProvider` so it works anywhere without
 * depending on an app-wide provider being mounted.
 */
export function AiBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={t("ai.aria.label")}
            className={cn(
              "inline-flex select-none items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-medium leading-none text-primary",
              className,
            )}
          >
            <Sparkles className="size-2.5" aria-hidden="true" />
            {t("ai.badge.label")}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[16rem] text-xs leading-relaxed">
          {t("ai.badge.tooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AiNotice({ className }: { className?: string }) {
  const t = useT();
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{t("ai.chat.notice")}</span>
    </div>
  );
}
