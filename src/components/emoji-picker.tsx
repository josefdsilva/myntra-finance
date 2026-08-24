import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

/** Curated emoji sets for money goals — short, tappable, no external library. */
const GROUPS: Array<{ key: string; items: string[] }> = [
  {
    key: "emoji.group.goals",
    items: ["🛟", "💰", "🏦", "📈", "🎯", "🐷", "💎", "🧾", "🪙", "🔐"],
  },
  {
    key: "emoji.group.life",
    items: ["🏖️", "✈️", "🏝️", "🚗", "🏠", "🛠️", "🎓", "📚", "💍", "🎉"],
  },
  {
    key: "emoji.group.family",
    items: ["👶", "🧒", "👨‍👩‍👧", "🐶", "🐱", "⚽", "🎨", "🎸", "🚲", "🏥"],
  },
  {
    key: "emoji.group.more",
    items: ["❤️", "🌱", "🌍", "🍽️", "☕", "🎁", "💻", "📱", "⛰️", "🔥"],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

export function EmojiPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
  ariaLabel?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const groups = useMemo(() => GROUPS, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-12 px-0 text-base"
          aria-label={ariaLabel ?? t("emoji.pick")}
        >
          {value || "🙂"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="start">
        {groups.map((g) => (
          <div key={g.key} className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t(g.key as never)}
            </p>
            <div className="grid grid-cols-10 gap-0.5">
              {g.items.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onChange(e);
                    setOpen(false);
                  }}
                  aria-label={e}
                  className={`h-7 w-7 rounded text-base leading-none hover:bg-accent ${
                    value === e ? "bg-accent ring-1 ring-primary" : ""
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Input
            value={custom}
            onChange={(ev) => setCustom(ev.target.value.slice(0, 4))}
            placeholder={t("emoji.custom")}
            className="h-8 flex-1 text-base"
            aria-label={t("emoji.custom")}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!custom.trim()}
            onClick={() => {
              onChange(custom.trim());
              setCustom("");
              setOpen(false);
            }}
          >
            {t("common.save")}
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          {t("emoji.clear")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export const EMOJI_SUGGESTIONS = ALL;
