import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Free-form multi-label input. Adds a label on Enter, comma, or blur.
export function LabelsInput({
  value,
  onChange,
  placeholder = "e.g. holidays, birthday party",
  suggestions = [],
}: {
  value: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    const set = new Set(value);
    for (const p of parts) set.add(p);
    onChange(Array.from(set).slice(0, 20));
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(l: string) {
    onChange(value.filter((x) => x !== l));
  }

  const suggestionPool = suggestions.filter((s) => !value.includes(s)).slice(0, 6);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 items-center rounded-md border bg-background px-2 py-1.5 min-h-9 focus-within:ring-2 focus-within:ring-ring">
        {value.map((l) => (
          <span
            key={l}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
          >
            {l}
            <button
              type="button"
              onClick={() => remove(l)}
              className="hover:opacity-70"
              aria-label={`Remove ${l}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Input
          className="border-0 shadow-none focus-visible:ring-0 h-6 px-1 flex-1 min-w-32"
          placeholder={value.length ? "" : placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && commit(draft)}
        />
      </div>
      {suggestionPool.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestionPool.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
