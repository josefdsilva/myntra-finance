import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, Trash2, Landmark, ExternalLink, Loader2 } from "lucide-react";
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
  listGoCardlessInstitutions,
  startGoCardlessLink,
  finalizeGoCardlessLink,
} from "@/lib/bank-connections.functions";

/**
 * "Linked banks" panel for Settings.
 *
 * Two provider paths converge here:
 *  - Mock: instant local fake bank for demoing the review flow.
 *  - GoCardless: real PSD2. Pick country → bank → hosted consent link. On
 *    return we call finalize to enumerate the granted accounts.
 * All fetched transactions still land in the Inbox for approval — no direct
 * writes to `expenses`.
 */
export function BankConnectionsSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(bankIntegrationStatus);
  const listFn = useServerFn(listBankConnections);
  const createFn = useServerFn(createBankConnection);
  const delFn = useServerFn(deleteBankConnection);
  const toggleFn = useServerFn(toggleBankAccountSync);
  const syncFn = useServerFn(syncBankConnection);
  const finalizeFn = useServerFn(finalizeGoCardlessLink);

  const status = useQuery({ queryKey: ["bank-status"], queryFn: () => statusFn() });
  const connections = useQuery({
    queryKey: ["bank-connections", householdId],
    queryFn: () => listFn({ data: { householdId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bank-connections", householdId] });
    qc.invalidateQueries({ queryKey: ["inbox", householdId] });
  };

  // -- callback handling: /settings?bank_linked=<connectionId>
  const [finalizing, setFinalizing] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const linked = url.searchParams.get("bank_linked");
    const err = url.searchParams.get("bank_error");
    if (err) {
      toast.error(`Bank link failed: ${err}`);
      url.searchParams.delete("bank_error");
      window.history.replaceState({}, "", url.toString());
      return;
    }
    if (!linked) return;
    setFinalizing(linked);
    finalizeFn({ data: { householdId, connectionId: linked } })
      .then((res) => {
        toast.success(`Bank linked. ${res.accountsAdded} account(s) added.`);
        invalidate();
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Could not finalize bank link"),
      )
      .finally(() => {
        setFinalizing(null);
        const clean = new URL(window.location.href);
        clean.searchParams.delete("bank_linked");
        window.history.replaceState({}, "", clean.toString());
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const createMockMut = useMutation({
    mutationFn: (input: { institution_name: string }) =>
      createFn({ data: { householdId, provider: "mock", ...input } }),
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
            enableBankingAvailable={!!status.data?.enableBankingAvailable}
            householdId={householdId}
            onMockSubmit={(v) => createMockMut.mutate(v)}
            mockPending={createMockMut.isPending}
          />

        </div>
        <p className="text-sm text-muted-foreground">
          Optional. Auto-fetch transactions from your bank; nothing is added
          to your budget until you approve it in the Inbox. You can also
          import statements or record entries manually — all three flow
          through the same review queue.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {finalizing ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finishing bank link…
          </div>
        ) : null}
        {(connections.data ?? []).length === 0 && !finalizing ? (
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
                  {c.status === "pending" ? " · pending consent" : ""}
                  {c.last_synced_at
                    ? ` · last synced ${new Date(c.last_synced_at).toLocaleString()}`
                    : c.status !== "pending"
                      ? " · never synced"
                      : ""}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate(c.id)}
                disabled={syncMut.isPending || c.status === "pending"}
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
                        {a.last_balance != null
                          ? ` · ${a.last_balance.toLocaleString(undefined, { style: "currency", currency: a.currency || "EUR" })}`
                          : ""}
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
            ) : c.provider === "gocardless" && c.status === "pending" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Waiting for you to finish consent on your bank. Delete this
                entry if you want to start over.
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// GoCardless is available in most EU/EEA + UK countries. Keep this list
// short and human — users don't need every ISO code, just the common ones.
const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Spain" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "IE", label: "Ireland" },
  { code: "BE", label: "Belgium" },
  { code: "AT", label: "Austria" },
  { code: "PL", label: "Poland" },
  { code: "SE", label: "Sweden" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "GB", label: "United Kingdom" },
];

function AddConnectionDialog({
  gocardlessAvailable,
  enableBankingAvailable,
  householdId,
  onMockSubmit,
  mockPending,
}: {
  gocardlessAvailable: boolean;
  enableBankingAvailable: boolean;
  householdId: string;
  onMockSubmit: (v: { institution_name: string }) => void;
  mockPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Default to the first genuinely available real provider, else mock.
  const [provider, setProvider] = useState<"mock" | "gocardless" | "enablebanking">(
    enableBankingAvailable
      ? "enablebanking"
      : gocardlessAvailable
        ? "gocardless"
        : "mock",
  );
  const [mockName, setMockName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-3 w-3" /> Link bank
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link a bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) =>
                setProvider(v as "mock" | "gocardless" | "enablebanking")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enablebanking" disabled={!enableBankingAvailable}>
                  Real bank (Enable Banking · PSD2)
                  {!enableBankingAvailable ? " — coming soon" : ""}
                </SelectItem>
                <SelectItem value="gocardless" disabled={!gocardlessAvailable}>
                  Real bank (GoCardless · PSD2)
                  {!gocardlessAvailable ? " — coming soon" : ""}
                </SelectItem>
                <SelectItem value="mock">Mock (try the flow)</SelectItem>
              </SelectContent>
            </Select>
            {!enableBankingAvailable && !gocardlessAvailable ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Direct bank sync is being migrated to Enable Banking and
                will be back shortly. In the meantime you can import
                statements or add entries manually — everything still lands
                in the same Inbox for approval.
              </p>
            ) : null}
          </div>


          {provider === "mock" ? (
            <>
              <div>
                <Label>Nickname</Label>
                <Input
                  value={mockName}
                  placeholder="e.g. Test checking"
                  onChange={(e) => setMockName(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Creates a fake bank with sample transactions so you can see
                  the review flow without giving up real credentials.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!mockName.trim() || mockPending}
                  onClick={() => {
                    onMockSubmit({ institution_name: mockName.trim() });
                    setOpen(false);
                    setMockName("");
                  }}
                >
                  Link
                </Button>
              </DialogFooter>
            </>
          ) : (
            <GoCardlessPicker
              householdId={householdId}
              onCancel={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoCardlessPicker({
  householdId,
  onCancel,
}: {
  householdId: string;
  onCancel: () => void;
}) {
  const listInstitutionsFn = useServerFn(listGoCardlessInstitutions);
  const startLinkFn = useServerFn(startGoCardlessLink);

  const [country, setCountry] = useState<string>("PT");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const institutions = useQuery({
    queryKey: ["gc-institutions", country],
    queryFn: () => listInstitutionsFn({ data: { country } }),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const list = institutions.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => i.name.toLowerCase().includes(q));
  }, [institutions.data, filter]);

  const start = async (inst: { id: string; name: string }) => {
    try {
      setPending(inst.id);
      const res = await startLinkFn({
        data: { householdId, institution_id: inst.id, institution_name: inst.name },
      });
      // Full-page navigation so the bank site can redirect us straight
      // back to /api/public/bank/callback → /settings.
      window.location.assign(res.link);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start bank link");
      setPending(null);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <Input
              placeholder="e.g. Millennium"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          {institutions.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading banks…
            </div>
          ) : institutions.isError ? (
            <p className="p-3 text-sm text-destructive">
              {institutions.error instanceof Error
                ? institutions.error.message
                : "Failed to load institutions"}
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No banks match your search.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((inst) => (
                <li key={inst.id}>
                  <button
                    type="button"
                    onClick={() => start(inst)}
                    disabled={pending !== null}
                    className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted/50 disabled:opacity-50"
                  >
                    {inst.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={inst.logo}
                        alt=""
                        className="h-8 w-8 rounded object-contain"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {inst.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {inst.transaction_total_days}d history
                      </div>
                    </div>
                    {pending === inst.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          You'll be sent to your bank to authorize read-only access to
          balances and transactions. Consent typically lasts 90–180 days;
          you can revoke it anytime from your bank.
        </p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={pending !== null}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  );
}
