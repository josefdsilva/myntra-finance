import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  LayoutDashboard,
  Wallet,
  Home,
  Receipt,
  PiggyBank,
  CalendarClock,
  BarChart3,
  ArrowLeft,
  ArrowRight,
  X,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT, type MessageKey } from "@/lib/i18n";

/** Fired from anywhere (e.g. Settings) to replay the tour on demand. */
export const TOUR_OPEN_EVENT = "tour:open";

type Slide = { icon: LucideIcon; titleKey: MessageKey; bodyKey: MessageKey };

const SLIDES: Slide[] = [
  { icon: Sparkles, titleKey: "tour.s1.title", bodyKey: "tour.s1.body" },
  { icon: LayoutDashboard, titleKey: "tour.s2.title", bodyKey: "tour.s2.body" },
  { icon: Wallet, titleKey: "tour.s3.title", bodyKey: "tour.s3.body" },
  { icon: Home, titleKey: "tour.s4.title", bodyKey: "tour.s4.body" },
  { icon: Receipt, titleKey: "tour.s5.title", bodyKey: "tour.s5.body" },
  { icon: PiggyBank, titleKey: "tour.s6.title", bodyKey: "tour.s6.body" },
  { icon: CalendarClock, titleKey: "tour.s7.title", bodyKey: "tour.s7.body" },
  { icon: BarChart3, titleKey: "tour.s8.title", bodyKey: "tour.s8.body" },
];

/**
 * A short welcome tour, shown as a full-screen slideshow. It auto-opens once per
 * user — for a brand-new owner (over the setup wizard) and for an invited member
 * landing on the dashboard — and can be replayed any time from Settings. The
 * "seen" marker lives on the user's profile, so it follows them across devices.
 */
export function AppTour() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const autoHandled = useRef(false);

  const { data } = useQuery({
    queryKey: ["tour-seen"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      if (!uid) return { uid: null, seenAt: null as string | null };
      const { data: row } = await supabase
        .from("profiles")
        .select("tour_seen_at")
        .eq("user_id", uid)
        .maybeSingle();
      return { uid, seenAt: (row?.tour_seen_at as string | null) ?? null };
    },
    staleTime: Infinity,
  });

  // Auto-open once, when we know this user has never seen it.
  useEffect(() => {
    if (autoHandled.current || !data) return;
    autoHandled.current = true;
    if (data.uid && data.seenAt == null) {
      setIdx(0);
      setOpen(true);
    }
  }, [data]);

  // Replay on demand (Settings button dispatches this).
  useEffect(() => {
    const handler = () => {
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_OPEN_EVENT, handler);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, handler);
  }, []);

  async function finish() {
    setOpen(false);
    if (data?.uid) {
      try {
        await supabase
          .from("profiles")
          .upsert(
            { user_id: data.uid, tour_seen_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        qc.invalidateQueries({ queryKey: ["tour-seen"] });
      } catch {
        /* best-effort — dismissing the tour must never error */
      }
    }
  }

  if (!open) return null;

  const slide = SLIDES[idx];
  const Icon = slide.icon;
  const isLast = idx === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <button
          type="button"
          aria-label={t("tour.skip")}
          onClick={finish}
          className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-8" />
          </div>
          <h2 className="font-display text-2xl">{t(slide.titleKey)}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(slide.bodyKey)}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {idx > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setIdx((i) => i - 1)}>
              <ArrowLeft className="size-4" /> {t("tour.back")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={finish}>
              {t("tour.skip")}
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={finish}>
              {t("tour.done")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
              {t("tour.next")} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
