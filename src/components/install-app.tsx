import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share as ShareIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

/**
 * Thin PWA install + update affordance — the low-risk installability layer, not
 * the full offline/caching PWA. On Android/desktop it turns the browser's
 * `beforeinstallprompt` into an "Install app" button. On iOS Safari (which gives
 * no prompt) it shows a dismissible "Add to Home Screen" hint. It also registers
 * the service worker on load and, when a new deploy is waiting, shows a
 * "new version — refresh" toast. When the app is already running installed
 * (standalone), it renders nothing.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isBrowser = typeof window !== "undefined";

// Capture the install prompt as early as this module is imported (the app shell
// pulls it into the initial tree), so a prompt that fires before the component
// mounts isn't lost. Re-broadcast via a custom event the component subscribes to.
let deferredPrompt: InstallPromptEvent | null = null;
if (isBrowser) {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    window.dispatchEvent(new CustomEvent("bynku:installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("bynku:installed"));
  });
}

let pwaWired = false;
let reloading = false;

// Register the service worker and wire the update flow. Guarded so it runs once
// even though InstallApp is mounted in more than one place.
async function setupPwa(notifyUpdate: (worker: ServiceWorker) => void) {
  if (pwaWired || !isBrowser || !("serviceWorker" in navigator)) return;
  pwaWired = true;

  // When the freshly-installed worker takes control, reload once so the tab runs
  // the new code. Guarded against reload loops.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  try {
    let reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) reg = await navigator.serviceWorker.register("/sw.js");

    // A worker that finished installing before we wired up is already waiting.
    if (reg.waiting && navigator.serviceWorker.controller) notifyUpdate(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const installing = reg?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          notifyUpdate(installing);
        }
      });
    });
  } catch {
    pwaWired = false; // allow a retry on a later mount
  }
}

const DISMISS_KEY = "bynku.iosHintDismissed";

export function InstallApp({ className }: { className?: string }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [canInstall, setCanInstall] = useState<boolean>(!!deferredPrompt);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage

  useEffect(() => {
    setMounted(true);

    const notifyUpdate = (worker: ServiceWorker) => {
      toast(t("pwa.updateTitle"), {
        id: "pwa-update", // fixed id so repeated events don't stack
        description: t("pwa.updateBody"),
        duration: Infinity,
        action: {
          label: t("pwa.updateAction"),
          onClick: () => worker.postMessage("SKIP_WAITING"),
        },
      });
    };
    setupPwa(notifyUpdate);

    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("bynku:installable", onInstallable);
    window.addEventListener("bynku:installed", onInstalled);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    return () => {
      window.removeEventListener("bynku:installable", onInstallable);
      window.removeEventListener("bynku:installed", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render nothing until mounted so the first client render matches the server
  // (which renders null) — avoids a hydration mismatch.
  if (!mounted || !isBrowser) return null;

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone || installed) return null;

  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as "Macintosh"; disambiguate with touch points.
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios|edg).)*safari/i.test(ua);

  // Android / desktop: a real install button.
  if (canInstall && deferredPrompt) {
    return (
      <Button
        variant="outline"
        className={className ?? "w-full justify-start"}
        onClick={async () => {
          const dp = deferredPrompt;
          if (!dp) return;
          try {
            await dp.prompt();
            await dp.userChoice;
          } catch {
            /* user dismissed the native sheet */
          }
          deferredPrompt = null;
          setCanInstall(false);
        }}
      >
        <Download className="size-4" /> {t("install.button")}
      </Button>
    );
  }

  // iOS Safari: no prompt exists — teach the Add-to-Home-Screen gesture.
  if (isIOS && isSafari && !dismissed) {
    return (
      <div className="relative rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
          className="absolute right-2 top-2 rounded p-0.5 hover:bg-muted"
          aria-label={t("install.dismiss")}
        >
          <X className="size-3.5" />
        </button>
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <ShareIcon className="size-3.5" /> {t("install.iosTitle")}
        </p>
        <p>{t("install.iosBody")}</p>
      </div>
    );
  }

  return null;
}
