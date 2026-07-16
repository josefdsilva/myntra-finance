import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, LogOut, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pageShellClass } from "@/components/page-shell";
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

import { createHousehold, listMyHouseholds, updateHousehold } from "@/lib/household.functions";
import { deleteHousehold, leaveHousehold } from "@/lib/privacy.functions";
import { setActiveHouseholdId, useActiveHouseholdId } from "@/lib/active-household";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/households")({
  head: () => ({ meta: [{ title: "Households · bynku" }] }),
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
  const t = useT();

  const { data: households = [], isLoading } = useQuery({
    queryKey: ["my-households"],
    queryFn: () => list(),
  });

  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: (res) => {
      toast.success(t("households.createdToast"));
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
    toast.success(t("households.switchedToast"));
  }

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl font-display flex items-center gap-2">
          <Users className="size-6" /> {t("households.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("households.description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> {t("households.createTitle")}
          </CardTitle>
          <CardDescription>{t("households.createDescription")}</CardDescription>
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
                {t("households.nameSrLabel")}
              </Label>
              <Input
                id="new-hh"
                placeholder={t("households.namePlaceholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? t("households.creating") : t("households.create")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">{t("households.yourHouseholds")}</h2>
        {isLoading && <div className="h-24 rounded-lg bg-muted animate-pulse" />}
        {!isLoading && households.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("households.noHouseholds")}</p>
        )}
        {households.map((h) => (
          <HouseholdCard
            key={h.household.id}
            id={h.household.id}
            name={h.household.name ?? t("households.untitled")}
            role={h.role}
            isActive={h.household.id === activeId}
            onSwitch={() => switchTo(h.household.id)}
            onRename={async (name) => {
              await rename({ data: { household_id: h.household.id, name } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              qc.invalidateQueries({ queryKey: ["household"] });
              toast.success(t("households.renamedToast"));
            }}
            onLeave={async () => {
              await leave({ data: { household_id: h.household.id } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              if (h.household.id === activeId) {
                setActiveHouseholdId(null);
                qc.clear();
              }
              toast.success(t("households.leftToast"));
            }}
            onDelete={async () => {
              await remove({ data: { household_id: h.household.id, confirm: "DELETE" } });
              qc.invalidateQueries({ queryKey: ["my-households"] });
              if (h.household.id === activeId) {
                setActiveHouseholdId(null);
                qc.clear();
              }
              toast.success(t("households.deletedToast"));
            }}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("households.inviteHint", {
          settingsLink: t("households.settingsLink"),
        })}
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
  const t = useT();

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
                {t("households.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(props.name);
                  setEditing(false);
                }}
              >
                {t("households.cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-medium truncate">{props.name}</div>
              {props.isActive && (
                <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary">
                  <Check className="size-3" /> {t("households.active")}
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
                {t("households.switchTo")}
              </Button>
            )}
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {t("households.rename")}
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
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          {props.isOwner ? (
            <>
              <Trash2 className="size-4" /> {t("households.delete")}
            </>
          ) : (
            <>
              <LogOut className="size-4" /> {t("households.leave")}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {props.isOwner
              ? t("households.deleteConfirmTitle", { name: props.name })
              : t("households.leaveConfirmTitle", { name: props.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {props.isOwner ? t("households.deleteConfirmBody") : t("households.leaveConfirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("households.cancel")}</AlertDialogCancel>
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
            {props.isOwner ? t("households.deleteHousehold") : t("households.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
