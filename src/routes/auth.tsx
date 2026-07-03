import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  PiggyBank,
  Sparkles,
  Bell,
  LineChart,
  ShieldCheck,
  Mic,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import appIcon from "@/assets/app-icon.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Myntra" },
      { name: "description", content: "Sign in to your shared household budget" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Left: promo */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden bg-gradient-to-br from-primary via-primary to-[oklch(0.28_0.06_195)] text-primary-foreground">
        <div className="absolute -top-32 -right-32 size-[500px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-[oklch(0.78_0.11_155)]/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src={appIcon.url} alt="Myntra" className="size-11 rounded-xl shadow-lg" />
            <span className="font-display text-2xl tracking-tight">Myntra</span>
          </div>
        </div>

        <div className="relative z-10 space-y-10 max-w-xl">
          <div className="space-y-5">
            <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] tracking-tight">
              Plan together.
              <br />
              <span className="text-accent">Spend with confidence.</span>
            </h1>
            <p className="text-base xl:text-lg text-primary-foreground/80 leading-relaxed">
              A calm, shared household finance workspace. Know exactly how much
              you can spend today — and how every euro moves you closer to your goals.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureTile
              icon={<Wallet className="size-5" />}
              title="Daily safe-to-spend"
              body="Auto-calculated from your pay cycle."
            />
            <FeatureTile
              icon={<PiggyBank className="size-5" />}
              title="Smart buckets"
              body="ETFs, savings, kids, life goals."
            />
            <FeatureTile
              icon={<Sparkles className="size-5" />}
              title="AI capture"
              body="Voice, text, photo of a receipt."
            />
            <FeatureTile
              icon={<LineChart className="size-5" />}
              title="Cycle analytics"
              body="Burndown, categories, coach report."
            />
            <FeatureTile
              icon={<Bell className="size-5" />}
              title="Push alerts"
              body="Weekly digest, baseline & emergency."
            />
            <FeatureTile
              icon={<ShieldCheck className="size-5" />}
              title="Household-only"
              body="Invite your partner. Nobody else."
            />
          </div>

          {/* Mock preview card */}
          <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] backdrop-blur-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-primary-foreground/60">
              <span>Safe to spend today</span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                Live
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl">€42.80</span>
              <span className="text-sm text-primary-foreground/60">/ day · 11 days left</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-primary-foreground/10 overflow-hidden">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-accent to-[oklch(0.85_0.14_150)]" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <MiniTag label="Spent" value="€648" tone="orange" />
              <MiniTag label="Received" value="€312" tone="blue" />
              <MiniTag label="Balance" value="€336" tone="muted" />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-xs text-primary-foreground/60">
          <span className="flex items-center gap-1.5"><Mic className="size-3.5" /> Voice memos</span>
          <span className="flex items-center gap-1.5"><Receipt className="size-3.5" /> Bank imports</span>
          <span className="flex items-center gap-1.5"><Sparkles className="size-3.5" /> AI coach</span>
        </div>
      </div>

      {/* Right: sign in */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <img src={appIcon.url} alt="Myntra" className="size-14 rounded-2xl mb-3 shadow-lg" />
            <h1 className="font-display text-3xl tracking-tight">Myntra</h1>
            <p className="text-sm text-muted-foreground mt-1.5 text-center">
              Plan together. Spend with confidence.
            </p>
          </div>

          {/* Mobile promo */}
          <div className="lg:hidden mb-6 space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-[oklch(0.28_0.06_195)] text-primary-foreground p-5 shadow-lg">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-primary-foreground/60">
                <span>Safe to spend today</span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  Live
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-4xl">€42.80</span>
                <span className="text-xs text-primary-foreground/60">/ day · 11 days left</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-primary-foreground/10 overflow-hidden">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-accent to-[oklch(0.85_0.14_150)]" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <MiniTag label="Spent" value="€648" tone="orange" />
                <MiniTag label="Received" value="€312" tone="blue" />
                <MiniTag label="Balance" value="€336" tone="muted" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MobileFeature icon={<Wallet className="size-4" />} title="Safe-to-spend" body="Daily budget, auto-calculated." />
              <MobileFeature icon={<PiggyBank className="size-4" />} title="Smart buckets" body="ETFs, savings, goals." />
              <MobileFeature icon={<Sparkles className="size-4" />} title="AI capture" body="Voice, text, receipts." />
              <MobileFeature icon={<LineChart className="size-4" />} title="Analytics" body="Cycle burndown & coach." />
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="font-display text-3xl tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Sign in to your household workspace.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <Button variant="outline" className="w-full mb-4" onClick={google}>
                <svg className="size-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={signIn} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
              </form>
              <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
                Myntra is invite-only. After signing in, open the invite link
                your household admin sent you to join.
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Built for families. Private by design. €·EUR.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/[0.04] p-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-accent">{icon}<span className="text-sm font-medium text-primary-foreground">{title}</span></div>
      <p className="mt-1 text-xs text-primary-foreground/65 leading-snug">{body}</p>
    </div>
  );
}

function MiniTag({ label, value, tone }: { label: string; value: string; tone: "orange" | "blue" | "muted" }) {
  const toneClass = {
    orange: "bg-[oklch(0.75_0.15_60)]/20 text-[oklch(0.92_0.08_70)]",
    blue: "bg-[oklch(0.65_0.13_240)]/20 text-[oklch(0.9_0.06_235)]",
    muted: "bg-primary-foreground/10 text-primary-foreground/80",
  }[tone];
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
