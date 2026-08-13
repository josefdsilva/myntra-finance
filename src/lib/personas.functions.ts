import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Admin-only tooling for synthetic test personas. Access is limited to the
// emails in the PERSONA_ADMIN_EMAILS secret; the heavy lifting lives in
// personas.server.ts so nothing server-only leaks into the client bundle.

export const listSyntheticPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPersonaAdmin, listPersonaStatus } = await import("./personas.server");
    assertPersonaAdmin((context.claims as { email?: string } | undefined)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { personas: await listPersonaStatus(supabaseAdmin) };
  });

export const seedSyntheticPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { assertPersonaAdmin, seedPersona } = await import("./personas.server");
    assertPersonaAdmin((context.claims as { email?: string } | undefined)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await seedPersona(supabaseAdmin, data.key);
  });

export const wipeSyntheticPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1), confirm: z.literal("WIPE") }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { assertPersonaAdmin, wipePersonaData } = await import("./personas.server");
    assertPersonaAdmin((context.claims as { email?: string } | undefined)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await wipePersonaData(supabaseAdmin, data.key);
    return { ok: true as const };
  });

/** Reveal the shared persona password so the admin can sign in as a persona. */
export const getSyntheticPersonaPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPersonaAdmin } = await import("./personas.server");
    assertPersonaAdmin((context.claims as { email?: string } | undefined)?.email);
    return { password: process.env["PERSONA_PASSWORD"] ?? "" };
  });
