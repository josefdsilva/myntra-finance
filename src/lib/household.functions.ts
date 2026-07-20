import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_BUCKETS = [
  {
    name: "Long-term investments",
    target_type: "pct_surplus" as const,
    target_value: 40,
    color: "#2c6e6b",
    sort_order: 0,
  },
  {
    name: "Emergency savings",
    target_type: "pct_surplus" as const,
    target_value: 20,
    color: "#7aa874",
    sort_order: 1,
  },
  {
    name: "Kids savings",
    target_type: "fixed_monthly" as const,
    target_value: 200,
    color: "#d4a373",
    sort_order: 2,
  },
  {
    name: "Life projects",
    target_type: "pct_surplus" as const,
    target_value: 20,
    color: "#bc6c25",
    sort_order: 3,
  },
];

/**
 * Returns the current user's household. If `household_id` is provided and the
 * caller is a member, that specific household is returned. Otherwise the
 * caller's default household is returned (creating one on very first call).
 */
export const getOrCreateHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // If a specific household was requested and the caller is a member, return it.
    if (data?.household_id) {
      const { data: mem } = await supabase
        .from("household_members")
        .select("role, households(*)")
        .eq("household_id", data.household_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (mem?.households)
        return { household: mem.households, role: mem.role, needsBetaCode: false as const };
    }

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
      if (pick?.households)
        return { household: pick.households, role: pick.role, needsBetaCode: false as const };
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
        if (hh) return { household: hh, role: "member" as const, needsBetaCode: false as const };
      }
    }

    // Beta gate: only users who redeemed the shared beta code may create a
    // brand-new household. Invited users returned above and never reach here.
    const { data: betaRow } = await supabaseAdmin
      .from("beta_members")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!betaRow) {
      return { household: null, role: null, needsBetaCode: true as const };
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

    return { household, role: "owner" as const, needsBetaCode: false as const };
  });

/**
 * Redeem a beta access code. Delegates to the redeem_beta_code database function,
 * which throttles attempts (max 3 per hour), validates the code against the
 * beta_codes table, and admits the caller only if the code still has a free seat.
 * Returns a status string the client turns into a friendly message.
 */
export const redeemBetaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: status, error } = await context.supabase.rpc("redeem_beta_code", {
      p_code: data.code.trim(),
    });
    if (error) throw error;
    return { status: (status as string) ?? "invalid" };
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
        country: z.string().min(2).max(2).optional(),
        currency: z.enum(["EUR", "USD", "GBP"]).optional(),
        adults: z.number().int().min(1).max(20).optional(),
        children: z.number().int().min(0).max(20).optional(),
        kind: z.enum(["personal", "business"]).optional(),
        advisor_email: z.string().max(200).nullable().optional(),
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

/** Mark a household's first-run onboarding as done (or skipped). */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("households")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", data.household_id);
    if (error) throw error;
    return { ok: true };
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

    // The invite link is only valid for the email it was sent to — otherwise
    // anyone who gets hold of the link (forwarded, leaked, etc.) could join
    // a household they were never invited to.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const callerEmail = authUser?.user?.email?.toLowerCase().trim();
    if (!callerEmail || callerEmail !== invite.email.toLowerCase().trim()) {
      throw new Error(
        "This invitation was sent to a different email address. Sign in with that account to accept it.",
      );
    }

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

/** All households the current user belongs to, oldest membership first. */
export const listMyHouseholds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("household_members")
      .select("role, joined_at, households(*)")
      .eq("user_id", context.userId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .filter((m): m is typeof m & { households: NonNullable<typeof m.households> } =>
        Boolean(m.households),
      )
      .map((m) => ({ household: m.households, role: m.role, joined_at: m.joined_at }));
  });

/** Create an additional household owned by the caller and seed its buckets. */
export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(100) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enforce max 1 owned household per user on the free tier.
    const { count: ownedCount, error: countErr } = await supabaseAdmin
      .from("household_members")
      .select("household_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "owner");
    if (countErr) throw countErr;
    if ((ownedCount ?? 0) >= 1) {
      throw new Error(
        "HOUSEHOLD_LIMIT_REACHED: The free tier includes 1 household. Buying additional household slots will be available soon.",
      );
    }


    const { data: household, error } = await supabaseAdmin
      .from("households")
      .insert({ name: data.name, created_by: userId, baseline_budget: 0, margin_pct: 10 })
      .select()
      .single();
    if (error || !household) throw error ?? new Error("Failed to create household");


    const { error: mErr } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: household.id, user_id: userId, role: "owner" });
    if (mErr) throw mErr;

    await supabaseAdmin
      .from("buckets")
      .insert(DEFAULT_BUCKETS.map((b) => ({ ...b, household_id: household.id })));

    return { household, role: "owner" as const };
  });
