import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { txnFingerprint } from "@/lib/import-dedup";

/**
 * Fingerprints of the household's existing ledger transactions within a date
 * window, so statement import can flag/skip duplicates before committing.
 *
 * Combines two sources: the stored fingerprint (`source_meta.fp`, written by
 * prior imports — an exact match when re-uploading an overlapping statement) and
 * a fingerprint recomputed from each row's own fields (so overlaps with
 * manually-added or pre-fingerprint expenses are caught too, best-effort).
 */
export const existingFingerprints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        start: z.string(),
        end: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("expenses")
      .select("amount, merchant, occurred_at, kind, source_meta")
      .eq("household_id", data.household_id)
      .gte("occurred_at", data.start)
      .lte("occurred_at", data.end);

    const set = new Set<string>();
    for (const r of (rows ?? []) as Array<{
      amount: number | string;
      merchant: string | null;
      occurred_at: string;
      kind: string;
      source_meta: { fp?: string } | null;
    }>) {
      const storedFp = r.source_meta?.fp;
      if (storedFp) set.add(storedFp);
      set.add(
        txnFingerprint({
          date: r.occurred_at,
          amount: Number(r.amount),
          description: r.merchant,
          kind: r.kind === "income" ? "income" : "expense",
        }),
      );
    }
    return { fingerprints: Array.from(set) };
  });
