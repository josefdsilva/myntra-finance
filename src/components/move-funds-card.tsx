import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { MoveFundsDialog } from "@/components/move-funds-dialog";

type BucketRow = { id: string; name: string; initial_balance: number };

/**
 * Standalone "Move funds" entry point for the Save & Invest screen. Lets the user
 * deposit, withdraw, or transfer money between projects. Kept here (rather than in
 * the loan overview, which now lives on the Loans page) so money movement stays
 * next to the projects it affects.
 */
export function MoveFundsCard({ householdId }: { householdId: string }) {
  const t = useT();
  const [moveOpen, setMoveOpen] = useState(false);

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["move-funds-card", householdId],
    queryFn: async () => {
      const [{ data: buckets }, { data: allocations }, { data: movements }] = await Promise.all([
        supabase
          .from("buckets")
          .select("id, name, initial_balance")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount")
          .eq("household_id", householdId),
        supabase.from("account_movements").select("*").eq("household_id", householdId),
      ]);
      return {
        buckets: (buckets ?? []) as BucketRow[],
        allocations: (allocations ?? []) as Array<{ bucket_id: string; amount: number }>,
        movements: (movements ?? []) as AccountMovement[],
      };
    },
  });

  const buckets = data?.buckets ?? [];
  const balances = bucketBalancesFor(buckets, data?.allocations ?? [], data?.movements ?? []);
  const bucketOptions = buckets.map((b) => ({ id: b.id, name: b.name }));

  if (buckets.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{t("debt.moveFunds")}</CardTitle>
          <CardDescription>{t("moveFunds.desc")}</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 whitespace-nowrap"
          onClick={() => setMoveOpen(true)}
        >
          <ArrowLeftRight className="size-4" /> {t("debt.moveFunds")}
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{t("moveFunds.body")}</CardContent>
      <MoveFundsDialog
        householdId={householdId}
        buckets={bucketOptions}
        bucketBalances={balances}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
    </Card>
  );
}
