import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_BUCKETS = [
  { name: "Long-term investments", target_type: "pct_surplus" as const, target_value: 40, color: "#2c6e6b", sort_order: 0 },
  { name: "Emergency savings", target_type: "pct_surplus" as const, target_value: 20, color: "#7aa874", sort_order: 1 },
  { name: "Kids savings", target_type: "fixed_monthly" as const, target_value: 200, color: "#d4a373", sort_order: 2 },
  { name: "Life projects", target_type: "pct_surplus" as const, target_value: 20, color: "#bc6c25", sort_order: 3 },
];

/** Returns the current user's household (creates one on first call). */
export const getOrCreateHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Prefer a shared household (member role) over a self-created empty one.
    const { data: memberships } = await supabase
      .from("household_members")
      .select("household_id, role, joined_at, households(*)")
      .eq("user_id", userId);

    if (memberships && memberships.length > 0) {
      const sorted = [...memberships].sort((a, b) => {
        // members (joined via invite) come before owners
        if (a.role !== b.role) return a.role === "member" ? -1 : 1;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });
      const pick = sorted[0];
      if (pick?.households) return { household: pick.households, role: pick.role };
    }

    // Before creating a fresh household, check for a pending invitation by email.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (email) {
      const { data: invite } = await supabaseAdmin
        .from("household_invitations")
        .select("id, household_id")
        .eq("email", email)
        .is("accepted_at", null)
        .limit(1)
        .maybeSingle();
      if (invite) {
        await supabaseAdmin
          .from("household_members")
          .insert({ household_id: invite.household_id, user_id: userId, role: "member" });
        await supabaseAdmin
          .from("household_invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invite.id);
        const { data: hh } = await supabaseAdmin
          .from("households")
          .select("*")
          .eq("id", invite.household_id)
          .single();
        if (hh) return { household: hh, role: "member" as const };
      }
    }

    // Create a fresh household with admin client — user is already verified by requireSupabaseAuth


    const { data: household, error: hErr } = await supabaseAdmin
      .from("households")
      .insert({ name: "My Household", created_by: userId, baseline_budget: 0, margin_pct: 10 })
      .select()
      .single();
    if (hErr || !household) throw hErr ?? new Error("Failed to create household");

    const { error: mErr } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: household.id, user_id: userId, role: "owner" });
    if (mErr) throw mErr;

    // Seed buckets
    await supabaseAdmin
      .from("buckets")
      .insert(DEFAULT_BUCKETS.map((b) => ({ ...b, household_id: household.id })));

    return { household, role: "owner" as const };
  });

export const updateHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        baseline_budget: z.number().min(0).optional(),
        margin_pct: z.number().min(0).max(100).optional(),
        credit_cap: z.number().min(0).max(10000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { household_id, ...patch } = data;
    const { data: updated, error } = await context.supabase
      .from("households")
      .update(patch)
      .eq("id", household_id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: invite, error } = await context.supabase
      .from("household_invitations")
      .insert({ household_id: data.household_id, email: data.email, invited_by: context.userId })
      .select()
      .single();
    if (error) throw error;
    return invite;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("household_invitations")
      .select("*")
      .eq("token", data.token)
      .is("accepted_at", null)
      .maybeSingle();
    if (!invite) throw new Error("Invitation not found or already used");

    const { error } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: invite.household_id, user_id: context.userId, role: "member" });
    if (error && !error.message.includes("duplicate")) throw error;

    await supabaseAdmin
      .from("household_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { household_id: invite.household_id };
  });
