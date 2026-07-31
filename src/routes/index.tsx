import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta({
      path: "/",
      title: "bynku — daily safe-to-spend & household allocations",
      description:
        "bynku turns your income, bills and loans into one number: what you can safely spend today. Shared household budgeting with allocation buckets and AI expense capture.",
    }),
  component: IndexFallback,
});

function IndexFallback() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return null;
}
