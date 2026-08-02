import { createFileRoute } from "@tanstack/react-router";
import type { Plan } from "@/lib/plan";

/**
 * Cycle-start email: once a household's pay/fiscal cycle rolls over, send the
 * members an outlook for the fresh cycle (expected income, planned spend,
 * projected leftover/shortfall, and the specific plans landing). Idempotent per
 * (user, cycle start) so re-runs never double-send.
 *
 * Trigger daily (an hourly cron is fine — the hour gate + idempotency key keep
 * it to one send per cycle). Pass ?force=1 to bypass the hour gate for testing.
 */
export const Route = createFileRoute("/api/public/hooks/cycle-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";

        // Run once a day, around 08:xx Europe/Lisbon. Idempotency still protects
        // against a cron that fires more than once in that hour.
        const fmt = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Lisbon",
          hour: "2-digit",
          hour12: false,
        });
        const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
        if (!force && parts.hour !== "08") {
          return Response.json({ skipped: true, reason: `not 08:00 Europe/Lisbon (${parts.hour}:00)` });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enqueueTemplateEmail } = await import("@/lib/email/send.server");
        const { fetchCycleBoundsById } = await import("@/lib/cycle-bounds");
        const { plansInWindow } = await import("@/lib/plan");
        const { snapshotJustClosedCycle } = await import("@/lib/cycle-metrics.functions");

        // Reuse the weekly-digest opt-in as the email-notifications gate.
        const { data: prefs } = await supabaseAdmin
          .from("notification_prefs" as never)
          .select("user_id")
          .eq("weekly_digest", true);
        const optedIn = (prefs as Array<{ user_id: string }> | null) ?? [];
        if (!optedIn.length) return Response.json({ sent: 0, reason: "no opted-in users" });

        const now = new Date();
        let sent = 0;
        const details: Array<Record<string, unknown>> = [];

        for (const p of optedIn) {
          const { data: mem } = await supabaseAdmin
            .from("household_members")
            .select("household_id")
            .eq("user_id", p.user_id)
            .limit(1)
            .maybeSingle();
          if (!mem) continue;
          const hhId = mem.household_id as string;

          // Where is this household in its cycle? Only email in the first day or
          // two after a rollover.
          const cycle = await fetchCycleBoundsById(supabaseAdmin as never, hhId, now);
          const daysSinceStart = Math.floor((now.getTime() - cycle.start.getTime()) / 86400000);
          if (daysSinceStart > 1) {
            details.push({ user_id: p.user_id, skipped: "cycle not fresh", daysSinceStart });
            continue;
          }

          // A fresh rollover means the previous cycle just closed — snapshot it
          // for the compounding-value history. Best-effort; never blocks the email.
          try {
            const { data: sp } = await supabaseAdmin
              .from("households")
              .select("kind, cycle, cycle_mode, cycle_anchor_date")
              .eq("id", hhId)
              .maybeSingle();
            await snapshotJustClosedCycle(supabaseAdmin as never, hhId, sp, "cron", now);
          } catch (e) {
            console.error("cron cycle snapshot failed", hhId, e);
          }

          const [{ data: hh }, { data: incomeRows }, { data: plansData }] = await Promise.all([
            supabaseAdmin
              .from("households")
              .select("name, currency, baseline_budget")
              .eq("id", hhId)
              .maybeSingle(),
            supabaseAdmin.from("incomes").select("monthly_amount").eq("household_id", hhId),
            supabaseAdmin
              .from("plans")
              .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
              .eq("household_id", hhId),
          ]);

          const baseline = Number(hh?.baseline_budget ?? 0);
          const monthlyIncome = ((incomeRows as Array<{ monthly_amount: number | string }> | null) ?? []).reduce(
            (s, r) => s + Number(r.monthly_amount),
            0,
          );
          const planList = ((plansData as Plan[] | null) ?? []) as Plan[];

          // Plans landing in this cycle's real window (payday cycles straddle
          // two calendar months). Planned spend = fixed + debt + everyday
          // baseline + any planned one-off not pre-funded by a project.
          const winPlans = plansInWindow(planList, cycle.start, cycle.end);
          const incomePlans = winPlans
            .filter((pl) => pl.direction === "income")
            .reduce((s, pl) => s + Math.abs(Number(pl.amount) || 0), 0);
          const spendUnfunded = winPlans
            .filter((pl) => pl.direction === "spend" && !pl.bucket_id)
            .reduce((s, pl) => s + Math.abs(Number(pl.amount) || 0), 0);
          const expectedIncome = monthlyIncome + incomePlans;
          const plannedSpend = baseline + spendUnfunded;
          const leftover = expectedIncome - plannedSpend;

          const plans = winPlans.map((pl) => ({
            label: pl.label,
            amount: Math.abs(Number(pl.amount) || 0),
            direction: pl.direction,
            funded: !!pl.bucket_id,
          }));

          const dfmt = new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const monthLabelStr = `${dfmt.format(cycle.start)} – ${dfmt.format(cycle.end)}`;

          let emailQueued = false;
          try {
            const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
            const recipient = userInfo?.user?.email;
            if (recipient) {
              const cycleKey = cycle.start.toISOString().slice(0, 10);
              const r = await enqueueTemplateEmail({
                templateName: "cycle-start",
                recipientEmail: recipient,
                idempotencyKey: `cycle-start:${p.user_id}:${cycleKey}`,
                templateData: {
                  siteName: "bynku",
                  appUrl: "https://bynku.app",
                  householdName: hh?.name ?? undefined,
                  monthLabel: monthLabelStr,
                  expectedIncome: Math.round(expectedIncome),
                  plannedSpend: Math.round(plannedSpend),
                  leftover: Math.round(leftover),
                  shortfall: leftover < 0,
                  plans,
                  currency: hh?.currency ?? "EUR",
                },
              });
              emailQueued = r.ok;
              if (r.ok) sent++;
            }
          } catch (e) {
            console.error("cycle-start email enqueue failed", e);
          }

          details.push({ user_id: p.user_id, cycleStart: cycle.start.toISOString(), plans: plans.length, emailQueued });
        }

        return Response.json({ sent, details });
      },
    },
  },
});
