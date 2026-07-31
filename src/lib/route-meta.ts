/**
 * Per-route head metadata helper.
 *
 * Every route gets a unique title/description plus self-referencing og:url and
 * canonical, so social previews are contextual instead of falling back to the
 * root (home) tags. App routes behind auth are marked noindex — they are still
 * shareable links, so their previews should be accurate, but crawlers should
 * not index them.
 */
export const SITE_URL = "https://bynku.app";

type PageMetaInput = {
  /** Path starting with "/" — used for og:url and canonical. */
  path: string;
  title: string;
  description: string;
  /** Defaults to "website"; use "article" for long-form content pages. */
  ogType?: string;
  /** Absolute https URL of a meaningful hero/cover image. */
  image?: string;
  /** Keep the page out of search results (private/app routes). */
  noindex?: boolean;
};

export function pageMeta({
  path,
  title,
  description,
  ogType = "website",
  image,
  noindex = false,
}: PageMetaInput) {
  const url = `${SITE_URL}${path}`;
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { property: "og:url", content: url },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  if (noindex) meta.push({ name: "robots", content: "noindex, nofollow" });

  return { meta, links: [{ rel: "canonical", href: url }] };
}
