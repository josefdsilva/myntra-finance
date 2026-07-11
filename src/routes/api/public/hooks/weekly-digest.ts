import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional force override for manual triggering: ?force=1
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";

        // Gate: only run when it's Monday 08:xx Europe/Lisbon
        const fmt = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Lisbon",
          weekday: "short",
          hour: "2-digit",
          hour12: false,
        });
        const parts = Object.fromEntries(
          fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
        );
        const isMonday = parts.weekday?.startsWith("Mon");
        const isEight = parts.hour === "08";
        if (!force && (!isMonday || !isEight)) {
          return Response.json({
            skipped: true,
            reason: `not Monday 08:00 Europe/Lisbon (${parts.weekday} ${parts.hour}:00)`,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/webpush.server");

        const { data: prefs } = await supabaseAdmin
          .from("notification_prefs" as never)
          .select("user_id")
          .eq("weekly_digest", true);
        const optedIn = (prefs as Array<{ user_id: string }> | null) ?? [];
        if (!optedIn.length) return Response.json({ sent: 0, reason: "no opted-in users" });

        const now = new Date();
        const weekStart = new Date(now.getTime() - 7 * 86400_000);
        const prevStart = new Date(now.getTime() - 14 * 86400_000);

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
          const hhId = mem.household_id;

          const { data: hh } = await supabaseAdmin
            .from("households")
            .select("baseline_budget")
            .eq("id", hhId)
            .single();
          const baseline = Number(hh?.baseline_budget ?? 0);

          const { data: rows } = await supabaseAdmin
            .from("expenses")
            .select("amount, merchant, note, category, kind, is_salary, occurred_at")
            .eq("household_id", hhId)
            .gte("occurred_at", prevStart.toISOString())
            .lt("occurred_at", now.toISOString());

          type Row = {
            amount: number | string;
            merchant: string | null;
            note: string | null;
            category: string | null;
            kind: string;
            is_salary: boolean;
            occurred_at: string;
          };
          const all = (rows as Row[] | null) ?? [];
          const inRange = (r: Row, s: Date, e: Date) =>
            new Date(r.occurred_at) >= s && new Date(r.occurred_at) < e;
          const last = all.filter((r) => inRange(r, weekStart, now) && !r.is_salary);
          const prev = all.filter((r) => inRange(r, prevStart, weekStart) && !r.is_salary);
          const sumBy = (arr: Row[], pred: (r: Row) => boolean) =>
            arr.filter(pred).reduce((s, r) => s + Number(r.amount), 0);
          const spentLast = sumBy(last, (r) => r.kind !== "income");
          const receivedLast = sumBy(last, (r) => r.kind === "income");
          const spentPrev = sumBy(prev, (r) => r.kind !== "income");
          const receivedPrev = sumBy(prev, (r) => r.kind === "income");
          const topSpent = [...last.filter((r) => r.kind !== "income")]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 3);
          const topReceived = [...last.filter((r) => r.kind === "income")]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 3);

          const [{ data: fixed }, { data: debts }] = await Promise.all([
            supabaseAdmin
              .from("fixed_expenses")
              .select("monthly_amount")
              .eq("household_id", hhId),
            supabaseAdmin.from("debts").select("monthly_amount").eq("household_id", hhId),
          ]);
          const sumMonthly = (
            rows: Array<{ monthly_amount: number | string }> | null,
          ) => (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
          const fixedTotal = sumMonthly(fixed) + sumMonthly(debts);
          const variablePool = Math.max(0, baseline - fixedTotal);

          const { data: incomes } = await supabaseAdmin
            .from("incomes")
            .select("monthly_amount")
            .eq("household_id", hhId);
          const income = (
            (incomes as Array<{ monthly_amount: number | string }> | null) ?? []
          ).reduce((s, r) => s + Number(r.monthly_amount), 0);
          const surplus = Math.max(0, income - baseline);

          // AI outlook
          let aiText = "";
          try {
            const apiKey = process.env.LOVABLE_API_KEY;
            if (apiKey) {
              const promptPayload = {
                spentLast: Math.round(spentLast),
                receivedLast: Math.round(receivedLast),
                spentPrev: Math.round(spentPrev),
                receivedPrev: Math.round(receivedPrev),
                variablePool: Math.round(variablePool),
                surplus: Math.round(surplus),
                topSpent: topSpent.map((x) => ({
                  m: x.merchant || x.note || x.category,
                  a: Math.round(Number(x.amount)),
                })),
                topReceived: topReceived.map((x) => ({
                  m: x.merchant || x.note || x.category,
                  a: Math.round(Number(x.amount)),
                })),
              };
              const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are a concise household budget coach. Reply in <=45 words, plain text, no markdown, EUR currency, friendly but direct.",
                    },
                    {
                      role: "user",
                      content: `Weekly stats: ${JSON.stringify(
                        promptPayload,
                      )}. Compare last vs previous week, comment on pace vs remaining variable pool (${variablePool.toFixed(
                        0,
                      )} EUR/cycle) and give one specific tip for the upcoming week.`,
                    },
                  ],
                }),
              });
              const j = (await res.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
              };
              aiText = j?.choices?.[0]?.message?.content?.toString().trim() ?? "";
            }
          } catch (e) {
            console.error("weekly-digest ai failed", e);
          }

          const trend = spentLast - spentPrev;
          const body = [
            `Spent €${spentLast.toFixed(0)} (${trend >= 0 ? "+" : ""}${trend.toFixed(0)} vs prev)`,
            `Received €${receivedLast.toFixed(0)}`,
            `Pool €${variablePool.toFixed(0)} · Emergency €${surplus.toFixed(0)}`,
            aiText,
          ]
            .filter(Boolean)
            .join(" · ");

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions" as never)
            .select("*")
            .eq("user_id", p.user_id);
          const list =
            (subs as Array<{
              id: string;
              endpoint: string;
              p256dh: string;
              auth: string;
            }> | null) ?? [];
          for (const s of list) {
            const r = await sendWebPush(s, {
              title: "Weekly overview",
              body: body.slice(0, 480),
              url: "/analysis",
              tag: "weekly-digest",
            });
            if (r.ok) sent++;
            else if (r.expired) {
              await supabaseAdmin
                .from("push_subscriptions" as never)
                .delete()
                .eq("id", s.id);
            }
          }

          await supabaseAdmin.from("notification_log" as never).insert({
            user_id: p.user_id,
            kind: "weekly_digest",
            payload_hash: `weekly:${weekStart.toISOString().slice(0, 10)}`,
          } as never);

          details.push({ user_id: p.user_id, devices: list.length, spentLast, receivedLast });
        }

        return Response.json({ sent, details });
      },
    },
  },
});
