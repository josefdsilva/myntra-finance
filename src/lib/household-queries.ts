// Shared React Query options for the household's base reference tables.
//
// Several screens (Dashboard, Dashboard tips, …) each used to fetch buckets,
// incomes, fixed expenses, debts and variable estimates independently, so the
// same rows were read multiple times per screen. Routing those reads through
// these shared query keys (via queryClient.fetchQuery) means each table is
// fetched once and reused from cache across every consumer.

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FRESH = 60_000;

/**
 * Invalidate the shared base-table caches plus the screens that read them, so an
 * edit in Settings/onboarding/import reflects on the Dashboard immediately rather
 * than after the staleTime window.
 */
export function invalidateHouseholdData(qc: QueryClient) {
  const keys = [
    // The household row carries baseline_budget (recomputed by a DB trigger on
    // every fixed/variable/debt change). Without this, "How much you need" and
    // everything derived from it (safe-to-spend, surplus, analysis) stays stale
    // after an add/delete until a manual refresh.
    ["household"],
    ["household-buckets"],
    ["household-incomes"],
    ["household-fixed-expenses"],
    ["household-debts"],
    ["household-variable-estimates"],
    ["dashboard"],
    ["dashboard-tips"],
    // Whole-picture views that also read the stored baseline / balances.
    ["snapshot"],
    ["net-worth"],
  ];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function bucketsQuery(householdId: string) {
  return {
    queryKey: ["household-buckets", householdId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buckets")
        .select(
          "id, name, target_type, target_value, target_deadline, color, initial_balance, kind, sort_order",
        )
        .eq("household_id", householdId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: FRESH,
  };
}

export function incomesQuery(householdId: string) {
  return {
    queryKey: ["household-incomes", householdId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("id, label, monthly_amount, type")
        .eq("household_id", householdId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: FRESH,
  };
}

export function fixedExpensesQuery(householdId: string) {
  return {
    queryKey: ["household-fixed-expenses", householdId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("id, monthly_amount")
        .eq("household_id", householdId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: FRESH,
  };
}

export function debtsQuery(householdId: string) {
  return {
    queryKey: ["household-debts", householdId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("id, monthly_amount")
        .eq("household_id", householdId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: FRESH,
  };
}

export function variableEstimatesQuery(householdId: string) {
  return {
    queryKey: ["household-variable-estimates", householdId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variable_estimates")
        .select("id, monthly_amount")
        .eq("household_id", householdId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: FRESH,
  };
}
