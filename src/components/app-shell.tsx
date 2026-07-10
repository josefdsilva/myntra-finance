import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  Sun,
  Moon,
  BookOpen,
  ShieldCheck,
  Users,
  Check,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import appIcon from "@/assets/app-icon.svg.asset.json";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold, listMyHouseholds } from "@/lib/household.functions";
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

const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/expenses", labelKey: "nav.expenses", icon: Receipt },
  { to: "/analysis", labelKey: "nav.analysis", icon: BarChart3 },
  { to: "/allocations", labelKey: "nav.allocations", icon: PiggyBank },
  { to: "/households", labelKey: "nav.households", icon: Users },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
  { to: "/wiki", labelKey: "nav.wiki", icon: BookOpen },
  { to: "/privacy", labelKey: "nav.privacy", icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const [open, setOpen] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const activeId = useActiveHouseholdId();
  const fetchHousehold = useServerFn(getOrCreateHousehold);
  const fetchList = useServerFn(listMyHouseholds);
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

  // If the stored active id no longer points at a household we belong to,
  // sync it to whatever the server picked so future queries stay consistent.
  useEffect(() => {
    if (resolvedId && activeId && resolvedId !== activeId) {
      setActiveHouseholdId(resolvedId);
    } else if (resolvedId && !activeId) {
      setActiveHouseholdId(resolvedId);
    }
  }, [resolvedId, activeId]);

  function switchHousehold(id: string) {
    if (id === resolvedId) return;
    setActiveHouseholdId(id);
    // Everything downstream is keyed by household id — nuke the cache so
    // no stale rows from the previous household leak into the new one.
    queryClient.clear();
  }

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("privacy-mode") === "1";
    setPrivacy(stored);
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(storedTheme ?? (prefersDark ? "dark" : "light"));
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
            <div className="font-display text-lg leading-tight truncate max-w-[140px]">
              {householdName}
            </div>
            <div className="text-xs text-muted-foreground">{t("shell.subtitle")}</div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground opacity-70 group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your households</DropdownMenuLabel>
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
            <Users className="size-4" /> Manage households
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/households" className="flex items-center gap-2">
            <Plus className="size-4" /> New household
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Top bar mobile */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <Link to="/" className="flex items-center gap-2">
          <img src={appIcon.url} alt="App icon" className="size-8 rounded-lg" />
          <span className="font-display text-lg">Budget</span>
        </Link>
        <div className="flex items-center gap-1">
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
          <Button variant="ghost" size="icon" onClick={() => setOpen((s) => !s)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      {/* Mobile household switcher row (visible under the top bar) */}
      {open || hasMultiple ? (
        <div className="md:hidden px-4 py-2 border-b bg-card">{HouseholdSwitcher}</div>
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "md:w-60 md:border-r md:bg-card md:flex md:flex-col",
          open ? "block border-b bg-card" : "hidden md:flex",
        )}
      >
        <div className="hidden md:flex items-center gap-2 p-5 border-b">
          <img src={appIcon.url} alt="App icon" className="size-9 rounded-xl" />
          {HouseholdSwitcher}
        </div>
        <nav className="flex md:flex-col gap-1 p-3 flex-1 overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            const label = t(item.labelKey);
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
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t hidden md:block space-y-1">
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

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
