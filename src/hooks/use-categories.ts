import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; sort_order: number };

export function useCategories(householdId?: string) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["expense_categories", householdId],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, sort_order")
        .eq("household_id", householdId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useCategoryNames(householdId?: string) {
  const q = useCategories(householdId);
  return { ...q, names: (q.data ?? []).map((c) => c.name) };
}

export function useCategoryMutations(householdId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expense_categories", householdId] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["fixed"] });
    qc.invalidateQueries({ queryKey: ["variables"] });
  };

  const add = useMutation({
    mutationFn: async (name: string) => {
      if (!householdId) throw new Error("No household");
      const clean = name.trim().toLowerCase();
      if (!clean) throw new Error("Name is required");
      const { data: last } = await supabase
        .from("expense_categories")
        .select("sort_order")
        .eq("household_id", householdId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = ((last?.sort_order as number | undefined) ?? 0) + 10;
      const { error } = await supabase
        .from("expense_categories")
        .insert({ household_id: householdId, name: clean, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, oldName, newName }: { id: string; oldName: string; newName: string }) => {
      if (!householdId) throw new Error("No household");
      const clean = newName.trim().toLowerCase();
      if (!clean) throw new Error("Name is required");
      if (clean === oldName) return;
      const { error } = await supabase
        .from("expense_categories")
        .update({ name: clean })
        .eq("id", id);
      if (error) throw error;
      // Cascade rename across data tables (RLS scoped by household)
      await supabase
        .from("expenses")
        .update({ category: clean })
        .eq("household_id", householdId)
        .eq("category", oldName);
      await supabase
        .from("fixed_expenses")
        .update({ category: clean })
        .eq("household_id", householdId)
        .eq("category", oldName);
      await supabase
        .from("variable_estimates")
        .update({ category: clean })
        .eq("household_id", householdId)
        .eq("category", oldName);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!householdId) throw new Error("No household");
      // Reassign existing rows to "other" so we don't orphan them
      await supabase
        .from("expenses")
        .update({ category: "other" })
        .eq("household_id", householdId)
        .eq("category", name);
      await supabase
        .from("fixed_expenses")
        .update({ category: "other" })
        .eq("household_id", householdId)
        .eq("category", name);
      await supabase
        .from("variable_estimates")
        .update({ category: "other" })
        .eq("household_id", householdId)
        .eq("category", name);
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, rename, remove };
}
