import { createFileRoute } from "@tanstack/react-router";
import { benchmarkVersions } from "@/lib/benchmarks";

/**
 * Returns the latest bundled `sourceYear` for each supported country.
 * The client compares this to the year in the loaded JSON and, when a
 * newer year is bundled in a future release, surfaces a subtle "newer
 * public data available" note in the Benchmarks card.
 */
export const Route = createFileRoute("/api/public/benchmarks-version")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify(benchmarkVersions()), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
