import { createFileRoute, redirect } from "@tanstack/react-router";

// Job / salary change is now a scenario event inside Fast Forward. Keep the
// path as a redirect so any old link or bookmark lands in the right place.
export const Route = createFileRoute("/_authenticated/job-change")({
  beforeLoad: () => {
    throw redirect({ to: "/fast-forward" });
  },
});
