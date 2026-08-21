import { createFileRoute } from "@tanstack/react-router";

// Retired: this was a daily coach pass for business spaces, which no longer
// exist (Bynku is household-only). Kept as a no-op so any external scheduler
// still hitting the URL gets a clean 200. This file can be deleted and the route
// tree regenerated when convenient.
export const Route = createFileRoute("/api/public/hooks/coach-business-daily")({
  server: {
    handlers: {
      POST: async () => Response.json({ emitted: 0, retired: true }),
    },
  },
});
