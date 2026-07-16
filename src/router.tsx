import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for a minute so navigating between screens (and
        // re-mounting the same components) doesn't refire every query. Mutations
        // still call invalidateQueries explicitly, so edits show up immediately.
        staleTime: 60_000,
        // Keep unused data cached for 5 minutes before garbage-collecting.
        gcTime: 5 * 60_000,
        // A budgeting dashboard doesn't need to refetch everything each time the
        // window regains focus; it caused redundant network churn.
        refetchOnWindowFocus: false,
        // Fail fast instead of retrying three times on a genuine error.
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
