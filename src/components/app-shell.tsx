import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Receipt, PiggyBank, Settings, LogOut, Wallet, Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/allocations", label: "Allocations", icon: PiggyBank },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Top bar mobile */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="size-4" />
          </div>
          <span className="font-display text-lg">Budget</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((s) => !s)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "md:w-60 md:border-r md:bg-card md:flex md:flex-col",
          open ? "block border-b bg-card" : "hidden md:flex",
        )}
      >
        <div className="hidden md:flex items-center gap-2 p-5 border-b">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">Household</div>
            <div className="text-xs text-muted-foreground">Budget & planning</div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 p-3 flex-1 overflow-x-auto">
          {NAV.map((item) => {
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t hidden md:block">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
