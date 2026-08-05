import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LogoLoader } from "@/components/logo-loader";

/**
 * Two roles:
 *  1) On first mount, show a full-screen splash with the bynku bars until React
 *     has hydrated and the first route is settled.
 *  2) Afterwards, show a small top-center pill whenever a navigation is
 *     pending. We keep it visible for a minimum window so quick transitions
 *     still show the animation instead of flickering by unnoticed.
 *
 * A hard safety cap ensures the pill can never linger: if a navigation appears
 * stuck (e.g. a router flag that does not settle), we hide it after a few
 * seconds and stop reacting until navigation genuinely ends.
 */
export function GlobalLoader() {
  // Use the canonical navigation status only. isTransitioning/isLoading are
  // noisier and can remain set after a load settles, which is what made the
  // pill linger.
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });

  const [bootDone, setBootDone] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot splash: show for at least ~400ms after first paint, then fade out.
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Once navigation genuinely ends, clear any suppression so future
  // navigations show the pill again.
  useEffect(() => {
    if (!isNavigating) setSuppressed(false);
  }, [isNavigating]);

  // Navigation pill with a minimum-visible window.
  useEffect(() => {
    if (isNavigating && !suppressed) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setShowPill(true);
    } else if (showPill && !isNavigating) {
      hideTimer.current = setTimeout(() => setShowPill(false), 550);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isNavigating, showPill, suppressed]);

  // Safety cap: never let the pill linger. If it has been visible for more than
  // 8s, hide it and stop reacting until navigation actually ends.
  useEffect(() => {
    if (!showPill) return;
    const cap = setTimeout(() => {
      setSuppressed(true);
      setShowPill(false);
    }, 8000);
    return () => clearTimeout(cap);
  }, [showPill]);

  return (
    <>
      {!bootDone && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background animate-fade-in print:hidden"
          aria-live="polite"
        >
          <LogoLoader size={56} />
          <span className="text-xs text-muted-foreground tracking-wide">bynku</span>
        </div>
      )}
      {bootDone && showPill && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center pt-3 print:hidden animate-fade-in"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 shadow-sm backdrop-blur">
            <LogoLoader size={22} />
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        </div>
      )}
    </>
  );
}
