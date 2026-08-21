import { createFileRoute, redirect } from "@tanstack/react-router";

// Financial statements were a business-only feature. Bynku is household-only now,
// so this route just redirects to the dashboard. This file can be deleted and the
// route tree regenerated when convenient.
export const Route = createFileRoute("/_authenticated/statements")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
