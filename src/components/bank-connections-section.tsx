import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  bankIntegrationStatus,
  listBankConnections,
  createBankConnection,
  deleteBankConnection,
  toggleBankAccountSync,
  syncBankConnection,
} from "@/lib/bank-connections.functions";

/**
 * "Linked banks" panel for Settings.
 *
 * Households can add any number of connections. Sync is opt-in per account
 * and every fetched transaction lands in the Inbox for approval — the hybrid
 * model we agreed on: manual entry, statement import, or bank auto-sync,
 * all merging in one review queue with no duplicate risk.
 */
export function BankConnectionsSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(bankIntegrationStatus);
  const listFn = useServerFn(listBankConnections);
  const createFn = useServerFn(createBankConnection);
  const delFn = useServerFn(deleteBankConnection);
  const toggleFn = useServerFn(toggleBankAccountSync);
  const syncFn = useServerFn(syncBankConnection);

  const status = useQuery({ queryKey: ["bank-status"], queryFn: () => statusFn() });
  const connections = useQuery({
    queryKey: ["bank-connections", householdId],
    queryFn: () => listFn({ data: { householdId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bank-connections", householdId] });
    qc.invalidateQueries({ queryKey: ["inbox", householdId] });
  };

  const createMut = useMutation({
    mutationFn: (input: {
      provider: "mock" | "gocardless";
      institution_name: string;
    }) => createFn({ data: { householdId, ...input } }),
    onSuccess: (res) => {
      toast.success(`Linked. Discovered ${res.accountsAdded} account(s).`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (connectionId: string) =>
      delFn({ data: { householdId, connectionId } }),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
  });

  const toggleMut = useMutation({
    mutationFn: (v: { accountId: string; enabled: boolean }) =>
      toggleFn({ data: { householdId, ...v } }),
    onSuccess: invalidate,
  });

  const syncMut = useMutation({
    mutationFn: (connectionId: string) =>
      syncFn({ data: { householdId, connectionId } }),
    onSuccess: (res) => {
      toast.success(
        `${res.staged} new to review${res.skipped ? ` (${res.skipped} already recorded)` : ""}`,
      );
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Linked banks</CardTitle>
          </div>
          <AddConnectionDialog
            gocardlessAvailable={!!status.data?.gocardlessAvailable}
            onSubmit={(v) => createMut.mutate(v)}
            pending={createMut.isPending}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Optional. Auto-fetch transactions from your bank; nothing is added to
          your budget until you approve it in the Inbox. You can also import
          statements or record entries manually — all three flow through the
          same review queue.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(connections.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No banks linked yet. Use the mock connection to try the flow — it
            creates two sample accounts with a handful of transactions.
          </p>
        ) : null}
        {(connections.data ?? []).map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.institution_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.provider === "mock" ? "Mock provider" : "GoCardless"}
                  {c.last_synced_at
                    ? ` · last synced ${new Date(c.last_synced_at).toLocaleString()}`
                    : " · never synced"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate(c.id)}
                disabled={syncMut.isPending}
              >
                <RefreshCw className="mr-2 h-3 w-3" /> Sync
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${c.institution_name}?`)) delMut.mutate(c.id);
                }}
                aria-label="Remove connection"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {c.bank_accounts?.length ? (
              <div className="mt-3 space-y-2">
                {c.bank_accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded bg-muted/50 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.iban_last4 ? `•••• ${a.iban_last4}` : ""}
                        {a.currency ? ` · ${a.currency}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`sync-${a.id}`} className="text-xs">
                        Auto-sync
                      </Label>
                      <Switch
                        id={`sync-${a.id}`}
                        checked={!!a.sync_enabled}
                        onCheckedChange={(v) =>
                          toggleMut.mutate({ accountId: a.id, enabled: v })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddConnectionDialog({
  gocardlessAvailable,
  onSubmit,
  pending,
}: {
  gocardlessAvailable: boolean;
  onSubmit: (v: { provider: "mock" | "gocardless"; institution_name: string }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"mock" | "gocardless">("mock");
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-3 w-3" /> Link bank
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "mock" | "gocardless")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Mock (try it out)</SelectItem>
                <SelectItem value="gocardless" disabled={!gocardlessAvailable}>
                  GoCardless (PSD2){!gocardlessAvailable ? " — coming soon" : ""}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Mock creates a fake bank with sample transactions so you can see
              the review flow end-to-end without giving up any real credentials.
            </p>
          </div>
          <div>
            <Label>Nickname</Label>
            <Input
              value={name}
              placeholder="e.g. Millennium checking"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || pending}
            onClick={() => {
              onSubmit({ provider, institution_name: name.trim() });
              setOpen(false);
              setName("");
            }}
          >
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
