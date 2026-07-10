import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, LogOut, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  createHousehold,
  listMyHouseholds,
  updateHousehold,
} from "@/lib/household.functions";
import { deleteHousehold, leaveHousehold } from "@/lib/privacy.functions";
import {
  setActiveHouseholdId,
  useActiveHouseholdId,
} from "@/lib/active-household";

export const Route = createFileRoute("/_authenticated/households")({
  head: () => ({ meta: [{ title: "Households · Myntra" }] }),
  component: HouseholdsPage,
});

function HouseholdsPage() {
  const qc = useQueryClient();
  const activeId = useActiveHouseholdId();
  const list = useServerFn(listMyHouseholds);
  const create = useServerFn(createHousehold);
  const rename = useServerFn(updateHousehold);
  const leave = useServerFn(leaveHousehold);
  const remove = useServerFn(deleteHousehold);

  const { data: households = [], isLoading } = useQuery({
    queryKey: ["my-households"],
    queryFn: () => list(),
  });

  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: (res) => {
      toast.success("Household created");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["my-households"] });
      setActiveHouseholdId(res.household.id);
      qc.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function switchTo(id: string) {
    setActiveHouseholdId(id);
    qc.clear();
    toast.success("Switched household");
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display flex items-center gap-2">
          <Users className="size-6" /> Households
        </h1>
        <p className="text-sm text-muted-foreground">
          You can belong to multiple households — for example your personal budget and a
          shared family budget. Data never crosses between them.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Create a new household
          </CardTitle>
          <CardDescription>
            Starts empty with the default buckets. You&apos;ll be its owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (!n) return;
              createMutation.mutate(n);
            }}
          >
            <div className="flex-1">
              <Label htmlFor="new-hh" className="sr-only">
                Household name
              </Label>
              <Input
                id="new-hh"
                placeholder="e.g. Family, Personal, Weekend house"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Your households</h2>
        {isLoading && <div className="h-24 rounded-lg bg-muted animate-pulse" />}
        {!isLoading && households.length === 0 && (
          <p className="text-sm text-muted-foreground">No households yet.</p>
        )}
        {households.map((h) => (
          <HouseholdCard
            key={h.household.id}
            id={h.household.id}
            name={h.household.name ?? "Untitled"}
            role={h.role}
            isActive={h.household.id === activeId}
            onSwitch={() => switchTo(h.household.id)}
            onRename={async (name) => {
              await rename({ data: { household_id: h.household.id, name } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              qc.invalidateQueries({ queryKey: ["household"] });
              toast.success("Renamed");
            }}
            onLeave={async () => {
              await leave({ data: { household_id: h.household.id } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              if (h.household.id === activeId) {
                setActiveHouseholdId(null);
                qc.clear();
              }
              toast.success("Left household");
            }}
            onDelete={async () => {
              await remove({ data: { household_id: h.household.id, confirm: "DELETE" } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              if (h.household.id === activeId) {
                setActiveHouseholdId(null);
                qc.clear();
              }
              toast.success("Household deleted");
            }}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Need to invite someone to a household you own? Open{" "}
        <Link to="/settings" className="underline">
          Settings
        </Link>
        {" "}→ Members while that household is active.
      </p>
    </div>
  );
}

function HouseholdCard(props: {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.name);
  const isOwner = props.role === "owner";

  async function saveRename() {
    const n = name.trim();
    if (!n || n === props.name) {
      setEditing(false);
      return;
    }
    try {
      await props.onRename(n);
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card className={props.isActive ? "border-primary/40" : undefined}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={100}
              />
              <Button size="sm" onClick={saveRename}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(props.name);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-medium truncate">{props.name}</div>
              {props.isActive && (
                <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary">
                  <Check className="size-3" /> active
                </span>
              )}
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {props.role}
              </span>
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {!props.isActive && (
              <Button size="sm" variant="outline" onClick={props.onSwitch}>
                Switch to
              </Button>
            )}
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Rename
              </Button>
            )}
            <LeaveOrDelete
              isOwner={isOwner}
              name={props.name}
              onLeave={props.onLeave}
              onDelete={props.onDelete}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveOrDelete(props: {
  isOwner: boolean;
  name: string;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
        >
          {props.isOwner ? (
            <>
              <Trash2 className="size-4" /> Delete
            </>
          ) : (
            <>
              <LogOut className="size-4" /> Leave
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {props.isOwner ? `Delete "${props.name}"?` : `Leave "${props.name}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {props.isOwner
              ? "This permanently deletes the household and every expense, bucket, income and member link inside it. This cannot be undone."
              : "You will no longer see this household's data. The owner can invite you back later."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                if (props.isOwner) await props.onDelete();
                else await props.onLeave();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {props.isOwner ? "Delete household" : "Leave"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
