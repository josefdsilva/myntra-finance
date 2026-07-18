import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Banknote, Receipt, PiggyBank, Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const STORAGE_KEY = "bynku:onboarding:v1";
type Status = "pending" | "done" | "skipped";

function readStatus(): Status {
  if (typeof window === "undefined") return "done";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "done" || raw === "skipped") return raw;
  return "pending";
}

function writeStatus(s: Status) {
  try {
    window.localStorage.setItem(STORAGE_KEY, s);
  } catch {
    // ignore quota / privacy-mode failures — user just sees the tour again
  }
}

type StepId = "income" | "fixed" | "bucket";

const STEPS: { id: StepId; icon: typeof Banknote; to: string }[] = [
  { id: "income", icon: Banknote, to: "/money-in" },
  { id: "fixed", icon: Receipt, to: "/settings" },
  { id: "bucket", icon: PiggyBank, to: "/allocations" },
];

/**
 * Three-step guided tour shown once per browser after a fresh account setup.
 * Renders only on the dashboard, mounts nothing on server, and persists
 * completion in localStorage so it never nags returning users.
 */
export function OnboardingTour({ enabled }: { enabled: boolean }) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [status, setStatus] = useState<Status>("done");
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStatus(readStatus());
  }, []);

  if (!enabled || status !== "pending" || pathname !== "/dashboard") return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function skip() {
    writeStatus("skipped");
    setStatus("skipped");
  }

  function finish() {
    writeStatus("done");
    setStatus("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3.5" />
            {t("tour.header")}
          </div>
          <button
            type="button"
            aria-label={t("tour.skip")}
            onClick={skip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Icon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("tour.step", { current: step + 1, total: STEPS.length })}
            </p>
            <h2 className="text-xl font-display">{t(`tour.${current.id}.title`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`tour.${current.id}.desc`)}</p>
          </div>

          <div className="flex gap-1.5 pt-1">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={skip}>
              {t("tour.skip")}
            </Button>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                {t("tour.back")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button asChild size="sm" variant="outline" onClick={finish}>
              <Link to={current.to}>{t(`tour.${current.id}.cta`)}</Link>
            </Button>
            {isLast ? (
              <Button size="sm" onClick={finish}>
                {t("tour.done")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                {t("tour.next")}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
