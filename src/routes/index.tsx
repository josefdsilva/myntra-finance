import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LandingPage } from "@/components/landing-page";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta({
      path: "/",
      title: "bynku — daily safe-to-spend & household allocations",
      description:
        "bynku turns your income, bills and loans into one number: what you can safely spend today. Shared household and small-business budgeting with an AI coach that is committed to improving your financial position, not selling you products.",
    }),
  // Redirect signed-in visitors into the app before the landing renders, so it
  // never flashes on a client navigation (e.g. pressing back). The check is
  // client-only: during SSR there is no session to read (it lives in the
  // browser), and skipping it keeps the public landing fast to render.
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LandingPage,
});
