import type { SupabaseClient } from "@supabase/supabase-js";

// The single funnel every proactive nudge goes through. It writes the in-app
// coach inbox (the source of truth) and then, only for a freshly-created
// message, amplifies to the opt-in channels (web push, email) per each target
// user's notification preferences. Idempotent: the (household_id, dedupe_key)
// unique constraint means a re-run never double-posts or re-notifies.

export type CoachSeverity = "info" | "success" | "warn" | "critical";

export type CoachEmit = {
  householdId: string;
  /** null / omitted = the whole household; set to target one member. */
  userId?: string | null;
  kind: string;
  severity?: CoachSeverity;
  title: string;
  body?: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  data?: Record<string, unknown>;
  cycleStart?: string | null;
  /** Stable key so the same nudge is only ever posted once per household. */
  dedupeKey: string;
  /** Eligible for a push (still gated by the user's push_enabled + a device). */
  push?: boolean;
  /** When set and the user has email on, enqueue this template. */
  email?: { templateName: string; templateData: Record<string, unknown> } | null;
};

type Admin = SupabaseClient;

type Prefs = { push_enabled?: boolean; email_enabled?: boolean } | null;

async function targetUserIds(admin: Admin, householdId: string, userId?: string | null) {
  if (userId) return [userId];
  const { data } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  return ((data as Array<{ user_id: string }> | null) ?? []).map((m) => m.user_id);
}

/**
 * Emit one proactive message. Returns { created } so callers can tell whether it
 * was new (and thus amplified) or a deduped no-op.
 */
export async function emitCoachMessage(admin: Admin, msg: CoachEmit): Promise<{ created: boolean }> {
  // Never post a blank message — a title is the minimum a nudge must carry.
  if (!msg.title?.trim()) {
    console.warn("emitCoachMessage skipped: empty title", msg.kind, msg.dedupeKey);
    return { created: false };
  }
  const row = {
    household_id: msg.householdId,
    user_id: msg.userId ?? null,
    kind: msg.kind,
    severity: msg.severity ?? "info",
    title: msg.title,
    body: msg.body ?? "",
    action_label: msg.actionLabel ?? null,
    action_url: msg.actionUrl ?? null,
    data: msg.data ?? {},
    cycle_start: msg.cycleStart ?? null,
    dedupe_key: msg.dedupeKey,
  };

  // Insert-if-new. ignoreDuplicates keeps it idempotent; an empty return means
  // the message already existed, so we must not re-notify.
  const { data: inserted, error } = await admin
    .from("coach_messages")
    .upsert(row as never, { onConflict: "household_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("emitCoachMessage insert failed", error);
    return { created: false };
  }
  const created = Array.isArray(inserted) && inserted.length > 0;
  if (!created) return { created: false };

  // Amplify to opt-in channels.
  const users = await targetUserIds(admin, msg.householdId, msg.userId);
  for (const uid of users) {
    const { data: pref } = await admin
      .from("notification_prefs")
      .select("push_enabled, email_enabled")
      .eq("user_id", uid)
      .maybeSingle();
    const prefs = (pref as Prefs) ?? null;
    const pushOn = prefs?.push_enabled ?? true;
    const emailOn = prefs?.email_enabled ?? false;

    if (pushOn && msg.push !== false) {
      try {
        const { sendWebPush } = await import("./webpush.server");
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", uid);
        const list =
          (subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }> | null) ??
          [];
        for (const s of list) {
          const r = await sendWebPush(s, {
            title: msg.title,
            body: (msg.body ?? "").slice(0, 480),
            url: msg.actionUrl ?? "/dashboard",
            tag: msg.kind,
          });
          if (!r.ok && r.expired) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", s.id);
          }
        }
      } catch (e) {
        console.error("coach push amplify failed", e);
      }
    }

    if (emailOn && msg.email) {
      try {
        const { enqueueTemplateEmail } = await import("@/lib/email/send.server");
        const { data: userInfo } = await admin.auth.admin.getUserById(uid);
        const recipient = userInfo?.user?.email;
        if (recipient) {
          await enqueueTemplateEmail({
            templateName: msg.email.templateName,
            recipientEmail: recipient,
            idempotencyKey: `coach:${msg.householdId}:${uid}:${msg.dedupeKey}`,
            templateData: msg.email.templateData,
          });
        }
      } catch (e) {
        console.error("coach email amplify failed", e);
      }
    }
  }

  return { created: true };
}
