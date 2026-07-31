import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { useT } from "@/lib/i18n";
import { ShareCapture } from "@/components/share-capture";
import { pageShellClass } from "@/components/page-shell";

type ShareSearch = { title?: string; text?: string; url?: string };

export const Route = createFileRoute("/_authenticated/share")({
  head: () =>
    pageMeta({
      path: "/share",
      title: "Share to bynku · bynku",
      description: "Send a receipt, memo or link straight into bynku and let AI turn it into an expense.",
      noindex: true,
    }),
  // Web Share Target (GET) lands here with title/text/url; also used for any
  // deep-linked prefill. Values are coerced to strings and left otherwise raw.
  validateSearch: (search: Record<string, unknown>): ShareSearch => ({
    title: typeof search.title === "string" ? search.title : undefined,
    text: typeof search.text === "string" ? search.text : undefined,
    url: typeof search.url === "string" ? search.url : undefined,
  }),
  component: SharePage,
});

function SharePage() {
  const t = useT();
  const navigate = useNavigate();
  const { title, text, url } = Route.useSearch();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  // A share sheet passes title/text/url separately; stitch them into one memo.
  const initialText = [title, text, url].filter(Boolean).join(" ").trim();

  return (
    <div className={pageShellClass("4xl")}>
      <header>
        <h1 className="text-3xl font-display">{t("share.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("share.subtitle")}</p>
      </header>
      {householdId && (
        <ShareCapture
          householdId={householdId}
          initialText={initialText}
          onDone={() => navigate({ to: "/expenses" })}
        />
      )}
    </div>
  );
}
