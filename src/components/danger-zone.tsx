import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  deleteHousehold,
  deleteMyAccount,
  exportMyData,
  leaveHousehold,
} from "@/lib/privacy.functions";
import { useT } from "@/lib/i18n";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type Props = {
  householdId: string;
  householdName: string;
  role: "owner" | "member" | string;
};

export function DangerZone({ householdId, householdName, role }: Props) {
  const isOwner = role === "owner";
  const t = useT();

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" /> {t("danger.title")}
        </CardTitle>
        <CardDescription>
          {t("danger.description")}{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            {t("nav.privacy").toLowerCase()}
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExportDataRow />
        <LeaveHouseholdRow householdId={householdId} householdName={householdName} />
        {isOwner && <DeleteHouseholdRow householdId={householdId} householdName={householdName} />}
        <DeleteAccountRow />
      </CardContent>
    </Card>
  );
}

function ExportDataRow() {
  const doExport = useServerFn(exportMyData);
  const [busy, setBusy] = useState(false);
  const t = useT();

  async function onExport() {
    setBusy(true);
    try {
      const payload = await doExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `bynku-export-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RowShell title={t("danger.export.title")} body={t("danger.export.body")}>
      <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
        <Download className="size-4" /> {busy ? t("danger.export.busy") : t("danger.export.button")}
      </Button>
    </RowShell>
  );
}

function LeaveHouseholdRow({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const leave = useServerFn(leaveHousehold);
  const [busy, setBusy] = useState(false);
  const t = useT();

  async function onLeave() {
    setBusy(true);
    try {
      await leave({ data: { household_id: householdId } });
      toast.success("You left the household.");
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to leave");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RowShell
      title={t("danger.leave.title")}
      body={t("danger.leave.body", { name: householdName })}
    >
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            {t("danger.leave.button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("danger.leave.confirmTitle", { name: householdName })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("danger.leave.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={onLeave}>
              {t("danger.leave.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowShell>
  );
}

function DeleteHouseholdRow({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const del = useServerFn(deleteHousehold);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();

  async function onDelete() {
    setBusy(true);
    try {
      await del({ data: { household_id: householdId, confirm: "DELETE" } });
      toast.success("Household deleted.");
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RowShell
      title={t("danger.deleteHh.title")}
      body={t("danger.deleteHh.body", { name: householdName })}
      danger
    >
      <AlertDialog onOpenChange={() => setConfirm("")}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            {t("danger.deleteHh.button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("danger.deleteHh.confirmTitle", { name: householdName })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("danger.deleteHh.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="confirm-hh">{t("danger.confirmLabel")}</Label>
            <Input
              id="confirm-hh"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirm !== "DELETE"}
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("danger.deleteHh.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowShell>
  );
}

function DeleteAccountRow() {
  const del = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const t = useT();

  async function onDelete() {
    setBusy(true);
    try {
      await del({ data: { confirm: "DELETE MY ACCOUNT" } });
      await supabase.auth.signOut().catch(() => {});
      toast.success("Your account and personal data have been erased.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RowShell title={t("danger.deleteAcc.title")} body={t("danger.deleteAcc.body")} danger>
      <AlertDialog onOpenChange={() => setConfirm("")}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            {t("danger.deleteAcc.button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("danger.deleteAcc.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("danger.deleteAcc.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="confirm-acc">{t("danger.confirmLabel")}</Label>
            <Input
              id="confirm-acc"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirm !== "DELETE MY ACCOUNT"}
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("danger.deleteAcc.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowShell>
  );
}

function RowShell({
  title,
  body,
  danger,
  children,
}: {
  title: string;
  body: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${
        danger ? "border-destructive/30 bg-destructive/5" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
