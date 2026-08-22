import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

const KEY = "chat-first-card:dismissed";

/**
 * Discovery nudge: many households (especially less tech-confident ones) never
 * find out they can just talk to the coach instead of using the forms. Shown
 * once until dismissed; opening the dock is enough to keep it out of the way.
 */
export function ChatFirstCard() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(localStorage.getItem(KEY) !== "1");
  }, []);

  function close() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <MessagesSquare className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium">{t("chatFirst.card.title")}</p>
            <p className="text-sm text-muted-foreground">{t("chatFirst.card.body")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button variant="ghost" size="sm" onClick={close}>
            {t("chatFirst.card.dismiss")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              close();
              window.dispatchEvent(new CustomEvent("coach:open"));
            }}
          >
            {t("chatFirst.card.cta")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
