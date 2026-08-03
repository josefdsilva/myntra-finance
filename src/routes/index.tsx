import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  // Signed-in visitors skip the marketing page and go straight to the app.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  return <LandingPage />;
}
