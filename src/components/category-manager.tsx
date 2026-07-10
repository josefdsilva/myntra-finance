import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCategories, useCategoryMutations, type Category } from "@/hooks/use-categories";

export function CategoryManager({ householdId }: { householdId: string }) {
  const { data: cats = [], isLoading } = useCategories(householdId);
  const { add, rename, remove } = useCategoryMutations(householdId);
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await add.mutateAsync(name);
      setNewName("");
      toast.success("Category added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>
          Add, rename, or remove expense categories for your household. Renaming updates all existing
          entries; deleting a category reassigns its entries to <em>other</em>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. pets, coffee, taxes"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button onClick={handleAdd} disabled={add.isPending || !newName.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {isLoading ? (
          <div className="h-20 rounded-md bg-muted animate-pulse" />
        ) : cats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {cats.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                onRename={(newName) =>
                  rename
                    .mutateAsync({ id: c.id, oldName: c.name, newName })
                    .then(() => toast.success("Renamed"))
                    .catch((e) => toast.error((e as Error).message))
                }
                onRemove={() =>
                  remove
                    .mutateAsync({ id: c.id, name: c.name })
                    .then(() => toast.success("Removed"))
                    .catch((e) => toast.error((e as Error).message))
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  cat,
  onRename,
  onRemove,
}: {
  cat: Category;
  onRename: (newName: string) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cat.name);

  async function save() {
    if (!value.trim() || value.trim() === cat.name) {
      setEditing(false);
      setValue(cat.name);
      return;
    }
    await onRename(value.trim());
    setEditing(false);
  }

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      {editing ? (
        <Input
          className="h-8"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setEditing(false);
              setValue(cat.name);
            }
          }}
          autoFocus
        />
      ) : (
        <span className="text-sm">{cat.name}</span>
      )}
      <div className="flex gap-1">
        {editing ? (
          <>
            <Button size="icon" variant="ghost" onClick={save}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue(cat.name);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete category "${cat.name}"? Existing entries will move to "other".`))
                  onRemove();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
