import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Returns the most-frequently used labels in the household (across all expenses).
export function useRecentLabels(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["labels", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("labels")
        .eq("household_id", householdId!)
        .not("labels", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        for (const l of (row.labels as string[] | null) ?? []) {
          if (!l) continue;
          counts.set(l, (counts.get(l) ?? 0) + 1);
        }
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([l]) => l);
    },
    staleTime: 30_000,
  });
}
