import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, X, Inbox, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { AiBadge } from "@/components/ai-badge";
import {
  listCoachMessages,
  unreadCoachCount,
  markCoachRead,
  markAllCoachRead,
  dismissCoachMessage,
  type CoachMessage,
} from "@/lib/coach-messages.functions";

// The persistent home for proactive coach nudges. A bell with an unread badge in
// the app shell that opens a panel of messages.

const DOT: Record<string, string> = {
  info: "bg-primary",
  success: "bg-success",
  warn: "bg-warning",
  critical: "bg-destructive",
};

function timeAgo(iso: string, t: ReturnType<typeof useT>): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return t("coach.time.now");
  if (m < 60) return t("coach.time.min", { m });
  const h = Math.round(m / 60);
  if (h < 24) return t("coach.time.hour", { h });
  const d = Math.round(h / 24);
  return t("coach.time.day", { d });
}

export function CoachInbox({
  householdId,
  align = "right",
}: {
  householdId: string | null;
  /** Which edge the panel anchors to. "right" opens leftward (wide headers);
      "left" opens rightward (use inside the narrow sidebar). */
  align?: "left" | "right";
}) {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const countFn = useServerFn(unreadCoachCount);
  const listFn = useServerFn(listCoachMessages);
  const markFn = useServerFn(markCoachRead);
  const markAllFn = useServerFn(markAllCoachRead);
  const dismissFn = useServerFn(dismissCoachMessage);

  // The bell is decorative: a transient server hiccup must never bubble up as a
  // page-level error, so both queries swallow failures and fall back to empty.
  const { data: unread } = useQuery({
    queryKey: ["coach-unread", householdId],
    queryFn: async () => {
      try {
        return await countFn({ data: { household_id: householdId! } });
      } catch {
        return { count: 0 };
      }
    },
    enabled: !!householdId,
    retry: false,
    refetchInterval: 60_000,
  });
  const { data: messages } = useQuery({
    queryKey: ["coach-messages", householdId],
    queryFn: async () => {
      try {
        return await listFn({ data: { household_id: householdId! } });
      } catch {
        return [];
      }
    },
    enabled: !!householdId && open,
    retry: false,
  });


  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!householdId) return null;
  const count = unread?.count ?? 0;

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["coach-unread", householdId] }),
      qc.invalidateQueries({ queryKey: ["coach-messages", householdId] }),
    ]);
  }

  async function onOpenMessage(m: CoachMessage) {
    if (!m.read_at) {
      await markFn({ data: { id: m.id } });
      refresh();
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={t("coach.inbox.aria")}
        onClick={() => setOpen((s) => !s)}
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            // Mobile: pin to the viewport so it can never run off-screen.
            "fixed inset-x-3 top-[4.5rem] z-50 w-auto overflow-hidden rounded-xl border bg-card shadow-2xl",
            // Desktop: anchor under the bell instead.
            "md:absolute md:inset-x-auto md:top-full md:mt-2 md:w-[min(92vw,22rem)]",
            align === "right" ? "md:right-0" : "md:left-0",
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Inbox className="size-4" /> {t("coach.inbox.title")}
              <AiBadge />
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await markAllFn({ data: { household_id: householdId } });
                  refresh();
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Check className="size-3.5" /> {t("coach.inbox.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {(messages ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-2 size-6 opacity-50" />
                {t("coach.inbox.empty")}
              </div>
            ) : (
              <ul className="divide-y">
                {(messages ?? []).map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "group cursor-pointer px-4 py-3",
                      !m.read_at && "bg-primary/[0.04]",
                    )}
                    onClick={() => onOpenMessage(m)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          DOT[m.severity] ?? "bg-muted-foreground",
                          m.read_at && "opacity-30",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {m.title?.trim() || m.kind.replace(/_/g, " ")}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(m.created_at, t)}
                          </span>
                        </div>
                        {m.body && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {m.body}
                          </p>
                        )}
                        {m.action_url && (
                          <a
                            href={m.action_url}
                            onClick={() => onOpenMessage(m)}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {m.action_label ?? t("coach.inbox.open")} <ArrowRight className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={t("coach.inbox.dismiss")}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await dismissFn({ data: { id: m.id } });
                          refresh();
                        }}
                        className="-mt-1 -mr-1 shrink-0 rounded p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
