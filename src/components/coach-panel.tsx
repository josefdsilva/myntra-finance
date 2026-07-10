import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, MessageSquare, Send, Loader2 } from "lucide-react";
import { generateOverview, chatWithCoach } from "@/lib/coach.functions";
import { useLocale } from "@/lib/i18n";
import { toast } from "sonner";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function CoachPanel({ householdId, initialPrompt }: { householdId: string; initialPrompt?: string }) {
  const qc = useQueryClient();
  const genFn = useServerFn(generateOverview);
  const chatFn = useServerFn(chatWithCoach);
  const locale = useLocale();
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const autoSentRef = useRef<string | null>(null);

  const overviewQ = useQuery({
    queryKey: ["coach-overview", householdId, locale],
    queryFn: () => genFn({ data: { householdId, locale } }),
    enabled: false, // on-demand only
    staleTime: 60 * 60 * 1000,
  });

  const refreshMut = useMutation({
    mutationFn: () => genFn({ data: { householdId, refresh: true, locale } }),
    onSuccess: (d) => {
      qc.setQueryData(["coach-overview", householdId, locale], d);
      toast.success("Overview refreshed");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const chatMut = useMutation({
    mutationFn: (payload: { message: string; history: ChatMsg[] }) =>
      chatFn({ data: { householdId, message: payload.message, history: payload.history, locale } }),
    onSuccess: (d) => setHistory((h) => [...h, { role: "assistant", content: d.reply }]),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  const overview = overviewQ.data;
  const loading = overviewQ.isFetching || overviewQ.isLoading;

  async function sendChat() {
    const msg = input.trim();
    if (!msg || chatMut.isPending) return;
    const nextHist: ChatMsg[] = [...history, { role: "user", content: msg }];
    setHistory(nextHist);
    setInput("");
    chatMut.mutate({ message: msg, history: history.slice(-10) });
  }

  useEffect(() => {
    if (!initialPrompt) return;
    if (autoSentRef.current === initialPrompt) return;
    autoSentRef.current = initialPrompt;
    setChatOpen(true);
    setHistory((h) => [...h, { role: "user", content: initialPrompt }]);
    chatMut.mutate({ message: initialPrompt, history: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              AI Financial Coach
            </CardTitle>
            <CardDescription className="mt-1">
              On-demand overview and chat grounded in your current cycle. Cached for 24h to save credits.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!overview && (
              <Button size="sm" onClick={() => overviewQ.refetch()} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generate overview
              </Button>
            )}
            {overview && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshMut.mutate()}
                disabled={refreshMut.isPending}
              >
                {refreshMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setChatOpen((o) => !o)}>
              <MessageSquare className="size-4" />
              {chatOpen ? "Hide chat" : "Chat"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {overview ? (
          <div>
            <div className="prose prose-sm dark:prose-invert max-w-none [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-1 [&_p]:my-1">
              <ReactMarkdown>{overview.content}</ReactMarkdown>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {overview.cached ? "Cached" : "Fresh"} · generated{" "}
              {new Date(overview.generated_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Click <span className="font-medium">Generate overview</span> to get a summary of what's going
            well, watch-outs, and recommendations. Uses one AI call.
          </div>
        )}

        {chatOpen && (
          <div className="border-t pt-3 space-y-3">
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {history.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Ask anything, e.g. "Can we afford a €300 weekend trip this cycle?" or "Which category
                  should we cut first?"
                </div>
              )}
              {history.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground max-w-[85%]"
                        : "rounded-lg px-3 py-2 text-sm bg-muted max-w-[85%] prose prose-sm dark:prose-invert [&_p]:my-1"
                    }
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {chatMut.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> Thinking…
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the coach…"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                className="min-h-0 resize-none"
              />
              <Button onClick={sendChat} disabled={!input.trim() || chatMut.isPending} size="icon">
                <Send className="size-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Chat is ephemeral — resets when you reload the page.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
