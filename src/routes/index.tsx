import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LandingPage } from "@/components/landing-page";

export const Route = createFileRoute("/")({
  // Client-only so the session check in beforeLoad runs before anything paints.
  // Server rendering can't see the session (it lives in the browser), so an
  // SSR'd landing would flash for signed-in users before the redirect.
  ssr: false,
  head: () =>
    pageMeta({
      path: "/",
      title: "bynku — daily safe-to-spend & household allocations",
      description:
        "bynku turns your income, bills and loans into one number: what you can safely spend today. Shared household and small-business budgeting with an AI coach that is committed to improving your financial position, not selling you products.",
    }),
  // Client-side navigations to "/" (e.g. pressing back) redirect before the
  // landing renders, so it never flashes. Guarded to the client since the
  // session lives in the browser, not on the server.
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  // A cold load is server-rendered and the client does not re-run beforeLoad on
  // hydration, so a signed-in visitor would otherwise be stranded on the landing.
  // Re-check the session on mount and send them into the app.
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate]);
  return <LandingPage />;
}
