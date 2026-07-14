import { createFileRoute } from "@tanstack/react-router";
import { benchmarkVersions } from "@/lib/benchmarks";

/**
 * Latest public-data source year KNOWN to exist per country, maintained
 * independently of what is currently bundled in the app.
 *
 * This is the fix for the previously-dead version check: the endpoint used to
 * return the bundled `sourceYear`, which the client then compared against the
 * same bundled `sourceYear` — so the comparison was always equal and the
 * "newer data available" note could never appear.
 *
 * How to use it: when a newer Eurostat/INE reference year is published (e.g. a
 * new ilc_di01 income release or a new household budget survey wave), bump the
 * value here FIRST. The client will then surface a subtle "newer public data
 * available (YYYY)" note, reminding a maintainer to refresh the bundled JSON.
 * Once the JSON files are updated to that year, the note disappears on its own.
 *
 * Keep this in sync with (or ahead of) the `sourceYear` in each JSON file.
 */
const LATEST_SOURCE_YEARS: Record<string, number> = {
  PT: 2023,
  ES: 2023,
  DE: 2023,
  FR: 2023,
  IT: 2023,
  NL: 2023,
  IE: 2023,
};

/**
 * Returns the latest known `sourceYear` for each supported country. Falls back
 * to the bundled version if a country is missing from the registry above, so
 * the endpoint can never report a year older than what ships in the app.
 */
export const Route = createFileRoute("/api/public/benchmarks-version")({
  server: {
    handlers: {
      GET: async () => {
        const bundled = benchmarkVersions();
        const latest: Record<string, number> = { ...bundled };
        for (const [country, year] of Object.entries(LATEST_SOURCE_YEARS)) {
          latest[country] = Math.max(bundled[country] ?? 0, year);
        }
        return new Response(JSON.stringify(latest), {
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
