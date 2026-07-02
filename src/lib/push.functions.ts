import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
        user_agent: z.string().max(500).optional().nullable(),
        household_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions" as never)
      .upsert(
        {
          user_id: context.userId,
          household_id: data.household_id ?? null,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        } as never,
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_prefs" as never)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (
      (data as { weekly_digest: boolean; baseline_warn: boolean; emergency_warn: boolean } | null) ?? {
        weekly_digest: false,
        baseline_warn: false,
        emergency_warn: false,
      }
    );
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        weekly_digest: z.boolean().optional(),
        baseline_warn: z.boolean().optional(),
        emergency_warn: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("notification_prefs" as never).upsert(
      {
        user_id: context.userId,
        ...data,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_subscriptions" as never)
      .select("id, endpoint, user_agent, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return (data as Array<{ id: string; endpoint: string; user_agent: string | null; created_at: string }> | null) ?? [];
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const deleteAllMyDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error, count } = await context.supabase
      .from("push_subscriptions" as never)
      .delete({ count: "exact" })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { removed: count ?? 0 };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: z.string().optional().nullable() }).optional().parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("push_subscriptions" as never)
      .select("*")
      .eq("user_id", context.userId);
    if (data?.endpoint) q = q.eq("endpoint", data.endpoint);
    const { data: subs } = await q;
    const list = (subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null }> | null) ?? [];
    if (!list.length) throw new Error("No subscribed devices for this account.");
    const { sendWebPush } = await import("./webpush.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ id: string; host: string; ua: string | null; ok: boolean; status: number; expired: boolean; removed: boolean; error?: string }> = [];
    for (const s of list) {
      const host = (() => { try { return new URL(s.endpoint).host; } catch { return "unknown"; } })();
      const r = await sendWebPush(s, {
        title: "Notifications enabled ✓",
        body: "You'll now receive selected alerts from Myntra.",
        url: "/dashboard",
        tag: "test",
      });
      let removed = false;
      if (!r.ok && r.expired) {
        await supabaseAdmin.from("push_subscriptions" as never).delete().eq("id", s.id);
        removed = true;
      }
      results.push({
        id: s.id,
        host,
        ua: s.user_agent,
        ok: r.ok,
        status: r.ok ? 201 : r.status,
        expired: r.ok ? false : r.expired,
        removed,
        error: r.ok ? undefined : r.error,
      });
    }
    return { sent: results.filter((r) => r.ok).length, total: results.length, results };
  });
