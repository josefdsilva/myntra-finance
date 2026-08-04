import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().min(3).max(320).email(),
  locale: z.string().trim().max(16).nullable().optional(),
});

/**
 * Public waiting-list signup. Runs server-side with validated input and writes
 * through the admin client, so no database function has to be exposed to
 * anonymous callers. Duplicate addresses are silently ignored.
 */
export const joinWaitlistFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("waitlist").insert({
      email: data.email,
      locale: data.locale ?? null,
      source: "landing",
      consent: true,
      consent_at: new Date().toISOString(),
    });

    // 23505 = unique violation (already on the list) -> treat as success.
    if (error && error.code !== "23505") {
      console.error("[waitlist] insert failed", error.code);
      throw new Error("Could not join the waiting list right now.");
    }

    return { ok: true };
  });
