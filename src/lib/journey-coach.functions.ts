import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "@/lib/ai-gateway.server";
import type { JsonObject } from "@/lib/json";

// The conversational coach for the Money Journey: given the household's real
// position and current roadmap, it proposes concrete stages the user can accept
// or dismiss. Grounded (facts are computed here, not invented), and it only ever
// PROPOSES — nothing is written until the user adds a stage. Educational, not
// regulated advice. See docs/money-journey-plan.md.

const MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 30_000;

// Metrics the coach may bind a stage to (must match the client-side evaluator).
const METRIC_KEYS = new Set([
  "emergency_months",
  "dti_pct",
  "invested_months",
  "invested_years",
  "total_income",
  "income_concentration",
  "spending_vs_plan",
  "savings_rate",
  "essential_expenses_ratio",
  "housing_cost_ratio",
  "non_mortgage_debt_service",
  "net_worth",
  "debt_to_asset",
  "investment_assets_ratio",
]);

export type StageProposal = {
  title: string;
  objective: string;
  optional: boolean;
  rationale: string;
  objectiveType: "metric" | "project" | "custom";
  objectiveConfig: JsonObject;
};

/** Tolerant JSON extraction — models sometimes wrap JSON in prose or code fences. */
function extractJson(text: string): { note?: string; proposals?: unknown[] } | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const SYSTEM = `You are bynku's financial coach. You help a household shape their "money journey" — an ordered roadmap of milestone stages.

Propose between 1 and 4 concrete stages, grounded ONLY in the facts provided. Each stage has:
- title: short (max ~6 words)
- objective: one plain-language line describing the goal
- optional: true if it's a side-quest that runs alongside without blocking the main path (e.g. a house deposit), false if it belongs on the main spine
- rationale: one short line on why it matters now, referencing the facts
- measure: attach this whenever the stage can be tracked against the facts, so its progress updates automatically. Use ONE of: {"metric": one of "emergency_months","dti_pct","invested_months","invested_years","total_income","income_concentration","spending_vs_plan","savings_rate","essential_expenses_ratio","housing_cost_ratio","non_mortgage_debt_service","net_worth","debt_to_asset","investment_assets_ratio", "op": ">=" or "<=", "value": number} OR {"project": "<the EXACT name of an existing project>"} to track that project's balance toward its target. If it genuinely can't be measured, set measure to null and it becomes a manual milestone.
  Sensible reference thresholds (percent values, months, or currency as appropriate): savings_rate >= 15 (10–20% is common), housing_cost_ratio <= 30, essential_expenses_ratio <= 70, dti_pct <= 36, non_mortgage_debt_service <= 15, emergency_months >= 3 then 6, income_concentration <= 70, investment_assets_ratio rising over time. Only propose a metric you can ground in the facts or in sound general guidance.

Follow the sound order of operations: emergency fund first, then reduce expensive debt, then invest for the long term, then life goals. CRITICAL: never propose a stage that duplicates or overlaps one already in "Current stages" — check BOTH the name and the measure. If a stage already targets emergency_months >= 6, do NOT propose another six-month safety net; if a project is already tracked, do not propose it again. Do not invent numbers that aren't derivable from the facts. This is educational information, not regulated financial advice — never tell them to buy a specific product. If the user gives a request, honour it while staying grounded. Keep everything concise.`;

export const proposeJourneyStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        request: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const hid = data.household_id;
    const [hh, buckets, allocs, moves, incomes, debts, fixed, stages] = await Promise.all([
      context.supabase.from("households").select("baseline_budget, country, kind").eq("id", hid).maybeSingle(),
      context.supabase
        .from("buckets")
        .select("id, name, kind, target_type, target_value, initial_balance")
        .eq("household_id", hid),
      context.supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      context.supabase
        .from("account_movements")
        .select("amount, to_type, from_type, to_id, from_id")
        .eq("household_id", hid),
      context.supabase.from("incomes").select("monthly_amount").eq("household_id", hid),
      context.supabase.from("debts").select("monthly_amount").eq("household_id", hid),
      context.supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      context.supabase
        .from("journey_stages")
        .select("template_key, title, objective, optional, objective_type, objective_config")
        .eq("household_id", hid)
        .order("sort_order", { ascending: true }),
    ]);

    const baseline = Number(hh.data?.baseline_budget ?? 0);
    const income = (incomes.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const maxIncome = (incomes.data ?? []).reduce((mx, r) => Math.max(mx, Number(r.monthly_amount) || 0), 0);
    const debtMonthly = (debts.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const fixedMonthly = (fixed.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const essentials = Math.max(1, baseline || fixedMonthly + debtMonthly);

    const bs = (buckets.data ?? []) as Array<{
      id: string;
      name: string;
      kind: string | null;
      target_type: string;
      target_value: number | string;
      initial_balance: number | string;
    }>;
    const bal: Record<string, number> = {};
    for (const b of bs) bal[b.id] = Number(b.initial_balance ?? 0);
    for (const a of (allocs.data ?? []) as Array<{ bucket_id: string; amount: number | string }>)
      bal[a.bucket_id] = (bal[a.bucket_id] ?? 0) + Number(a.amount);
    for (const m of (moves.data ?? []) as Array<{
      amount: number | string;
      to_type: string | null;
      from_type: string | null;
      to_id: string | null;
      from_id: string | null;
    }>) {
      if (m.to_type === "bucket" && m.to_id) bal[m.to_id] = (bal[m.to_id] ?? 0) + Number(m.amount);
      if (m.from_type === "bucket" && m.from_id) bal[m.from_id] = (bal[m.from_id] ?? 0) - Number(m.amount);
    }
    let emergencyBal = 0;
    let savingsBal = 0;
    let investBal = 0;
    for (const b of bs) {
      const v = bal[b.id] ?? 0;
      if (b.kind === "investment") investBal += v;
      else if (b.kind === "emergency") emergencyBal += v;
      else savingsBal += v;
    }
    const hasEmergency = bs.some((b) => b.kind === "emergency");
    const liquidReserve = hasEmergency ? emergencyBal : emergencyBal + savingsBal;

    const facts = {
      country: hh.data?.country ?? null,
      spaceKind: hh.data?.kind ?? "household",
      monthlyIncome: Math.round(income),
      monthlyEssentials: Math.round(essentials),
      emergencyMonths: Math.round((liquidReserve / essentials) * 10) / 10,
      debtToIncomePct: income > 0 ? Math.round((debtMonthly / income) * 100) : 0,
      investedMonths: Math.round((investBal / essentials) * 10) / 10,
      investedYears: Math.round((investBal / (12 * essentials)) * 10) / 10,
      essentialExpensesRatioPct: income > 0 ? Math.round((essentials / income) * 100) : null,
      incomeConcentrationPct: income > 0 ? Math.round((maxIncome / income) * 100) : null,
      projects: bs.map((b) => ({
        name: b.name,
        kind: b.kind,
        type: b.target_type,
        target: Number(b.target_value) || 0,
        balance: Math.round(bal[b.id] ?? 0),
      })),
    };
    // For matching a coach-referenced project name back to a real bucket id.
    const projList = bs.map((b) => ({ id: b.id, name: b.name, target: Number(b.target_value) || 0 }));

    const describeMeasure = (type: string, cfg: JsonObject): string =>
      type === "metric"
        ? `${String(cfg.key ?? "")} ${cfg.op ?? ">="} ${cfg.value ?? ""}`.trim()
        : type === "project"
          ? "tracks a project"
          : "manual";
    const existingStages = (stages.data ?? []) as Array<{
      template_key: string | null;
      title: string | null;
      optional: boolean;
      objective_type: string;
      objective_config: JsonObject;
    }>;

    // Build the household's existing coverage so we can drop any proposal that
    // duplicates a stage already on the roadmap — by title, by project, or by a
    // metric already targeted in the same direction at an equal-or-tougher level.
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const existingTitles = new Set<string>();
    const existingProjects = new Set<string>();
    const existingMetrics = new Map<string, Array<{ op: string; value: number }>>();
    for (const s of existingStages) {
      const cfg = (s.objective_config ?? {}) as JsonObject;
      const title = s.title ?? s.template_key ?? "";
      if (title) existingTitles.add(norm(title));
      if (s.objective_type === "project") {
        const b = String(cfg.bucket_id ?? "");
        if (b) existingProjects.add(b);
      } else if (s.objective_type === "metric") {
        const key = String(cfg.key ?? "");
        if (key) {
          const arr = existingMetrics.get(key) ?? [];
          arr.push({ op: cfg.op === "<=" ? "<=" : ">=", value: Number(cfg.value ?? 0) });
          existingMetrics.set(key, arr);
        }
      }
    }
    const isDuplicate = (p: StageProposal): boolean => {
      if (p.title && existingTitles.has(norm(p.title))) return true;
      const cfg = p.objectiveConfig;
      if (p.objectiveType === "project") return existingProjects.has(String(cfg.bucket_id ?? ""));
      if (p.objectiveType === "metric") {
        const key = String(cfg.key ?? "");
        const op = cfg.op === "<=" ? "<=" : ">=";
        const value = Number(cfg.value ?? 0);
        const existing = existingMetrics.get(key);
        if (!existing) return false;
        // Duplicate = same metric, same direction, existing target already
        // equal-or-more-ambitious. A strictly tougher rung is allowed through.
        return existing.some((e) => e.op === op && (op === ">=" ? e.value >= value : e.value <= value));
      }
      return false;
    };

    const currentStages = existingStages.map((s) => ({
      name: s.title ?? s.template_key ?? "stage",
      measure: describeMeasure(s.objective_type, (s.objective_config ?? {}) as JsonObject),
      optional: s.optional,
    }));

    const prompt = data.request?.trim()
      ? `User request: "${data.request.trim()}"\n\nFacts: ${JSON.stringify(facts)}\n\nCurrent stages: ${JSON.stringify(currentStages)}`
      : `Review this roadmap and suggest improvements or missing stages.\n\nFacts: ${JSON.stringify(facts)}\n\nCurrent stages: ${JSON.stringify(currentStages)}`;

    // Use plain generateText (the same call the working coach chat uses) and ask
    // strictly for JSON — the Lovable gateway rejects structured-output requests.
    try {
      const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
      const res = await generateText({
        model: gateway(MODEL),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        system: `${SYSTEM}\n\nRespond ONLY with a JSON object of the form {"note": string, "proposals": [{"title": string, "objective": string, "optional": boolean, "rationale": string, "measure": {"metric": string|null, "op": string|null, "value": number|null, "project": string|null} | null}]}. No prose, no code fences, no markdown.`,
        prompt,
      });
      const obj = extractJson(res.text);
      const raw: unknown[] = obj && Array.isArray(obj.proposals) ? (obj.proposals as unknown[]) : [];
      const proposals: StageProposal[] = raw
        .map((p) => {
          const o = (p ?? {}) as JsonObject;
          const measure = (o.measure ?? {}) as JsonObject;
          // Bind a real objective when the coach referenced a metric or an
          // existing project — that's what makes progress track automatically.
          const projName = measure.project != null ? String(measure.project).trim().toLowerCase() : "";
          const proj = projName
            ? projList.find((x) => x.name.trim().toLowerCase() === projName && x.target > 0)
            : null;
          let objectiveType: "metric" | "project" | "custom" = "custom";
          let objectiveConfig: JsonObject = {};
          if (proj) {
            objectiveType = "project";
            objectiveConfig = { bucket_id: proj.id };
          } else {
            const metric = measure.metric != null ? String(measure.metric) : "";
            if (METRIC_KEYS.has(metric) && typeof measure.value === "number") {
              objectiveType = "metric";
              objectiveConfig = { key: metric, op: measure.op === "<=" ? "<=" : ">=", value: Number(measure.value) };
            }
          }
          return {
            title: String(o.title ?? "").trim(),
            objective: String(o.objective ?? "").trim(),
            optional: Boolean(o.optional),
            rationale: String(o.rationale ?? "").trim(),
            objectiveType,
            objectiveConfig,
          };
        })
        .filter((p) => p.title)
        // Drop anything that duplicates a stage the household already has.
        .filter((p) => !isDuplicate(p))
        .slice(0, 4);
      // A successful call that yields no usable proposals is a genuine "nothing to
      // add", not an error — the UI shows the reassuring empty state.
      return { ok: true, note: typeof obj?.note === "string" ? obj.note : "", proposals };
    } catch {
      return { ok: false, note: "", proposals: [] as StageProposal[] };
    }
  });
