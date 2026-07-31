import { pageMeta } from "@/lib/route-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { useT } from "@/lib/i18n";
import { ShareCapture } from "@/components/share-capture";
import { pageShellClass } from "@/components/page-shell";
import { Loader2 } from "lucide-react";

type ShareSearch = { title?: string; text?: string; url?: string; shared?: string };

export const Route = createFileRoute("/_authenticated/share")({
  head: () =>
    pageMeta({
      path: "/share",
      title: "Share to bynku · bynku",
      description:
        "Send a receipt, memo or link straight into bynku and let AI turn it into an expense.",
      noindex: true,
    }),
  // Web Share Target: text/link shares arrive as GET title/text/url; file shares
  // are POSTed to /share-target by the service worker, which stashes them and
  // redirects here with ?shared=1 for the client to read out of the cache.
  validateSearch: (search: Record<string, unknown>): ShareSearch => ({
    title: typeof search.title === "string" ? search.title : undefined,
    text: typeof search.text === "string" ? search.text : undefined,
    url: typeof search.url === "string" ? search.url : undefined,
    shared: typeof search.shared === "string" ? search.shared : undefined,
  }),
  component: SharePage,
});

const SHARE_CACHE = "bynku-share-target";

// Read files + text the service worker stashed for a file share, then clear the
// cache so a later visit to /share doesn't re-ingest the same payload.
async function readSharedPayload(): Promise<{ files: File[]; text: string }> {
  if (typeof window === "undefined" || !("caches" in window)) return { files: [], text: "" };
  try {
    const cache = await caches.open(SHARE_CACHE);
    const metaRes = await cache.match("/__share/meta");
    if (!metaRes) return { files: [], text: "" };
    const meta = (await metaRes.json()) as { count?: number; text?: string };
    const files: File[] = [];
    for (let i = 0; i < (meta.count ?? 0); i++) {
      const res = await cache.match(`/__share/file-${i}`);
      if (!res) continue;
      const blob = await res.blob();
      const name = decodeURIComponent(res.headers.get("x-filename") || `shared-${i}`);
      const type = res.headers.get("content-type") || blob.type || "application/octet-stream";
      files.push(new File([blob], name, { type }));
    }
    for (const key of await cache.keys()) await cache.delete(key);
    return { files, text: meta.text ?? "" };
  } catch {
    return { files: [], text: "" };
  }
}

function SharePage() {
  const t = useT();
  const navigate = useNavigate();
  const { title, text, url, shared } = Route.useSearch();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const isFileShare = shared === "1";
  const [payload, setPayload] = useState<{ files: File[]; text: string } | null>(null);

  useEffect(() => {
    if (!isFileShare) return;
    let active = true;
    readSharedPayload()
      .then((p) => active && setPayload(p))
      .catch(() => active && setPayload({ files: [], text: "" }));
    return () => {
      active = false;
    };
  }, [isFileShare]);

  // A GET text/link share stitches its parts into one memo.
  const linkText = [title, text, url].filter(Boolean).join(" ").trim();
  // For a file share, wait until the cache read resolves so ShareCapture mounts
  // with its files/text already in hand (its seeding runs once, at mount).
  const waitingForShare = isFileShare && payload === null;

  return (
    <div className={pageShellClass("4xl")}>
      <header>
        <h1 className="text-3xl font-display">{t("share.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("share.subtitle")}</p>
      </header>
      {householdId && !waitingForShare && (
        <ShareCapture
          householdId={householdId}
          initialText={isFileShare ? payload?.text ?? "" : linkText}
          initialFiles={isFileShare ? payload?.files : undefined}
          onDone={() => navigate({ to: "/expenses" })}
        />
      )}
      {(!householdId || waitingForShare) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t("share.preparing")}
        </div>
      )}
    </div>
  );
}
