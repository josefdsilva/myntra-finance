import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useT, type MessageKey } from "@/lib/i18n";
import { PERSON_ROLES } from "@/lib/values";
import { listPeople, upsertPerson, deletePerson } from "@/lib/people.functions";

/**
 * Who is in the household — first name, age and occupation. Entirely optional;
 * when present it tells the journey how far away school fees or retirement are,
 * and how thick the safety net should be.
 */
export function PeopleEditor({
  householdId,
  compact = false,
}: {
  householdId: string;
  compact?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const fetchPeople = useServerFn(listPeople);
  const save = useServerFn(upsertPerson);
  const remove = useServerFn(deletePerson);

  const { data: people = [] } = useQuery({
    queryKey: ["household-people", householdId],
    queryFn: () => fetchPeople({ data: { household_id: householdId } }),
  });

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState<string>("employed");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["household-people", householdId] });

  async function add() {
    if (busy) return;
    setBusy(true);
    try {
      await save({
        data: {
          household_id: householdId,
          name: name.trim() || null,
          age: age ? Number(age) : null,
          role: role as never,
          sort_order: people.length,
        },
      });
      setName("");
      setAge("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!compact && (
        <div className="mb-4">
          <p className="flex items-center gap-2 font-display text-xl">
            <Users className="size-5 text-primary" /> {t("people.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("people.subtitle")}</p>
        </div>
      )}

      <div className="space-y-2">
        {people.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("people.empty")}</p>
        )}
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {p.name || t("people.name")}
            </span>
            <span className="text-xs text-muted-foreground">
              {p.age != null ? p.age : "-"} · {t(`people.role.${p.role}` as MessageKey)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("people.remove")}
              onClick={async () => {
                await remove({ data: { id: p.id } });
                await refresh();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input
          className="min-w-32 flex-1"
          placeholder={t("people.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="w-20"
          type="number"
          min={0}
          max={120}
          placeholder={t("people.age")}
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-44" aria-label={t("people.role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSON_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`people.role.${r}` as MessageKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={busy}>
          <Plus className="size-4" /> {t("people.add")}
        </Button>
      </div>
    </div>
  );
}
