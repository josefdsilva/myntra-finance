import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_EMAILS = new Set(["eng.nandomoreira@gmail.com", "rosa.am.martins88@gmail.com"]);

export const enforceAllowlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (email && ALLOWED_EMAILS.has(email)) {
      return { allowed: true as const, email };
    }
    // Not allowed — delete the orphan auth user so they don't linger / cost resources.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      await supabaseAdmin.auth.admin.deleteUser(context.userId);
    } catch (e) {
      console.error("Failed to delete non-allowlisted user", e);
    }
    return { allowed: false as const, email: email ?? null };
  });
