import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatherCycleFacts, type CycleFactsSpace } from "@/lib/household-facts";

// Canonical inputs for the household "issues & tips" list. The dashboard card and
// the app-wide issues bell both build their tips off this single source, so the
// two always show the exact same list (and dismissal stays in sync). Cycle math
// comes from the shared `gatherCycleFacts`; we add the two pace inputs (days left
// and 7-day spend) plus the household demographics the tight-budget tips need.
export const issueFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const hid = data.household_id;
    const now = new Date();
    const { data: hh } = await context.supabase
      .from("households")
      .select(
        "id, baseline_budget, kind, cycle, cycle_mode, cycle_anchor_date, country, adults, children, age_band, margin_pct",
      )
      .eq("id", hid)
      .maybeSingle();
    if (!hh) return null;

    const space: CycleFactsSpace = {
      id: hid,
      baseline_budget: hh.baseline_budget,
      kind: hh.kind,
      cycle: hh.cycle,
      cycle_mode: hh.cycle_mode,
      cycle_anchor_date: hh.cycle_anchor_date,
    };
    const facts = await gatherCycleFacts(context.supabase, space, now);

    const msDay = 86_400_000;
    const daysLeft = Math.max(1, Math.ceil((facts.cycleEnd.getTime() - now.getTime()) / msDay));

    // Everyday spend pace — feeds the overspend-pace and estimates-realism tips.
    // The window never reaches back before the current cycle started: spend from
    // the previous cycle (typically a big payday-week purchase) would otherwise
    // project an overspend onto a cycle where nothing has been spent yet.
    const windowStart = new Date(
      Math.max(now.getTime() - 7 * msDay, facts.cycleStart.getTime()),
    );
    // Floor at 3 days so the first hours of a cycle don't extrapolate one coffee
    // into a month of overspending.
    const windowDays = Math.max(3, (now.getTime() - windowStart.getTime()) / msDay);
    const { data: recent } = await context.supabase
      .from("expenses")
      .select("amount")
      .eq("household_id", hid)
      .eq("kind", "expense")
      .gte("occurred_at", windowStart.toISOString());
    const spent7 = (recent ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const avgDaily7 = spent7 / windowDays;


    return {
      baseline: facts.baseline,
      income: facts.monthlyIncome,
      surplus: facts.surplus,
      variablePool: facts.variablePool,
      netSpent: facts.netSpent,
      daysLeft,
      avgDaily7,
      cycleKey: facts.cycleKey,
      // Exact cycle window, so client-side tips can count what actually moved in
      // THIS cycle (payday cycles rarely align with calendar months).
      cycleStartIso: facts.cycleStart.toISOString(),
      cycleEndIso: facts.cycleEnd.toISOString(),
      country: (hh.country as string | null) ?? null,
      adults: Number(hh.adults ?? 1),
      children: Number(hh.children ?? 0),
      ageBand: (hh.age_band as string | null) ?? null,
      marginPct: Number(hh.margin_pct ?? 10),
      cycle: (hh.cycle as string | null) ?? null,
    };
  });
