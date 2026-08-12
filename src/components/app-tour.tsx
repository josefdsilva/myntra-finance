import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  LayoutDashboard,
  ArrowLeftRight,
  Gem,
  Receipt,
  PiggyBank,
  Landmark,
  BarChart3,
  ScanLine,
  Settings,
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

type TourRoute =
  | "/dashboard"
  | "/cashflow"
  | "/assets"
  | "/expenses"
  | "/allocations"
  | "/loans"
  | "/analysis"
  | "/share"
  | "/settings";

type Slide = { icon: LucideIcon; titleKey: MessageKey; bodyKey: MessageKey; to?: TourRoute };

const SLIDES: Slide[] = [
  { icon: Sparkles, titleKey: "tour.s1.title", bodyKey: "tour.s1.body" },
  { icon: LayoutDashboard, titleKey: "tour.s2.title", bodyKey: "tour.s2.body", to: "/dashboard" },
  { icon: ArrowLeftRight, titleKey: "tour.s3.title", bodyKey: "tour.s3.body", to: "/cashflow" },
  { icon: Gem, titleKey: "tour.s4.title", bodyKey: "tour.s4.body", to: "/assets" },
  { icon: Receipt, titleKey: "tour.s5.title", bodyKey: "tour.s5.body", to: "/expenses" },
  { icon: PiggyBank, titleKey: "tour.s6.title", bodyKey: "tour.s6.body", to: "/allocations" },
  { icon: Landmark, titleKey: "tour.s7.title", bodyKey: "tour.s7.body", to: "/loans" },
  { icon: BarChart3, titleKey: "tour.s8.title", bodyKey: "tour.s8.body", to: "/analysis" },
  { icon: ScanLine, titleKey: "tour.s9.title", bodyKey: "tour.s9.body", to: "/share" },
  { icon: Settings, titleKey: "tour.s10.title", bodyKey: "tour.s10.body", to: "/settings" },
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  // Guided = replayed from Settings → walk the real screens. Auto-open (first
  // run, possibly over the setup wizard) stays put so it can't yank a new user
  // off onboarding.
  const [guided, setGuided] = useState(false);
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
      setGuided(false);
      setIdx(0);
      setOpen(true);
    }
  }, [data]);

  // Replay on demand (Settings button dispatches this) → guided walk-through.
  useEffect(() => {
    const handler = () => {
      setGuided(true);
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_OPEN_EVENT, handler);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, handler);
  }, []);

  // In guided mode, open the actual screen behind the card as the user steps.
  useEffect(() => {
    if (!open || !guided) return;
    const to = SLIDES[idx]?.to;
    if (to) navigate({ to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, open, guided]);

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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/20 p-4 sm:p-6">
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
