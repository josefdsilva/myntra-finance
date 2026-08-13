// Server-only implementation for synthetic test personas. Everything here runs
// with the service-role client because it creates auth users and writes rows on
// their behalf. Access is restricted to the emails listed in the
// PERSONA_ADMIN_EMAILS secret.
//
// SAFETY: every artefact is flagged as synthetic —
//   auth user   → user_metadata.synthetic = true, user_metadata.persona_key
//   profile     → profiles.is_synthetic = true
//   household   → households.is_synthetic = true (drives the UI banner)
//   registry    → public.synthetic_personas (service-role only)
// Wiping a persona deletes its household (cascade) and its auth user.

import {
  PERSONAS,
  SYNTHETIC_LABEL,
  buildPersonaBudget,
  buildPersonaHistory,
  personaByKey,
  personaMonthlyIncome,
  type PersonaDef,
} from "./personas";
import {
  DEFAULT_CATEGORIES_BUSINESS,
  DEFAULT_CATEGORIES_PERSONAL,
} from "./household.functions.shared";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Throws unless the caller's email is listed in PERSONA_ADMIN_EMAILS. */
export function assertPersonaAdmin(email: string | null | undefined): string {
  const raw = process.env["PERSONA_ADMIN_EMAILS"] ?? "";
  const allowed = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const mine = (email ?? "").trim().toLowerCase();
  if (allowed.length === 0) {
    throw new Error("Persona tools are not configured (PERSONA_ADMIN_EMAILS is empty).");
  }
  if (!mine || !allowed.includes(mine)) {
    throw new Error("Not allowed: persona tools are restricted.");
  }
  return mine;
}

function personaPassword(): string {
  const pwd = process.env["PERSONA_PASSWORD"];
  if (!pwd) throw new Error("PERSONA_PASSWORD is not configured.");
  return pwd;
}

async function findUserByEmail(admin: Admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function ensurePersonaUser(admin: Admin, p: PersonaDef): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: personaPassword(),
    email_confirm: true,
    user_metadata: {
      synthetic: true,
      persona_key: p.key,
      display_name: p.displayName,
      note: SYNTHETIC_LABEL,
    },
  });
  if (created?.user) return created.user.id;

  // Already registered → find it and refresh its password/metadata.
  const existing = await findUserByEmail(admin, p.email);
  if (!existing) throw error ?? new Error(`Could not create or find persona user ${p.email}`);
  await admin.auth.admin.updateUserById(existing, {
    password: personaPassword(),
    email_confirm: true,
    user_metadata: {
      synthetic: true,
      persona_key: p.key,
      display_name: p.displayName,
      note: SYNTHETIC_LABEL,
    },
  });
  return existing;
}

function bucketRows(householdId: string, p: PersonaDef) {
  const business = p.kind === "business";
  return [
    {
      household_id: householdId,
      name: business ? "Cash buffer" : "Emergency savings",
      kind: "emergency" as const,
      target_type: "pct_surplus" as const,
      target_value: 30,
      color: "#7aa874",
      sort_order: 0,
      initial_balance: p.bucketSeed.emergency,
    },
    {
      household_id: householdId,
      name: business ? "Reinvestment" : "Long-term investments",
      kind: "investment" as const,
      target_type: "pct_surplus" as const,
      target_value: 40,
      color: "#2c6e6b",
      sort_order: 1,
      initial_balance: p.bucketSeed.investment,
    },
    {
      household_id: householdId,
      name: business ? "Tax reserve" : "Life projects",
      kind: "savings" as const,
      target_type: "pct_surplus" as const,
      target_value: 20,
      color: "#bc6c25",
      sort_order: 2,
      initial_balance: p.bucketSeed.savings,
    },
  ];
}

export type PersonaStatus = {
  key: string;
  label: string;
  angle: string;
  email: string;
  country: string;
  kind: "personal" | "business";
  adults: number;
  children: number;
  monthlyIncome: number;
  seeded: boolean;
  seededAt: string | null;
  householdId: string | null;
};

export async function listPersonaStatus(admin: Admin): Promise<PersonaStatus[]> {
  const { data: rows } = await admin
    .from("synthetic_personas")
    .select("key, seeded_at, household_id");
  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
  return PERSONAS.map((p) => {
    const row = byKey.get(p.key);
    return {
      key: p.key,
      label: p.label,
      angle: p.angle,
      email: p.email,
      country: p.country,
      kind: p.kind,
      adults: p.adults,
      children: p.children,
      monthlyIncome: personaMonthlyIncome(p),
      seeded: !!row?.household_id,
      seededAt: row?.seeded_at ?? null,
      householdId: row?.household_id ?? null,
    };
  });
}

/** Delete a persona's household and auth user, keeping the registry row. */
export async function wipePersonaData(admin: Admin, key: string): Promise<void> {
  const p = personaByKey(key);
  if (!p) throw new Error(`Unknown persona ${key}`);

  const { data: row } = await admin
    .from("synthetic_personas")
    .select("user_id, household_id")
    .eq("key", key)
    .maybeSingle();

  const userId = row?.user_id ?? (await findUserByEmail(admin, p.email));

  if (userId) {
    // Every household this synthetic user owns (defensive: only synthetic ones).
    const { data: memberships } = await admin
      .from("household_members")
      .select("household_id, households(is_synthetic)")
      .eq("user_id", userId);
    for (const m of memberships ?? []) {
      const hh = m.households as { is_synthetic?: boolean } | null;
      if (!hh?.is_synthetic) continue;
      await admin.from("push_subscriptions").delete().eq("household_id", m.household_id);
      await admin.from("households").delete().eq("id", m.household_id);
    }
    await admin.from("beta_members").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }

  await admin
    .from("synthetic_personas")
    .update({ user_id: null, household_id: null, seeded_at: null })
    .eq("key", key);
}

/** Create (or rebuild) a persona: auth user, flagged household and full data. */
export async function seedPersona(admin: Admin, key: string) {
  const p = personaByKey(key);
  if (!p) throw new Error(`Unknown persona ${key}`);

  // Start from scratch so re-seeding is idempotent and deterministic.
  await wipePersonaData(admin, key);

  const userId = await ensurePersonaUser(admin, p);

  // Flag the profile (created by the on_auth_user_created trigger).
  await admin
    .from("profiles")
    .upsert(
      { user_id: userId, display_name: p.displayName, is_synthetic: true },
      { onConflict: "user_id" },
    );

  // Beta gate: personas must be able to reach the app like a real invited user.
  await admin.from("beta_members").upsert({ user_id: userId }, { onConflict: "user_id" });

  const budget = buildPersonaBudget(p);
  const anchor = new Date();

  const { data: household, error: hErr } = await admin
    .from("households")
    .insert({
      name: p.householdName,
      created_by: userId,
      is_synthetic: true,
      kind: p.kind,
      country: p.country,
      currency: p.currency,
      adults: p.adults,
      children: p.children,
      age_band: p.ageBand,
      employees: p.employees ?? 0,
      sector: p.sector ?? null,
      margin_pct: budget.marginPct,
      baseline_budget: 0,
      cycle: "monthly",
      cycle_mode: p.cycleMode,
      cycle_anchor_date:
        p.cycleMode === "time"
          ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
              .toISOString()
              .slice(0, 10)
          : null,
      onboarded_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (hErr || !household) throw hErr ?? new Error("Failed to create persona household");

  await admin
    .from("household_members")
    .insert({ household_id: household.id, user_id: userId, role: "owner" });

  // Categories (the household trigger seeds a personal default set; make sure
  // the business set exists too).
  const names = p.kind === "business" ? DEFAULT_CATEGORIES_BUSINESS : DEFAULT_CATEGORIES_PERSONAL;
  await admin.from("expense_categories").upsert(
    names.map((name, i) => ({ household_id: household.id, name, sort_order: (i + 1) * 10 })),
    { onConflict: "household_id,name", ignoreDuplicates: true },
  );

  await admin.from("buckets").insert(bucketRows(household.id, p));

  const { data: incomeRows } = await admin
    .from("incomes")
    .insert(
      p.incomes.map((i) => ({
        household_id: household.id,
        owner_user_id: userId,
        label: i.label,
        monthly_amount: i.monthly_amount,
        type: i.type,
        cadence: "monthly",
      })),
    )
    .select("id, type");

  if (budget.fixed.length) {
    await admin.from("fixed_expenses").insert(
      budget.fixed.map((f) => ({
        household_id: household.id,
        label: f.label,
        category: f.category,
        monthly_amount: f.monthly_amount,
        cadence: "monthly",
        intent: f.intent,
        is_estimated: budget.fromBenchmark,
      })),
    );
  }

  if (budget.variable.length) {
    await admin.from("variable_estimates").insert(
      budget.variable.map((v) => ({
        household_id: household.id,
        label: v.label,
        category: v.category,
        monthly_amount: v.monthly_amount,
        is_estimated: budget.fromBenchmark,
      })),
    );
  }

  if (p.debts.length) {
    await admin.from("debts").insert(
      p.debts.map((d, i) => ({
        household_id: household.id,
        label: d.label,
        kind: d.kind,
        monthly_amount: d.monthly_amount,
        principal_remaining: d.principal_remaining,
        starting_principal: d.principal_remaining,
        taeg_pct: d.taeg_pct,
        maturity_date: new Date(
          Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + d.months_left, 1),
        )
          .toISOString()
          .slice(0, 10),
        note: SYNTHETIC_LABEL,
        sort_order: i,
      })),
    );
  }

  // Expense + income history.
  const salaryIncomeId = (incomeRows ?? []).find((r) => r.type === "salary")?.id ?? null;
  const history = buildPersonaHistory(p, budget, anchor);
  const expenseRows = history.map((e) => ({
    household_id: household.id,
    added_by_user_id: userId,
    amount: e.amount,
    category: e.category,
    merchant: e.merchant,
    occurred_at: e.occurred_at,
    kind: e.kind,
    is_salary: e.is_salary,
    source: "manual" as const,
    note: e.note,
    labels: ["synthetic"],
    income_id: e.kind === "income" && e.is_salary ? salaryIncomeId : null,
  }));
  for (let i = 0; i < expenseRows.length; i += 200) {
    const chunk = expenseRows.slice(i, i + 200);
    const { error } = await admin.from("expenses").insert(chunk);
    if (error) throw error;
  }

  // Anchor an event-driven cycle to the persona's salary income.
  if (p.cycleMode === "event" && salaryIncomeId) {
    await admin
      .from("households")
      .update({ cycle_anchor_income_id: salaryIncomeId })
      .eq("id", household.id);
  }

  await admin.from("synthetic_personas").upsert(
    {
      key: p.key,
      email: p.email,
      label: p.label,
      profile: {
        angle: p.angle,
        country: p.country,
        kind: p.kind,
        adults: p.adults,
        children: p.children,
        age_band: p.ageBand,
        monthly_income: personaMonthlyIncome(p),
      },
      user_id: userId,
      household_id: household.id,
      seeded_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  return {
    key: p.key,
    email: p.email,
    householdId: household.id,
    expenses: expenseRows.length,
  };
}
