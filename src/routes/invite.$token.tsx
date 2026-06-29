import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/household.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Join household" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [state, setState] = useState<"loading" | "auth" | "ready" | "joining">("loading");

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
      toast.success("Joined household!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to join");
      setState("ready");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Household invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <Loader2 className="animate-spin mx-auto" />}
          {state === "auth" && (
            <>
              <p>Sign in or create an account first, then come back to this link.</p>
              <Button onClick={() => navigate({ to: "/auth" })}>Go to sign-in</Button>
            </>
          )}
          {state === "ready" && (
            <>
              <p>You've been invited to join a household. Accept to share the budget.</p>
              <Button onClick={join}>Accept invitation</Button>
            </>
          )}
          {state === "joining" && <Loader2 className="animate-spin mx-auto" />}
        </CardContent>
      </Card>
    </div>
  );
}
