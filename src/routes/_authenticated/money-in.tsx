import { createFileRoute, redirect } from "@tanstack/react-router";

// Money-in folded into the Payables & Receivables hub (Recurring lens). Keep the
// route as a redirect so old links and bookmarks land on the hub.
export const Route = createFileRoute("/_authenticated/money-in")({
  beforeLoad: () => {
    throw redirect({ to: "/cashflow", search: { lens: undefined } });
  },
});
