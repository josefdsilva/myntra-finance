import { createFileRoute } from "@tanstack/react-router";
import { computeCycle } from "@/lib/cycle";

export const Route = createFileRoute("/api/public/hooks/budget-alerts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/webpush.server");

        const { data: prefs } = await supabaseAdmin
          .from("notification_prefs" as never)
          .select("user_id, baseline_warn, emergency_warn")
          .or("baseline_warn.eq.true,emergency_warn.eq.true");
        const prefList = (prefs as Array<{ user_id: string; baseline_warn: boolean; emergency_warn: boolean }> | null) ?? [];
        if (!prefList.length) return Response.json({ sent: 0, reason: "no opted-in users" });

        const userIds = prefList.map((p) => p.user_id);
        const { data: mems } = await supabaseAdmin
          .from("household_members")
          .select("user_id, household_id")
          .in("user_id", userIds);
        const byHousehold = new Map<string, string[]>();
        for (const m of (mems ?? []) as Array<{ user_id: string; household_id: string }>) {
          const arr = byHousehold.get(m.household_id) ?? [];
          arr.push(m.user_id);
          byHousehold.set(m.household_id, arr);
        }

        let sent = 0;
        for (const [hhId, userList] of byHousehold) {
          const { data: hh } = await supabaseAdmin
            .from("households")
            .select("baseline_budget")
            .eq("id", hhId)
            .single();
          const baseline = Number(hh?.baseline_budget ?? 0);
          if (baseline <= 0) continue;

          const { data: salaries } = await supabaseAdmin
            .from("expenses")
            .select("occurred_at")
            .eq("household_id", hhId)
            .eq("kind", "income")
            .eq("is_salary", true)
            .order("occurred_at", { ascending: false })
            .limit(6);
          const cycle = computeCycle(((salaries as Array<{ occurred_at: string }> | null) ?? []).map((r) => r.occurred_at));

          const { data: fixed } = await supabaseAdmin
            .from("fixed_expenses")
            .select("monthly_amount")
            .eq("household_id", hhId);
          const fixedTotal = ((fixed as Array<{ monthly_amount: number | string }> | null) ?? []).reduce(
            (s, r) => s + Number(r.monthly_amount),
            0,
          );
          const variablePool = Math.max(0, baseline - fixedTotal);

          const { data: cycleExp } = await supabaseAdmin
            .from("expenses")
            .select("amount, kind, is_salary")
            .eq("household_id", hhId)
            .gte("occurred_at", cycle.start.toISOString())
            .lt("occurred_at", cycle.end.toISOString());
          type Row = { amount: number | string; kind: string; is_salary: boolean };
          const rows = (cycleExp as Row[] | null) ?? [];
          const spent = rows.filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
          const received = rows.filter((r) => r.kind === "income" && !r.is_salary).reduce((s, r) => s + Number(r.amount), 0);
          const netSpent = Math.max(0, spent - received);
          const baselineRatio = variablePool > 0 ? netSpent / variablePool : netSpent > 0 ? 1 : 0;

          const { data: incomes } = await supabaseAdmin
            .from("incomes")
            .select("monthly_amount")
            .eq("household_id", hhId);
          const income = ((incomes as Array<{ monthly_amount: number | string }> | null) ?? []).reduce(
            (s, r) => s + Number(r.monthly_amount),
            0,
          );
          const surplus = Math.max(0, income - baseline);
          const overspend = Math.max(0, netSpent - variablePool);
          const emergencyRatio = surplus > 0 ? overspend / surplus : overspend > 0 ? 1 : 0;

          const cycleKey = cycle.start.toISOString().slice(0, 10);

          const fire = async (userId: string, kind: string, phase: string, title: string, body: string) => {
            const payload_hash = `${kind}:${phase}:${cycleKey}`;
            const { error } = await supabaseAdmin
              .from("notification_log" as never)
              .insert({ user_id: userId, kind, payload_hash } as never);
            if (error) return; // unique violation → already sent this cycle
            const { data: subs } = await supabaseAdmin
              .from("push_subscriptions" as never)
              .select("*")
              .eq("user_id", userId);
            const list = (subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }> | null) ?? [];
            for (const s of list) {
              const r = await sendWebPush(s, { title, body, url: "/dashboard", tag: kind });
              if (r.ok) sent++;
              else if (r.expired) await supabaseAdmin.from("push_subscriptions" as never).delete().eq("id", s.id);
            }
          };

          for (const uid of userList) {
            const pref = prefList.find((p) => p.user_id === uid);
            if (!pref) continue;
            if (pref.baseline_warn) {
              if (baselineRatio >= 1) {
                await fire(
                  uid,
                  "baseline_reached",
                  "reached",
                  "Baseline reached",
                  `Cycle variable pool depleted (spent €${netSpent.toFixed(0)} of €${variablePool.toFixed(0)}).`,
                );
              } else if (baselineRatio >= 0.8) {
                await fire(
                  uid,
                  "baseline_warn",
                  "warn80",
                  "Baseline 80%",
                  `You've used ${Math.round(baselineRatio * 100)}% of the variable pool (€${netSpent.toFixed(0)}/€${variablePool.toFixed(0)}).`,
                );
              }
            }
            if (pref.emergency_warn && surplus > 0) {
              if (emergencyRatio >= 1) {
                await fire(
                  uid,
                  "emergency_depleted",
                  "reached",
                  "Emergency pool depleted",
                  `Overspend €${overspend.toFixed(0)} has consumed the full monthly surplus (€${surplus.toFixed(0)}).`,
                );
              } else if (emergencyRatio >= 0.8) {
                await fire(
                  uid,
                  "emergency_warn",
                  "warn80",
                  "Emergency pool at risk",
                  `Overspend €${overspend.toFixed(0)} is using ${Math.round(emergencyRatio * 100)}% of your emergency pool.`,
                );
              }
            }
          }
        }

        return Response.json({ sent });
      },
    },
  },
});
