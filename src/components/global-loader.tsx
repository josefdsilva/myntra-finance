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
 */
export function GlobalLoader() {
  const isNavigating = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading || s.isTransitioning,
  });

  const [bootDone, setBootDone] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot splash: show for at least ~350ms after first paint, then fade out.
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Navigation pill with minimum-visible window.
  useEffect(() => {
    if (isNavigating) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setShowPill(true);
    } else if (showPill) {
      hideTimer.current = setTimeout(() => setShowPill(false), 550);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isNavigating, showPill]);

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
