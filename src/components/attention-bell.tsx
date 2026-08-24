import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useHouseholdIssues } from "@/components/dashboard-tips";
import {
  listCoachMessages,
  unreadCoachCount,
  markCoachRead,
  dismissCoachMessage,
  type CoachMessage,
} from "@/lib/coach-messages.functions";

// One "needs attention" surface. Merges the two streams the app used to show in
// two separate bells: computed issues & tips (client-side, from useHouseholdIssues)
// and proactive coach nudges (server rows, coach_messages). They're normalised to
// a single item shape and interleaved by severity. The chat (CoachDock) stays a
// separate surface — a tip's "Chat" button still opens it via the coach:open event.

type Severity = "critical" | "warning" | "info" | "success";
const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

type Item = {
  key: string;
  source: "tip" | "coach";
  severity: Severity;
  title: string;
  body?: string;
  action?: { label: string; to: string };
  chatPrompt?: string;
  unread?: boolean;
  onOpen?: () => void;
  onDismiss: () => void;
};

function openChat(prompt: string) {
  window.dispatchEvent(new CustomEvent("coach:open", { detail: { prompt } }));
}

const SEV_ICON: Record<Severity, typeof Info> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};
const SEV_TONE: Record<Severity, string> = {
  critical: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
};

export function AttentionBell({
  householdId,
  align = "right",
  variant = "bell",
}: {
  householdId: string | null;
  /** Which edge the panel anchors to. "left" opens rightward (narrow sidebar). */
  align?: "left" | "right";
  /** "bell" = icon + badge; "nav" = a full-width row that only shows when N>0. */
  variant?: "bell" | "nav";
}) {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const issues = useHouseholdIssues(householdId ?? "");
  const countFn = useServerFn(unreadCoachCount);
  const listFn = useServerFn(listCoachMessages);
  const markFn = useServerFn(markCoachRead);
  const dismissFn = useServerFn(dismissCoachMessage);

  // Unread coach count drives the badge even while the panel is closed.
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
  // The full coach list is only fetched when the panel opens.
  const { data: coachMsgs } = useQuery({
    queryKey: ["coach-messages", householdId],
    queryFn: async () => {
      try {
        return await listFn({ data: { household_id: householdId! } });
      } catch {
        return [] as CoachMessage[];
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

  const refreshCoach = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["coach-unread", householdId] }),
      qc.invalidateQueries({ queryKey: ["coach-messages", householdId] }),
    ]);

  const tipItems: Item[] = [...issues.criticals, ...issues.primary, ...issues.overflow].map((tp) => ({
    key: `tip:${tp.id}`,
    source: "tip",
    severity: tp.severity,
    title: tp.title,
    body: tp.detail,
    action: tp.cta ? { label: tp.cta.label, to: tp.cta.to } : undefined,
    chatPrompt: tp.chatPrompt,
    onDismiss: () => issues.dismiss(tp.id),
  }));

  const coachItems: Item[] = (coachMsgs ?? []).map((m) => ({
    key: `coach:${m.id}`,
    source: "coach",
    severity: (m.severity === "warn" ? "warning" : m.severity) as Severity,
    title: m.title?.trim() || m.kind.replace(/_/g, " "),
    body: m.body || undefined,
    action: m.action_url
      ? { label: m.action_label ?? t("coach.inbox.open"), to: m.action_url }
      : undefined,
    unread: !m.read_at,
    onOpen: () => {
      if (!m.read_at) void markFn({ data: { id: m.id } }).then(refreshCoach);
    },
    onDismiss: () => void dismissFn({ data: { id: m.id } }).then(refreshCoach),
  }));

  const items = [...tipItems, ...coachItems].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const urgentCount = items.filter((i) => i.severity === "critical").length;
  // Badge combines active tips (always computed) with unread coach nudges.
  const badge = issues.totalActive + (unread?.count ?? 0);

  // The nav-row variant only appears when there's something to flag.
  if (variant === "nav" && badge === 0) return null;

  const panel = open && (
    <div
      className={cn(
        "fixed inset-x-3 top-[4.5rem] z-50 w-auto overflow-hidden rounded-xl border bg-card shadow-2xl",
        "md:absolute md:inset-x-auto md:top-full md:mt-2 md:w-[min(92vw,24rem)]",
        align === "right" ? "md:right-0" : "md:left-0",
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
        <AlertOctagon className={cn("size-4", urgentCount > 0 ? "text-destructive" : "text-amber-500")} />
        {t("tips.attention.title")}
        {urgentCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {t("tips.attention.urgent", { count: urgentCount })}
          </span>
        )}
      </div>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-600 opacity-70" />
            {t("tips.bell.empty")}
          </div>
        ) : (
          items.map((it) => {
            const Icon = SEV_ICON[it.severity];
            return (
              <div
                key={it.key}
                onClick={it.onOpen}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  it.severity === "critical" && "border-destructive/50 bg-destructive/10",
                  it.severity === "warning" && "border-amber-500/40 bg-amber-500/5",
                  it.severity === "info" && "border-sky-500/30 bg-sky-500/5",
                  it.severity === "success" && "border-emerald-500/30 bg-emerald-500/5",
                  it.unread && "ring-1 ring-primary/30",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", SEV_TONE[it.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", it.severity === "critical" && "text-destructive")}>
                      {it.title}
                    </p>
                    {it.body && <p className="mt-0.5 text-xs text-muted-foreground">{it.body}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.action && (
                        <a
                          href={it.action.to}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted"
                        >
                          {it.action.label}
                        </a>
                      )}
                      {it.chatPrompt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat(it.chatPrompt!);
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          <MessageSquare className="size-3" /> {t("tips.chatButton")}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t("tips.dismissButton")}
                    onClick={(e) => {
                      e.stopPropagation();
                      it.onDismiss();
                    }}
                    className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (variant === "nav") {
    return (
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            urgentCount > 0
              ? "border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
              : "border border-amber-500/40 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
          )}
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1 truncate">{t("tips.attention.title")}</span>
          <span
            className={cn(
              "flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 text-white",
              urgentCount > 0 ? "bg-destructive" : "bg-amber-500",
            )}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        </button>
        {panel}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={t("tips.bell.aria")}
        onClick={() => setOpen((s) => !s)}
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <AlertTriangle className="size-5" />
        {badge > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4 text-white",
              urgentCount > 0 ? "bg-destructive" : "bg-amber-500",
            )}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
