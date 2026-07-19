import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox as InboxIcon, Check, X, RefreshCw, ChevronDown, Link2, AlertTriangle, Repeat } from "lucide-react";
import { toast } from "sonner";

import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import {
  listInbox,
  approveInboxItems,
  dismissInboxItems,
  mergeInboxItem,
  suggestInboxMatches,
  suggestFixedMatches,
} from "@/lib/inbox.functions";


import {
  listBankConnections,
  syncBankConnection,
} from "@/lib/bank-connections.functions";
import { useCategories } from "@/hooks/use-categories";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · bynku" },
      {
        name: "description",
        content:
          "Review and approve auto-captured transactions before they hit your budget.",
      },
    ],
  }),
  component: InboxPage,
});

type PendingRow = Awaited<ReturnType<typeof listInbox>>[number];

function InboxPage() {
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () =>
      fetchHh({
        data: activeHouseholdId ? { household_id: activeHouseholdId } : {},
      }),
  });
  const householdId = hh?.household?.id;
  return householdId ? (
    <InboxBody householdId={householdId} />
  ) : (
    <div className={pageShellClass("3xl")}>
      <InboxHeader />
      <Skeleton className="h-40" />
    </div>
  );
}

function InboxHeader({ pendingCount }: { pendingCount?: number }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <InboxIcon className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Inbox</h1>
        {pendingCount !== undefined ? (
          <Badge variant="secondary">{pendingCount} pending</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Bank sync and statement imports land here first. Nothing counts against
        your budget until you approve it — so recurring fixed costs and cash
        entries you logged manually never double-count.
      </p>
    </header>
  );
}

function InboxBody({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listInbox);
  const approveFn = useServerFn(approveInboxItems);
  const dismissFn = useServerFn(dismissInboxItems);
  const listConnFn = useServerFn(listBankConnections);
  const syncFn = useServerFn(syncBankConnection);
  const mergeFn = useServerFn(mergeInboxItem);
  const suggestFn = useServerFn(suggestInboxMatches);
  const suggestFixedFn = useServerFn(suggestFixedMatches);



  const inboxQuery = useQuery({
    queryKey: ["inbox", householdId],
    queryFn: () => listFn({ data: { householdId, status: "pending" } }),
  });
  const conns = useQuery({
    queryKey: ["bank-connections", householdId],
    queryFn: () => listConnFn({ data: { householdId } }),
  });
  const cats = useCategories(householdId);

  const [edits, setEdits] = useState<
    Record<string, { category?: string; amount?: string }>
  >({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const items = inboxQuery.data ?? [];
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  const approve = useMutation({
    mutationFn: async (ids: string[]) => {
      const edits2 = ids.map((id) => {
        const e = edits[id] ?? {};
        return {
          id,
          category: e.category,
          amount: e.amount ? Number(e.amount) : undefined,
        };
      });
      return approveFn({ data: { householdId, edits: edits2 } });
    },
    onSuccess: (res) => {
      toast.success(`Approved ${res.approved} item${res.approved === 1 ? "" : "s"}`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["inbox", householdId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const dismiss = useMutation({
    mutationFn: async (ids: string[]) =>
      dismissFn({ data: { householdId, ids } }),
    onSuccess: (res) => {
      toast.success(`Dismissed ${res.dismissed}`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["inbox", householdId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const sync = useMutation({
    mutationFn: async (connectionId: string) =>
      syncFn({ data: { householdId, connectionId } }),
    onSuccess: (res) => {
      toast.success(
        `Fetched ${res.staged} new transaction${res.staged === 1 ? "" : "s"}${
          res.skipped ? ` (${res.skipped} already recorded)` : ""
        }`,
      );
      qc.invalidateQueries({ queryKey: ["inbox", householdId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  const merge = useMutation({
    mutationFn: async (v: { pendingId: string; expenseId: string }) =>
      mergeFn({ data: { householdId, ...v } }),
    onSuccess: () => {
      toast.success("Merged with existing entry");
      qc.invalidateQueries({ queryKey: ["inbox", householdId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  return (
    <div className={pageShellClass("3xl")}>
      <InboxHeader pendingCount={items.length} />

      {(conns.data ?? []).length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Linked banks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(conns.data ?? []).map((c) => (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                onClick={() => sync.mutate(c.id)}
                disabled={sync.isPending}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Sync {c.institution_name}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {items.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              checked={selectedIds.length === items.length && items.length > 0}
              onCheckedChange={(v) => {
                if (v) {
                  const all: Record<string, boolean> = {};
                  items.forEach((i) => (all[i.id] = true));
                  setSelected(all);
                } else setSelected({});
              }}
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedIds.length || dismiss.isPending}
                onClick={() => dismiss.mutate(selectedIds)}
              >
                <X className="mr-1 h-4 w-4" /> Dismiss
              </Button>
              <Button
                size="sm"
                disabled={!selectedIds.length || approve.isPending}
                onClick={() => approve.mutate(selectedIds)}
              >
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                selected={!!selected[item.id]}
                onToggle={(v) =>
                  setSelected((s) => ({ ...s, [item.id]: v }))
                }
                edit={edits[item.id] ?? {}}
                onEditChange={(patch) =>
                  setEdits((e) => ({ ...e, [item.id]: { ...e[item.id], ...patch } }))
                }
                categoryNames={(cats.data ?? []).map((c) => c.name)}
                onApprove={() => approve.mutate([item.id])}
                onDismiss={() => dismiss.mutate([item.id])}
                onMerge={(expenseId) =>
                  merge.mutate({ pendingId: item.id, expenseId })
                }
                fetchSuggestions={() =>
                  suggestFn({ data: { householdId, pendingId: item.id } })
                }
                fetchFixedMatches={() =>
                  suggestFixedFn({ data: { householdId, pendingId: item.id } })
                }
                busy={approve.isPending || dismiss.isPending || merge.isPending}
              />


            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={InboxIcon}
          title="Nothing to review"
          description="When you link a bank or import a statement, transactions will appear here for your approval before they touch your budget."
        />
      )}
    </div>
  );
}

type MatchSuggestion = {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  occurred_at: string;
  note: string | null;
  kind: "expense" | "income";
};

type FixedMatch = {
  id: string;
  label: string;
  monthly_amount: number;
  category: string | null;
  nameHit: boolean;
};

function PendingCard({
  item,
  selected,
  onToggle,
  edit,
  onEditChange,
  categoryNames,
  onApprove,
  onDismiss,
  onMerge,
  fetchSuggestions,
  fetchFixedMatches,
  busy,
}: {
  item: PendingRow;
  selected: boolean;
  onToggle: (v: boolean) => void;
  edit: { category?: string; amount?: string };
  onEditChange: (p: { category?: string; amount?: string }) => void;
  categoryNames: string[];
  onApprove: () => void;
  onDismiss: () => void;
  onMerge: (expenseId: string) => void;
  fetchSuggestions: () => Promise<MatchSuggestion[]>;
  fetchFixedMatches: () => Promise<FixedMatch[]>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[] | null>(null);
  const [fixedMatches, setFixedMatches] = useState<FixedMatch[] | null>(null);
  const [loadingSug, setLoadingSug] = useState(false);
  const dateStr = new Date(item.occurred_at).toLocaleDateString();
  const isIncome = item.kind === "income";

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && suggestions === null && !loadingSug) {
      setLoadingSug(true);
      try {
        const [rows, fx] = await Promise.all([
          fetchSuggestions(),
          fetchFixedMatches(),
        ]);
        setSuggestions(rows);
        setFixedMatches(fx);
      } catch {
        setSuggestions([]);
        setFixedMatches([]);
      } finally {
        setLoadingSug(false);
      }
    }
  }


  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onToggle(!!v)}
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate font-medium">
                {item.merchant ?? (isIncome ? "Income" : "Transaction")}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {item.source === "bank_sync" ? "bank" : "statement"}
              </Badge>
              {isIncome ? (
                <Badge variant="secondary" className="text-xs">income</Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {dateStr}
              {item.note ? ` · ${item.note}` : ""}
            </div>
          </div>
          <div
            className={`text-right font-semibold ${
              isIncome ? "text-emerald-600" : ""
            }`}
          >
            {isIncome ? "+" : ""}
            {money(Number(item.amount))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleOpen}
            aria-label="Toggle details"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>

        </div>

        {open ? (
          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={edit.category ?? item.suggested_category}
                onValueChange={(v) => onEditChange({ category: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryNames.length ? (
                    categoryNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="other">other</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={edit.amount ?? String(item.amount)}
                onChange={(e) => onEditChange({ amount: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onDismiss}
                disabled={busy}
              >
                <X className="mr-1 h-4 w-4" /> Dismiss
              </Button>
              <Button size="sm" onClick={onApprove} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        ) : null}

        {open && fixedMatches && fixedMatches.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-sm dark:border-amber-500/30 dark:bg-amber-950/30">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Likely a recurring fixed cost you already track
            </div>
            <div className="text-xs text-muted-foreground">
              Matches:{" "}
              {fixedMatches
                .map((f) => `${f.label} (${money(Number(f.monthly_amount))}/mo)`)
                .join(" · ")}
              . Approving would double-count against your baseline. Dismiss if
              this is that same monthly charge.
            </div>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
                <X className="mr-1 h-4 w-4" /> Dismiss (already tracked)
              </Button>
            </div>
          </div>
        ) : null}



        {open && (loadingSug || (suggestions && suggestions.length > 0)) ? (
          <div className="mt-3 border-t pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3 w-3" />
              Might match something you already logged
            </div>
            {loadingSug ? (
              <Skeleton className="h-10" />
            ) : (
              <div className="space-y-1.5">
                {suggestions!.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <span className="font-medium">
                          {s.merchant ?? s.category}
                        </span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {new Date(s.occurred_at).toLocaleDateString()}
                          {" · "}
                          {money(Number(s.amount))}
                        </span>
                      </div>
                      {s.note ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {s.note}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onMerge(s.id)}
                    >
                      Merge
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

      </CardContent>
    </Card>
  );
}
