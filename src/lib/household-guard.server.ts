import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Typed Supabase client used inside server functions after requireSupabaseAuth. */
export type Supa = SupabaseClient<Database>;

/**
 * Throws "Not a member of this household" if the caller is not in `household_members`.
 * Use this as the very first step of every household-scoped server function that
 * accepts a household id in its input — belt-and-braces on top of RLS so we fail
 * fast with a clear error instead of silently returning empty rows.
 */
export async function assertHouseholdMember(
  supabase: Supa,
  householdId: string,
  userId: string,
): Promise<void> {
  const { data: mem } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) throw new Error("Not a member of this household");
}
