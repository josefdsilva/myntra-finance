import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { redeemBetaCode } from "@/lib/household.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Shown to a signed-in user who has neither redeemed the beta code nor been
 * invited to a household. Redeeming the code lets them create their own.
 */
export function BetaGate({ onSignOut }: { onSignOut: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const redeem = useServerFn(redeemBetaCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await redeem({ data: { code: code.trim() } });
      if (!res.ok) {
        toast.error(t("beta.invalid"));
        return;
      }
      toast.success(t("beta.welcome"));
      await qc.invalidateQueries({ queryKey: ["household"] });
      await qc.invalidateQueries({ queryKey: ["my-households"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("beta.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-6 text-primary" />
          </div>
          <CardTitle>{t("beta.title")}</CardTitle>
          <CardDescription>{t("beta.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="beta-code">{t("beta.codeLabel")}</Label>
              <Input
                id="beta-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("beta.placeholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("beta.submit")}
            </Button>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              {t("beta.signOut")}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("beta.inviteNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
