import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Settings,
  LogOut,
  Menu,
  X,
  Eye,
  EyeOff,
  BarChart3,
  Landmark,
  Gem,
  Sun,
  Moon,
  BookOpen,
  Users,
  Check,
  ChevronsUpDown,
  Plus,
  Sparkles,
  User,
  ArrowLeftRight,
  FastForward,
  ScanLine,
  Compass,
  ChevronDown,
} from "lucide-react";
import appIcon from "@/assets/app-icon.svg.asset.json";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold, listMyHouseholds } from "@/lib/household.functions";
import { runDailyCoach } from "@/lib/coach-run.functions";
import { setCurrentCurrency } from "@/lib/format";
import { BetaGate } from "@/components/beta-gate";
import { CoachDock } from "@/components/coach-dock";
import { CoachInbox } from "@/components/coach-inbox";
import { IssuesBell } from "@/components/dashboard-tips";
import { InstallApp } from "@/components/install-app";
import { AppTour } from "@/components/app-tour";

import { useActiveHouseholdId, setActiveHouseholdId } from "@/lib/active-household";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Minimal by default. The core is what a household does week to week; everything
// analytical/advanced is tucked behind a collapsible "Advanced" group so a less
// technical user isn't overwhelmed (progressive disclosure, not a second mode).
const NAV_SECTIONS = [
  {
    titleKey: null,
    advanced: false,
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/journey", labelKey: "nav.journey", icon: Compass },
      { to: "/cashflow", labelKey: "nav.cashflow", icon: ArrowLeftRight },
      { to: "/expenses", labelKey: "nav.expenses", icon: Receipt },
    ],
  },
  {
    titleKey: "navSection.advanced",
    advanced: true,
    items: [
      { to: "/loans", labelKey: "nav.loans", icon: Landmark },
      { to: "/assets", labelKey: "nav.assets", icon: Gem },
      { to: "/allocations", labelKey: "nav.allocations", icon: PiggyBank },
      { to: "/analysis", labelKey: "nav.analysis", icon: BarChart3 },
      { to: "/fast-forward", labelKey: "nav.fastForward", icon: FastForward },
      { to: "/snapshot", labelKey: "nav.snapshot", icon: Sparkles },
      { to: "/wiki", labelKey: "nav.wiki", icon: BookOpen },
    ],
  },
  {
    titleKey: "navSection.account",
    advanced: false,
    items: [
      { to: "/households", labelKey: "nav.households", icon: Users },
      { to: "/share", labelKey: "nav.capture", icon: ScanLine },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const [open, setOpen] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  // Advanced nav group is collapsed by default; the choice is remembered.
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nav-advanced") === "1";
  });
  const toggleAdvanced = () =>
    setShowAdvanced((s) => {
      const next = !s;
      try {
        localStorage.setItem("nav-advanced", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  // Initialise from the saved choice (falling back to the OS setting) so the
  // very first render already has the right theme. Starting at "light" and
  // correcting in an effect caused a flash back to light when the shell
  // remounted, e.g. after visiting a public route like /privacy and returning.
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const activeId = useActiveHouseholdId();
  const fetchHousehold = useServerFn(getOrCreateHousehold);
  const fetchList = useServerFn(listMyHouseholds);
  const runCoach = useServerFn(runDailyCoach);
  const { data: hh } = useQuery({
    queryKey: ["household", activeId],
    queryFn: () => fetchHousehold({ data: activeId ? { household_id: activeId } : {} }),
  });
  const { data: households } = useQuery({
    queryKey: ["my-households"],
    queryFn: () => fetchList(),
  });
  const householdName = hh?.household?.name?.trim() || "Household";
  const resolvedId = hh?.household?.id ?? null;

  // Drive money() formatting from the active household's currency. Set during
  // render so child screens format amounts in the right currency immediately.
  setCurrentCurrency(hh?.household?.currency);

  // If the stored active id no longer points at a household we belong to,
  // sync it to whatever the server picked so future queries stay consistent.
  useEffect(() => {
    if (resolvedId && activeId && resolvedId !== activeId) {
      setActiveHouseholdId(resolvedId);
    } else if (resolvedId && !activeId) {
      setActiveHouseholdId(resolvedId);
    }
  }, [resolvedId, activeId]);

  // Send freshly-created households (never onboarded) to the setup wizard.
  const needsOnboarding = !!resolvedId && hh?.household?.onboarded_at == null;
  useEffect(() => {
    if (needsOnboarding && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [needsOnboarding, pathname, navigate]);

  function switchHousehold(id: string) {
    if (id === resolvedId) return;
    setActiveHouseholdId(id);
    // Everything downstream is keyed by household id — nuke the cache so
    // no stale rows from the previous household leak into the new one.
    queryClient.clear();
  }

  useEffect(() => setOpen(false), [pathname]);

  // Daily coach pass, timed to 8am in the user's own timezone. Runs on app open
  // (no external cron); the server only acts once per local day per space.
  useEffect(() => {
    if (!resolvedId) return;
    const now = new Date();
    const localHour = now.getHours();
    if (localHour < 8) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const key = `coach-ran:${resolvedId}:${localDate}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — fall through; the server still dedupes per day */
    }
    runCoach({
      data: { household_id: resolvedId, local_date: localDate, local_hour: localHour },
    })
      .then((r) => {
        if (r?.ran) queryClient.invalidateQueries({ queryKey: ["coach-unread", resolvedId] });
      })
      .catch(() => {});
  }, [resolvedId, runCoach, queryClient]);

  useEffect(() => {
    const stored = localStorage.getItem("privacy-mode") === "1";
    setPrivacy(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("privacy-on", privacy);
    localStorage.setItem("privacy-mode", privacy ? "1" : "0");
    if (!privacy) return;

    const CURRENCY = /[€$£¥]/;
    function mark(root: Node) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = n.nodeValue ?? "";
        if (!CURRENCY.test(text)) continue;
        const parent = (n as Text).parentElement;
        if (parent && !parent.classList.contains("sensitive")) {
          parent.classList.add("sensitive");
        }
      }
    }
    mark(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1 || node.nodeType === 11) mark(node);
          else if (
            node.nodeType === 3 &&
            node.parentElement &&
            CURRENCY.test(node.nodeValue ?? "")
          ) {
            node.parentElement.classList.add("sensitive");
          }
        });
        if (m.type === "characterData") {
          const target = m.target as Text;
          if (target.parentElement && CURRENCY.test(target.nodeValue ?? "")) {
            target.parentElement.classList.add("sensitive");
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [privacy]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Signed in but not yet allowed into the beta (no code redeemed, no invite):
  // show the access-code gate instead of the app.
  if (hh?.needsBetaCode) {
    return <BetaGate onSignOut={signOut} />;
  }

  const hasMultiple = (households?.length ?? 0) > 1;

  const HouseholdSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-left group rounded-md px-1 -mx-1 hover:bg-muted/60 transition-colors"
          aria-label="Switch household"
        >
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight truncate max-w-[150px]">
              {householdName}
            </div>
            <div className="mt-1 flex items-center">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide leading-none",
                  "bg-muted text-muted-foreground",
                )}
              >
                <User className="size-3" />
                {t("shell.personal")}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground opacity-70 group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("shell.yourSpaces")}</DropdownMenuLabel>
        {(households ?? []).map((h) => (
          <DropdownMenuItem
            key={h.household.id}
            onSelect={() => switchHousehold(h.household.id)}
            className="flex items-center gap-2"
          >
            <Check
              className={cn("size-4", h.household.id === resolvedId ? "opacity-100" : "opacity-0")}
            />
            <span className="flex-1 truncate">{h.household.name || "Untitled"}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {h.role}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/households" className="flex items-center gap-2">
            <Users className="size-4" /> {t("shell.manageSpaces")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/households" className="flex items-center gap-2">
            <Plus className="size-4" /> {t("shell.newSpace")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {hh?.household?.is_synthetic && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-3 py-1 text-center text-xs font-medium text-amber-950 print:hidden">
          Synthetic test persona — this space contains generated data, not real finances.
        </div>
      )}
      {/* Top bar mobile */}
      <header className="pwa-safe-top md:hidden flex items-center justify-between p-4 border-b bg-card print:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src={appIcon.url} alt="bynku household budget logo" className="size-8 rounded-lg" />
          <span className="font-display text-lg">Budget</span>
        </Link>
        <div className="flex items-center gap-1">
          <IssuesBell householdId={resolvedId} />
          <CoachInbox householdId={resolvedId} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPrivacy((s) => !s)}
            aria-label={privacy ? "Show numbers" : "Hide numbers"}
            title={privacy ? "Show numbers" : "Hide numbers"}
          >
            {privacy ? <EyeOff /> : <Eye />}
          </Button>
          <Button
            aria-label={t("common.openMenu")}
            variant="ghost"
            size="icon"
            onClick={() => setOpen((s) => !s)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      {/* Mobile household switcher row (visible under the top bar) */}
      {open || hasMultiple ? (
        <div className="md:hidden px-4 py-2 border-b bg-card print:hidden">{HouseholdSwitcher}</div>
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "md:w-60 md:border-r md:bg-card md:flex md:flex-col print:hidden",
          open ? "block border-b bg-card" : "hidden md:flex",
        )}
      >
        <div className="hidden md:flex items-center gap-2 p-5 border-b">
          <img src={appIcon.url} alt="bynku household budget logo" className="size-9 rounded-xl" />
          {HouseholdSwitcher}
          <div className="ml-auto">
            <CoachInbox householdId={resolvedId} align="left" />
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {/* Contextual entry to the household's issues & tips — only appears when
              something needs attention. Opens the same panel the dashboard card shows. */}
          <div className="mb-1">
            <IssuesBell householdId={resolvedId} align="left" variant="nav" />
          </div>
          {NAV_SECTIONS.map((section, si) => (
            <Fragment key={section.titleKey ?? si}>
              {section.advanced ? (
                <button
                  type="button"
                  onClick={toggleAdvanced}
                  aria-expanded={showAdvanced}
                  className="mt-2 flex w-full items-center justify-between px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground"
                >
                  {t(section.titleKey)}
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", showAdvanced && "rotate-180")}
                  />
                </button>
              ) : (
                section.titleKey && (
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 first:pt-1">
                    {t(section.titleKey)}
                  </p>
                )
              )}
              {(!section.advanced || showAdvanced) &&
                section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
            </Fragment>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1">
          <InstallApp />
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? t("shell.lightTheme") : t("shell.darkTheme")}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setPrivacy((s) => !s)}
          >
            {privacy ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {privacy ? t("shell.showNumbers") : t("shell.hideNumbers")}
          </Button>
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> {t("shell.signOut")}
          </Button>
        </div>
      </aside>

      <main className="pwa-safe-bottom flex-1 min-w-0 relative">{children}</main>
      <CoachDock />
      <AppTour />
    </div>
  );
}
