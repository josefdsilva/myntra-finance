import { createFileRoute, redirect } from "@tanstack/react-router";

// The accountant handoff was a business-only feature. Bynku is household-only
// now, so this route just redirects to the dashboard. This file can be deleted
// and the route tree regenerated when convenient.
export const Route = createFileRoute("/_authenticated/handoff")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
