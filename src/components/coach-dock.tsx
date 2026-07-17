import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
  Info,
  ChevronDown,
} from "lucide-react";
import {
  chatInConversation,
  createCoachConversation,
  deleteCoachConversation,
  getCoachConversation,
  listCoachConversations,
  COACH_REPLAY_TURNS,
} from "@/lib/coach.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { useLocale } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Msg = { role: "user" | "assistant"; content: string; id?: string };

const STORAGE_KEY_PREFIX = "coach-dock:conv:";

/**
 * Global side-dock coach chat. Persists last 5 conversations per household
 * (DB-trimmed) and replays only the last N turns to bound token cost.
 * Open programmatically from anywhere via:
 *   window.dispatchEvent(new CustomEvent("coach:open", { detail: { prompt } }))
 */
export function CoachDock() {
  const householdId = useActiveHouseholdId();
  const locale = useLocale();
  const qc = useQueryClient();

  const listFn = useServerFn(listCoachConversations);
  const getFn = useServerFn(getCoachConversation);
  const createFn = useServerFn(createCoachConversation);
  const deleteFn = useServerFn(deleteCoachConversation);
  const chatFn = useServerFn(chatInConversation);

  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [pending, setPending] = useState<Msg[]>([]); // optimistic user + streaming placeholder
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoSentRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore last-used conversation for this household.
  useEffect(() => {
    if (!householdId) return;
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + householdId);
    setConvId(stored);
    setPending([]);
  }, [householdId]);
  useEffect(() => {
    if (!householdId) return;
    if (convId) localStorage.setItem(STORAGE_KEY_PREFIX + householdId, convId);
    else localStorage.removeItem(STORAGE_KEY_PREFIX + householdId);
  }, [householdId, convId]);

  const listQ = useQuery({
    queryKey: ["coach-convs", householdId],
    queryFn: () => listFn({ data: { householdId: householdId! } }),
    enabled: !!householdId && open,
  });

  const convQ = useQuery({
    queryKey: ["coach-conv", convId],
    queryFn: () => getFn({ data: { conversationId: convId! } }),
    enabled: !!convId && open,
  });

  // Global open event.
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      if (detail?.prompt && autoSentRef.current !== detail.prompt) {
        autoSentRef.current = detail.prompt;
        // Start a fresh conversation so the tip's prompt gets its own thread.
        setConvId(null);
        setPending([{ role: "user", content: detail.prompt }]);
        void submit(detail.prompt, null);
      }
    }
    window.addEventListener("coach:open", handler as EventListener);
    return () => window.removeEventListener("coach:open", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const messages: Msg[] = useMemo(() => {
    const saved = (convQ.data?.messages ?? []) as Msg[];
    return [...saved, ...pending];
  }, [convQ.data, pending]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, convId]);

  const chatMut = useMutation({
    mutationFn: (payload: { message: string; conversationId: string | null }) =>
      chatFn({
        data: {
          householdId: householdId!,
          conversationId: payload.conversationId,
          message: payload.message,
          locale,
        },
      }),
    onSuccess: async (res) => {
      setPending([]);
      setConvId(res.conversationId);
      await qc.invalidateQueries({ queryKey: ["coach-convs", householdId] });
      await qc.invalidateQueries({ queryKey: ["coach-conv", res.conversationId] });
    },
    onError: (e: unknown) => {
      setPending((p) => p.filter((m) => m.role === "user"));
      toast.error(e instanceof Error ? e.message : "Chat failed");
    },
  });

  async function submit(message: string, currentConvId: string | null) {
    if (!householdId) return;
    setPending((p) => {
      // If not already added, add the user message optimistically.
      const hasUser =
        p.length > 0 && p[p.length - 1].role === "user" && p[p.length - 1].content === message;
      const base = hasUser ? p : [...p, { role: "user" as const, content: message }];
      return [...base, { role: "assistant" as const, content: "…" }];
    });
    chatMut.mutate({ message, conversationId: currentConvId });
  }

  async function send() {
    const msg = input.trim();
    if (!msg || chatMut.isPending) return;
    setInput("");
    await submit(msg, convId);
  }

  async function newChat() {
    setConvId(null);
    setPending([]);
    autoSentRef.current = null;
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function deleteCurrent() {
    if (!convId) return;
    const id = convId;
    setConvId(null);
    setPending([]);
    await deleteFn({ data: { conversationId: id } });
    await qc.invalidateQueries({ queryKey: ["coach-convs", householdId] });
  }

  if (!householdId) return null;

  const currentTitle =
    listQ.data?.find((c) => c.id === convId)?.title ??
    convQ.data?.conversation.title ??
    (convId ? "Chat" : "New chat");

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI coach"
        className={cn(
          "fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6 print:hidden",
          "rounded-full h-14 w-14 shadow-lg border border-primary/30",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "flex items-center justify-center transition-all",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <Sparkles className="size-6" />
      </button>

      {/* Backdrop on mobile */}
      {open && (
        <button
          type="button"
          aria-label="Close coach"
          className="fixed inset-0 z-40 bg-black/30 md:hidden print:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side dock */}
      <aside
        className={cn(
          "fixed z-50 top-0 right-0 h-dvh w-full sm:w-[440px] bg-card border-l shadow-2xl print:hidden",
          "flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Sparkles className="size-4 text-primary shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 flex items-center gap-1 text-left hover:bg-muted/60 rounded px-2 py-1 -mx-1"
              >
                <span className="font-medium text-sm truncate">{currentTitle}</span>
                <ChevronDown className="size-4 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Recent chats (last 5)</DropdownMenuLabel>
              {(listQ.data ?? []).length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved chats yet</div>
              )}
              {(listQ.data ?? []).map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => {
                    setConvId(c.id);
                    setPending([]);
                  }}
                  className={cn(c.id === convId && "bg-muted")}
                >
                  <MessageSquare className="size-3.5 opacity-60" />
                  <span className="truncate">{c.title || "Untitled chat"}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={newChat}>
                <Plus className="size-3.5" /> New chat
              </DropdownMenuItem>
              {convId && (
                <DropdownMenuItem onSelect={deleteCurrent} className="text-destructive">
                  <Trash2 className="size-3.5" /> Delete current chat
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={newChat} aria-label="New chat">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* Memory notice */}
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-2.5 py-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>
            To save credits, the coach only remembers the last{" "}
            <strong>{COACH_REPLAY_TURNS} turns</strong> of this chat. Older messages stay visible
            but won't be part of its memory. Your latest {5} chats are saved per household.
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {convQ.isFetching && messages.length === 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Loading…
            </div>
          )}
          {messages.length === 0 && !convQ.isFetching && (
            <div className="text-sm text-muted-foreground">
              Ask about budgets, big purchases, savings goals, or debt. This chat stays saved so you
              can come back to it later.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={m.id ?? `${m.role}-${i}`}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground max-w-[85%] whitespace-pre-wrap"
                    : "rounded-lg px-3 py-2 text-sm bg-muted max-w-[85%] prose prose-sm dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm"
                }
              >
                {m.role === "assistant" ? (
                  m.content === "…" && chatMut.isPending ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Thinking…
                    </span>
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the coach…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="min-h-0 resize-none"
              disabled={chatMut.isPending}
            />
            <Button
              onClick={send}
              disabled={!input.trim() || chatMut.isPending}
              size="icon"
              aria-label="Send"
            >
              {chatMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
