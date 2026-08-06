import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cycleFor,
  cycleConfigForSpace,
  buildCyclesFromSalaries,
  buildTimeCycles,
  type CycleBounds,
} from "./cycle";

type Space = Parameters<typeof cycleConfigForSpace>[0];

/**
 * Resolve the current cycle for a space in one call. Every screen used to repeat
 * the same three steps — fetch the anchor income's `is_salary` receipts, build a
 * CycleConfig from the household row, and call cycleFor — so this centralises
 * them. Works with the user-scoped client and the admin client alike.
 */
export async function fetchCycleBounds(
  sb: SupabaseClient,
  householdId: string,
  space: Space,
  now?: Date,
): Promise<CycleBounds> {
  const { data } = await sb
    .from("expenses")
    .select("occurred_at")
    .eq("household_id", householdId)
    .eq("kind", "income")
    .eq("is_salary", true)
    .order("occurred_at", { ascending: false })
    .limit(12);
  const dates = ((data ?? []) as Array<{ occurred_at: string }>).map((r) => r.occurred_at);
  return cycleFor(cycleConfigForSpace(space), dates, now);
}

/**
 * Same as fetchCycleBounds but for callers that don't already hold the household
 * row: fetches the space config and the salary receipts in parallel, so there's
 * no extra serial round-trip.
 */
export async function fetchCycleBoundsById(
  sb: SupabaseClient,
  householdId: string,
  now?: Date,
): Promise<CycleBounds> {
  const [{ data: space }, { data: salaries }] = await Promise.all([
    sb
      .from("households")
      .select("kind, cycle, cycle_mode, cycle_anchor_date")
      .eq("id", householdId)
      .maybeSingle(),
    sb
      .from("expenses")
      .select("occurred_at")
      .eq("household_id", householdId)
      .eq("kind", "income")
      .eq("is_salary", true)
      .order("occurred_at", { ascending: false })
      .limit(12),
  ]);
  const dates = ((salaries ?? []) as Array<{ occurred_at: string }>).map((r) => r.occurred_at);
  return cycleFor(cycleConfigForSpace(space), dates, now);
}

/**
 * Earliest instant a space can have history for: the first day of real activity
 * (oldest expense/income entry) or, failing that, when the space was created.
 * Time-driven spaces have fiscal periods stretching infinitely into the past, so
 * without this floor a brand-new space would "inherit" a year of empty cycles.
 */
async function spaceHistoryFloor(sb: SupabaseClient, householdId: string): Promise<Date | null> {
  const [{ data: hh }, { data: firstEntry }] = await Promise.all([
    sb.from("households").select("created_at, onboarded_at").eq("id", householdId).maybeSingle(),
    sb
      .from("expenses")
      .select("occurred_at")
      .eq("household_id", householdId)
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const candidates: number[] = [];
  const created = (hh as { created_at?: string } | null)?.created_at;
  if (created) candidates.push(new Date(created).getTime());
  const first = (firstEntry as { occurred_at?: string } | null)?.occurred_at;
  if (first) candidates.push(new Date(first).getTime());
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates));
}

/**
 * The last `count` CLOSED cycles for a space (oldest first) — the windows the
 * compounding-value history is built from. Unifies both modes: a time-driven
 * space uses its fixed fiscal periods, an event space uses the spans between
 * consecutive salary receipts. The currently-running cycle is always excluded
 * (only bounded, finished cycles are returned), and nothing before the space
 * actually existed is ever returned.
 */
export async function resolveClosedCycles(
  sb: SupabaseClient,
  householdId: string,
  space: Space,
  count = 12,
  now: Date = new Date(),
): Promise<Array<{ start: Date; end: Date }>> {
  const config = cycleConfigForSpace(space);
  if (config.mode === "time") {
    // Build a few extra to be safe, then keep only finished periods.
    const spans = buildTimeCycles(config.length, config.anchorDate, count + 1, now);
    const floor = await spaceHistoryFloor(sb, householdId);
    return spans
      .filter((s) => s.end.getTime() <= now.getTime())
      .filter((s) => !floor || s.end.getTime() > floor.getTime())
      .slice(-count)
      .map(({ start, end }) => ({ start, end }));
  }
  const { data } = await sb
    .from("expenses")
    .select("occurred_at")
    .eq("household_id", householdId)
    .eq("kind", "income")
    .eq("is_salary", true)
    .order("occurred_at", { ascending: true })
    .limit(count + 2);
  const asc = ((data ?? []) as Array<{ occurred_at: string }>).map((r) => r.occurred_at);
  return buildCyclesFromSalaries(asc)
    .filter((s) => !s.predicted && s.end.getTime() <= now.getTime())
    .slice(-count)
    .map(({ start, end }) => ({ start, end }));
}


/**
 * The cycle-config fields to fold into a React Query key so a query re-runs when
 * the space's cycle setup changes. Spread it: queryKey: ["x", id, ...cycleKeyPart(space)].
 */
export function cycleKeyPart(
  space:
    | { cycle_mode?: string | null; cycle?: string | null; cycle_anchor_date?: string | null }
    | null
    | undefined,
) {
  return [space?.cycle_mode ?? null, space?.cycle ?? null, space?.cycle_anchor_date ?? null] as const;
}
