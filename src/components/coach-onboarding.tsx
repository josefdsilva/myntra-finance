import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Send, Sparkles, X, Check } from "lucide-react";
import { updateHousehold } from "@/lib/household.functions";
import {
  upsertIncome,
  upsertFixedExpense,
  upsertVariableEstimate,
  upsertDebt,
  upsertBucket,
} from "@/lib/budget.functions";
import { extractSetupItems } from "@/lib/onboarding-chat.functions";
import { useT, type MessageKey } from "@/lib/i18n";

const COUNTRIES: Array<[string, string]> = [
  ["PT", "Portugal"],
  ["ES", "Spain"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["IE", "Ireland"],
  ["BE", "Belgium"],
  ["AT", "Austria"],
  ["LU", "Luxembourg"],
];

type Row = { label: string; monthly_amount: number };
type Msg = { id: number; role: "coach" | "user"; text: string };
type Topic = "income" | "fixed" | "variable" | "debt" | "projects";
const SCRIPT: Array<"country" | Topic> = [
  "country",
  "income",
  "fixed",
  "variable",
  "debt",
  "projects",
];

/**
 * A "there is none / no / zero / skip" style answer — the user is telling us this
 * topic doesn't apply, not giving data. We accept it as a skip instead of asking
 * them to try again. Multilingual and accent-insensitive; anything containing a
 * real amount (a digit 1-9) is treated as data, never as a "none".
 */
function looksNegative(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!t) return true;
  if (/^[\s0.,€$£-]+$/.test(t)) return true; // just zeros / dashes / currency
  if (/[1-9]/.test(t)) return false; // contains a real amount → treat as data
  return /\b(no|none|nope|nothing|nil|na|skip|zero|nada|nenhum|nenhuma|ninguno|ninguna|cero|nein|kein|keine|keins|nichts|null|non|aucun|aucune|rien)\b/.test(
    t,
  );
}

/**
 * Conversational onboarding — the controlled-hybrid "chat instead" path. The
 * coach walks a fixed script of topics; each free-text answer is extracted into
 * structured rows the user CONFIRMS before anything is written. The form remains
 * one tap away via "use forms instead". Nothing is saved without confirmation.
 */
export function CoachOnboarding({
  householdId,
  isBusiness,
  onSwitchToForms,
  onDone,
}: {
  householdId: string;
  isBusiness: boolean;
  onSwitchToForms: () => void;
  onDone: () => void | Promise<void>;
}) {
  const t = useT();
  const updateHh = useServerFn(updateHousehold);
  const addIncome = useServerFn(upsertIncome);
  const addFixed = useServerFn(upsertFixedExpense);
  const addVariable = useServerFn(upsertVariableEstimate);
  const addDebt = useServerFn(upsertDebt);
  const addBucket = useServerFn(upsertBucket);
  const extract = useServerFn(extractSetupItems);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Row[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const idRef = useRef(0);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const current = SCRIPT[stepIdx];

  function push(role: "coach" | "user", text: string) {
    setMessages((m) => [...m, { id: ++idRef.current, role, text }]);
  }

  function topicQuestion(topic: Topic): string {
    const key: Record<Topic, MessageKey> = {
      income: isBusiness ? "coachOb.incomeQBiz" : "coachOb.incomeQ",
      fixed: isBusiness ? "coachOb.fixedQBiz" : "coachOb.fixedQ",
      variable: isBusiness ? "coachOb.variableQBiz" : "coachOb.variableQ",
      debt: isBusiness ? "coachOb.debtQBiz" : "coachOb.debtQ",
      projects: isBusiness ? "coachOb.projectsQBiz" : "coachOb.projectsQ",
    };
    return t(key[topic]);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    push("coach", t("coachOb.intro"));
    push("coach", t("coachOb.countryQ"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, busy]);

  async function advance(fromIdx: number) {
    const nextIdx = fromIdx + 1;
    if (nextIdx >= SCRIPT.length) {
      setFinishing(true);
      push("coach", t("coachOb.done"));
      await onDone();
      return;
    }
    setStepIdx(nextIdx);
    const next = SCRIPT[nextIdx];
    if (next !== "country") push("coach", topicQuestion(next));
  }

  async function pickCountry(code: string, name: string) {
    if (busy) return;
    setBusy(true);
    try {
      await updateHh({ data: { household_id: householdId, country: code } });
      push("user", name);
      await advance(stepIdx);
    } catch {
      toast.error(t("coachOb.err"));
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    push("user", text);
    setInput("");
    // "No debt", "there is none", "zero" → the topic doesn't apply. Accept it as a
    // skip and move on instead of asking the user to try again.
    if (looksNegative(text)) {
      push("coach", t("coachOb.noneNoted"));
      await advance(stepIdx);
      return;
    }
    setBusy(true);
    try {
      const res = await extract({ data: { topic: current as Topic, text, householdId } });
      if (res.items.length) setPending(res.items);
      else push("coach", t("coachOb.tryAgain"));
    } catch {
      push("coach", t("coachOb.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending?.length || busy) return;
    setBusy(true);
    try {
      const topic = current as Topic;
      for (let i = 0; i < pending.length; i++) {
        const r = pending[i];
        if (r.monthly_amount <= 0) continue;
        if (topic === "income")
          await addIncome({
            data: {
              household_id: householdId,
              label: r.label,
              monthly_amount: r.monthly_amount,
              type: isBusiness ? undefined : i === 0 ? "salary" : "other",
            },
          });
        else if (topic === "fixed")
          await addFixed({
            data: { household_id: householdId, label: r.label, monthly_amount: r.monthly_amount },
          });
        else if (topic === "variable")
          await addVariable({
            data: { household_id: householdId, label: r.label, monthly_amount: r.monthly_amount },
          });
        else if (topic === "debt")
          await addDebt({
            data: {
              household_id: householdId,
              label: r.label,
              kind: isBusiness ? "business_loan" : "other",
              monthly_amount: r.monthly_amount,
              taeg_pct: null,
              principal_remaining: null,
              maturity_date: null,
            },
          });
        else if (topic === "projects")
          await addBucket({
            data: {
              household_id: householdId,
              name: r.label,
              target_type: "fixed_monthly",
              target_value: r.monthly_amount,
              kind: "savings",
            },
          });
      }
      push("coach", t("coachOb.added", { count: pending.length }));
      const idx = stepIdx;
      setPending(null);
      await advance(idx);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("coachOb.err"));
    } finally {
      setBusy(false);
    }
  }

  async function skipTopic() {
    if (busy) return;
    push("coach", t("coachOb.skipped"));
    setPending(null);
    setInput("");
    await advance(stepIdx);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-4 text-primary" /> {t("coachOb.title")}
        </span>
        <Button variant="ghost" size="sm" onClick={onSwitchToForms} disabled={busy || finishing}>
          {t("coachOb.useForms")}
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "max-w-[85%] self-end" : "max-w-[85%] self-start"}>
              <div
                className={
                  m.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm"
                }
              >
                {m.text}
              </div>
            </div>
          ))}

          {busy && !pending && (
            <div className="self-start">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {pending && (
            <div className="self-stretch rounded-xl border bg-card p-3">
              <p className="mb-2 text-xs text-muted-foreground">{t("coachOb.confirmIntro")}</p>
              <div className="space-y-2">
                {pending.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={r.label}
                      onChange={(e) =>
                        setPending((p) =>
                          p ? p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) : p,
                        )
                      }
                    />
                    <Input
                      className="w-28"
                      type="number"
                      step="0.01"
                      value={r.monthly_amount}
                      onChange={(e) =>
                        setPending((p) =>
                          p
                            ? p.map((x, j) =>
                                j === i ? { ...x, monthly_amount: parseFloat(e.target.value) || 0 } : x,
                              )
                            : p,
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("coachOb.remove")}
                      onClick={() =>
                        setPending((p) => {
                          const n = (p ?? []).filter((_, j) => j !== i);
                          return n.length ? n : null;
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={confirmPending} disabled={busy || !pending.length}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}
                  {t("coachOb.confirm")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={busy}>
                  {t("coachOb.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mx-auto max-w-lg">
          {current === "country" && !pending ? (
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map(([code, name]) => (
                <Button
                  key={code}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => pickCountry(code, name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          ) : !pending && !finishing ? (
            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                className="min-h-10 resize-none"
                placeholder={t("coachOb.inputPh")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendAnswer();
                  }
                }}
                disabled={busy}
              />
              <Button
                size="icon"
                aria-label={t("coachOb.send")}
                onClick={sendAnswer}
                disabled={busy || !input.trim()}
              >
                <Send className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={skipTopic} disabled={busy}>
                {t("coachOb.skip")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
