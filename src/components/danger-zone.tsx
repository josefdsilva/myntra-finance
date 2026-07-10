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

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" /> Privacy &amp; erasure
        </CardTitle>
        <CardDescription>
          Under GDPR you can erase your data at any time. These actions are permanent.
          See our{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            privacy notice
          </a>{" "}
          for details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExportDataRow />
        <LeaveHouseholdRow householdId={householdId} householdName={householdName} />
        {isOwner && (
          <DeleteHouseholdRow householdId={householdId} householdName={householdName} />
        )}
        <DeleteAccountRow />
      </CardContent>
    </Card>
  );
}

function ExportDataRow() {
  const doExport = useServerFn(exportMyData);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const payload = await doExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `myntra-export-${ts}.json`;
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
    <RowShell
      title="Export my data"
      body="Download a JSON file containing your profile, memberships, and every record from the households you belong to (incomes, fixed costs, buckets, expenses, allocations, notifications). GDPR right to data portability."
    >
      <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
        <Download className="size-4" /> {busy ? "Preparing…" : "Download JSON"}
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
      title="Leave this household"
      body={`Remove yourself from “${householdName}”. Your personal account stays. Other members keep the shared data.`}
    >
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">Leave household</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave “{householdName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this household's budget, expenses, and buckets.
              If you are the only owner you must delete the household or promote another owner first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={onLeave}>
              Yes, leave
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
      title="Delete this household"
      body={`Permanently erase “${householdName}” and every associated record — incomes, fixed costs, buckets, expenses, allocations, invitations. This cannot be undone and also affects other members.`}
      danger
    >
      <AlertDialog onOpenChange={() => setConfirm("")}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">Delete household</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{householdName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases all financial data for every member of this household.
              Type <strong>DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="confirm-hh">Confirmation</Label>
            <Input
              id="confirm-hh"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirm !== "DELETE"}
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Permanently delete
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
    <RowShell
      title="Delete my account"
      body="Erase your account, profile, notification preferences, and all households where you are the only owner. In shared households your membership is removed and the remaining owner keeps the data."
      danger
    >
      <AlertDialog onOpenChange={() => setConfirm("")}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">Delete my account</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase your Myntra account?</AlertDialogTitle>
            <AlertDialogDescription>
              This is your GDPR right to erasure. It cannot be undone. Households where you
              are the sole owner will also be deleted. Type <strong>DELETE MY ACCOUNT</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="confirm-acc">Confirmation</Label>
            <Input
              id="confirm-acc"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirm !== "DELETE MY ACCOUNT"}
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Permanently erase
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
