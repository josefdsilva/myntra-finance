import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Delete an entire household and every row that references it.
 * Only an owner of that household may call it.
 * Cascade deletes handle members/buckets/expenses/incomes/allocations/etc.
 * `push_subscriptions` uses NO ACTION on the household FK, so we clear it
 * explicitly before deleting the household.
 */
export const deleteHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid(), confirm: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Verify caller is an owner of this household
    const { data: membership, error: mErr } = await supabase
      .from("household_members")
      .select("role")
      .eq("household_id", data.household_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!membership || membership.role !== "owner") {
      throw new Error("Only a household owner can delete the household.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear push subscriptions tied to this household (no CASCADE)
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("household_id", data.household_id);

    const { error: dErr } = await supabaseAdmin
      .from("households")
      .delete()
      .eq("id", data.household_id);
    if (dErr) throw dErr;

    return { ok: true };
  });

/**
 * Remove yourself from a household. If you are the last owner, refuse —
 * transfer ownership or delete the household instead.
 */
export const leaveHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: members, error } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", data.household_id);
    if (error) throw error;

    const me = members?.find((m) => m.user_id === userId);
    if (!me) throw new Error("You are not a member of this household.");

    if (me.role === "owner") {
      const otherOwners = members!.filter((m) => m.role === "owner" && m.user_id !== userId);
      if (otherOwners.length === 0) {
        throw new Error(
          "You are the only owner. Delete the household or transfer ownership before leaving.",
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: dErr } = await supabaseAdmin
      .from("household_members")
      .delete()
      .eq("household_id", data.household_id)
      .eq("user_id", userId);
    if (dErr) throw dErr;

    return { ok: true };
  });

/**
 * Erase the caller's account and all personal data (GDPR right to erasure).
 * - For each household where the caller is the SOLE owner: delete the whole household.
 * - For every other household: remove the membership row.
 * - Then delete the auth user (cascades profile, notification prefs, push subs, etc.).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm: z.literal("DELETE MY ACCOUNT") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: myMemberships, error } = await supabase
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", userId);
    if (error) throw error;

    for (const m of myMemberships ?? []) {
      if (m.role === "owner") {
        const { data: siblings } = await supabaseAdmin
          .from("household_members")
          .select("user_id, role")
          .eq("household_id", m.household_id);
        const otherOwners = (siblings ?? []).filter(
          (s) => s.role === "owner" && s.user_id !== userId,
        );
        if (otherOwners.length === 0) {
          // Sole owner → delete the whole household with the user's data
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("household_id", m.household_id);
          await supabaseAdmin.from("households").delete().eq("id", m.household_id);
          continue;
        }
      }
      // Otherwise just remove this user from the household
      await supabaseAdmin
        .from("household_members")
        .delete()
        .eq("household_id", m.household_id)
        .eq("user_id", userId);
    }

    // Finally, delete the auth user. Cascades to profile, notification_prefs,
    // push_subscriptions, and nullifies audit columns (expenses.added_by_user_id etc.).
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return { ok: true };
  });
