import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Month-to-date credit usage summary for a household. */
export const getHouseholdCreditUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ householdId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: mem } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", data.householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) throw new Error("Not a member of this household");

    const { data: hh } = await supabase
      .from("households")
      .select("credit_cap")
      .eq("id", data.householdId)
      .maybeSingle();
    const cap = Number(hh?.credit_cap ?? 10);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: rows = [] } = await supabase
      .from("credit_usage")
      .select("operation, credits, input_tokens, output_tokens, created_at")
      .eq("household_id", data.householdId)
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStart)
      .order("created_at", { ascending: false });

    let total = 0;
    const byOp: Record<string, { credits: number; count: number }> = {};
    for (const r of rows ?? []) {
      const c = Number(r.credits);
      total += c;
      const entry = byOp[r.operation] ?? { credits: 0, count: 0 };
      entry.credits += c;
      entry.count += 1;
      byOp[r.operation] = entry;
    }

    return {
      cap,
      total: Number(total.toFixed(4)),
      periodStart: monthStart,
      periodEnd: nextMonthStart,
      breakdown: Object.entries(byOp)
        .map(([operation, v]) => ({
          operation,
          credits: Number(v.credits.toFixed(4)),
          count: v.count,
        }))
        .sort((a, b) => b.credits - a.credits),
      recent: (rows ?? []).slice(0, 20).map((r) => ({
        operation: r.operation as string,
        credits: Number(Number(r.credits).toFixed(4)),
        input_tokens: r.input_tokens as number | null,
        output_tokens: r.output_tokens as number | null,
        created_at: r.created_at as string,
      })),
    };
  });
