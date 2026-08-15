import { supabase } from "@/integrations/supabase/client";

/**
 * "I'll cut this" commitments — the progress loop for the savings finder.
 *
 * A household picks one of the ranked trims, we record what they were spending
 * at that moment (`baseline_monthly`) and how much they promised to free up
 * (`monthly_target`), stamped with the cycle it was made in. From then on the
 * card compares this cycle's real spend in that category against the allowance
 * (baseline − target), so the promise is verified with actual data instead of
 * being forgotten.
 */
export type SavingsCommitment = {
  id: string;
  category: string;
  monthly_target: number | string;
  baseline_monthly: number | string;
  cycle_start: string;
  status: string;
  created_at: string;
};

export function commitmentsQueryKey(householdId: string) {
  return ["savings-commitments", householdId] as const;
}

export async function fetchCommitments(householdId: string): Promise<SavingsCommitment[]> {
  const { data } = await supabase
    .from("savings_commitments")
    .select("id, category, monthly_target, baseline_monthly, cycle_start, status, created_at")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("monthly_target", { ascending: false });
  return (data ?? []) as SavingsCommitment[];
}

export async function commitToCut(input: {
  householdId: string;
  category: string;
  monthlyTarget: number;
  baselineMonthly: number;
  cycleStart: Date;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not signed in");
  const cycle = input.cycleStart;
  const cycleStart = `${cycle.getFullYear()}-${String(cycle.getMonth() + 1).padStart(2, "0")}-${String(
    cycle.getDate(),
  ).padStart(2, "0")}`;
  const { error } = await supabase.from("savings_commitments").insert({
    household_id: input.householdId,
    category: input.category,
    monthly_target: input.monthlyTarget,
    baseline_monthly: input.baselineMonthly,
    cycle_start: cycleStart,
    created_by: userId,
  });
  if (error) throw error;
}

/** Close a commitment: kept it (target held) or dropped it (no longer trying). */
export async function resolveCommitment(id: string, status: "kept" | "dropped"): Promise<void> {
  const { error } = await supabase
    .from("savings_commitments")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
