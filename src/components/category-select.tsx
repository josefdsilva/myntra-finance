import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCategoryNames, useCategoryMutations } from "@/hooks/use-categories";
import { useT } from "@/lib/i18n";

const CREATE_VALUE = "__create__";

/**
 * Category dropdown that also lets you create a category in place: pick
 * "New category…" and a small inline input appears. On save the category is
 * persisted for the household and immediately selected.
 */
export function CategorySelect({
  householdId,
  value,
  onChange,
  fallback = [],
  className,
  triggerClassName,
  disabled,
}: {
  householdId?: string;
  value: string;
  onChange: (v: string) => void;
  /** Options to show when the household has no categories yet. */
  fallback?: string[];
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const { names } = useCategoryNames(householdId);
  const { add } = useCategoryMutations(householdId);
  const options = names.length ? names : fallback;
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  async function save() {
    const clean = draft.trim().toLowerCase();
    if (!clean) {
      setCreating(false);
      return;
    }
    if (options.includes(clean)) {
      onChange(clean);
      setCreating(false);
      setDraft("");
      return;
    }
    try {
      await add.mutateAsync(clean);
      onChange(clean);
      toast.success(t("categoryMgr.addToast"));
      setCreating(false);
      setDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (creating) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        <Input
          className="h-9"
          autoFocus
          placeholder={t("categoryMgr.namePlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setCreating(false);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("common.save")}
          disabled={add.isPending || !draft.trim()}
          onClick={save}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("common.cancel")}
          onClick={() => {
            setCreating(false);
            setDraft("");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (v === CREATE_VALUE) {
          setCreating(true);
          return;
        }
        onChange(v);
      }}
    >
      <SelectTrigger className={triggerClassName ?? className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CREATE_VALUE}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {t("categorySelect.create")}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
