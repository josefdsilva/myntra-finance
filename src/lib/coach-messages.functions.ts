import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachMessage = {
  id: string;
  kind: string;
  severity: "info" | "success" | "warn" | "critical";
  title: string;
  body: string;
  action_label: string | null;
  action_url: string | null;
  cycle_start: string | null;
  read_at: string | null;
  created_at: string;
};

/** Recent inbox messages for a household (household-wide + this user's own). */
export const listCoachMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("coach_messages")
      .select(
        "id, kind, severity, title, body, action_label, action_url, cycle_start, read_at, created_at",
      )
      .eq("household_id", data.household_id)
      // dismissed_at is a temporary cast until types.ts is regenerated.
      .is("dismissed_at" as never, null)
      .order("created_at", { ascending: false })
      .limit(40);
    return ((rows as CoachMessage[] | null) ?? []);
  });

/** Count of unread messages, for the bell badge. */
export const unreadCoachCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { count } = await context.supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("household_id", data.household_id)
      .is("dismissed_at" as never, null)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

export const markCoachRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("coach_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("read_at", null);
    return { ok: true };
  });

export const markAllCoachRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("coach_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("household_id", data.household_id)
      .is("read_at", null);
    return { ok: true };
  });

export const dismissCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Soft-dismiss: keep the row (its dedupe_key blocks re-emit) and hide it.
    // A hard delete would drop the dedupe anchor and the coach would re-create
    // the same message on its next run. dismissed_at is a temporary cast until
    // types.ts is regenerated.
    await context.supabase
      .from("coach_messages")
      .update({ dismissed_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    return { ok: true };
  });
