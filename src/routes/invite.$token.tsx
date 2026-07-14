import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/household.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Join household" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [state, setState] = useState<"loading" | "auth" | "ready" | "joining">("loading");
  const t = useT();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "ready" : "auth");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => {
      setState(s ? "ready" : "auth");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function join() {
    setState("joining");
    try {
      await accept({ data: { token } });
      toast.success(t("invite.joinedToast"));
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("invite.failedToast"));
      setState("ready");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>{t("invite.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <Loader2 className="animate-spin mx-auto" />}
          {state === "auth" && (
            <>
              <p>{t("invite.signInFirst")}</p>
              <Button onClick={() => navigate({ to: "/auth" })}>{t("invite.goToSignIn")}</Button>
            </>
          )}
          {state === "ready" && (
            <>
              <p>{t("invite.readyBody")}</p>
              <Button onClick={join}>{t("invite.acceptInvitation")}</Button>
            </>
          )}
          {state === "joining" && <Loader2 className="animate-spin mx-auto" />}
        </CardContent>
      </Card>
    </div>
  );
}
