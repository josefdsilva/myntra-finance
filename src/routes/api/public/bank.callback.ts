import { createFileRoute } from "@tanstack/react-router";

/**
 * GoCardless redirects the user's browser here after they consent on the
 * bank's site. Query params include `ref` (our connection id, set as
 * `reference` when the requisition was created). We just bounce back into
 * the app at /settings?bank_linked=<id>&tab=integrations so the Settings
 * page can call `finalizeGoCardlessLink` under the user's session.
 *
 * This lives under /api/public/* so it bypasses auth on the published site
 * (GoCardless can't carry our session cookie through the bank redirect).
 * Nothing sensitive happens here — the actual account read happens in the
 * authenticated finalize call.
 */
export const Route = createFileRoute("/api/public/bank/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // GoCardless passes our connectionId as `ref`; Enable Banking passes
        // it as `state` (and returns an auth `code` to exchange for a
        // session). Support both.
        const ref = url.searchParams.get("ref") ?? url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const target = new URL("/settings", url.origin);
        target.searchParams.set("tab", "integrations");
        if (error) {
          target.searchParams.set("bank_error", error);
        } else if (ref) {
          target.searchParams.set("bank_linked", ref);
          if (code) target.searchParams.set("bank_code", code);
        }
        return new Response(null, {
          status: 302,
          headers: { location: target.toString(), "cache-control": "no-store" },
        });
      },
    },
  },
});
