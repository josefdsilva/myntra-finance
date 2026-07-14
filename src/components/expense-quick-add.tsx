import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mic, MicOff, Sparkles, Plus, Loader2, Camera, X } from "lucide-react";
import { parseMemo, parseVoiceMemo, parseReceiptPhoto } from "@/lib/ai-parse.functions";
import { addExpense, addExpensesBulk } from "@/lib/budget.functions";

import { money, fmtDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

// Encode a large ArrayBuffer to base64 without blowing the call stack.
// Spreading a multi-MB Uint8Array into String.fromCharCode hangs the tab.
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32KB
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

import { useCategoryNames } from "@/hooks/use-categories";
import { LabelsInput } from "@/components/labels-input";
import { useRecentLabels } from "@/hooks/use-labels";
import { IncomeAllocationSuggestion } from "@/components/income-allocation-suggestion";

const DEFAULT_CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "fuel",
  "utilities",
  "housing",
  "subscriptions",
  "health",
  "kids",
  "shopping",
  "entertainment",
  "travel",
  "gifts",
  "income",
  "other",
];

type Parsed = {
  amount: number;
  category: string;
  merchant?: string | null;
  occurred_at?: string;
  note?: string | null;
};

export function ExpenseQuickAdd({
  householdId,
  onAdded,
}: {
  householdId: string;
  onAdded?: () => void;
}) {
  const t = useT();
  return (
    <Tabs defaultValue="manual">
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="manual">{t("expQuick.tabManual")}</TabsTrigger>
        <TabsTrigger value="ai">
          <Sparkles className="size-3.5 mr-1" /> {t("expQuick.tabAiMemo")}
        </TabsTrigger>
        <TabsTrigger value="voice">
          <Mic className="size-3.5 mr-1" /> {t("expQuick.tabVoice")}
        </TabsTrigger>
        <TabsTrigger value="photo">
          <Camera className="size-3.5 mr-1" /> {t("expQuick.tabPhoto")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="manual">
        <ManualForm householdId={householdId} onAdded={onAdded} />
      </TabsContent>
      <TabsContent value="ai">
        <AiMemoForm householdId={householdId} onAdded={onAdded} />
      </TabsContent>
      <TabsContent value="voice">
        <VoiceForm householdId={householdId} onAdded={onAdded} />
      </TabsContent>
      <TabsContent value="photo">
        <PhotoForm householdId={householdId} onAdded={onAdded} />
      </TabsContent>
    </Tabs>
  );
}

function ManualForm({ householdId, onAdded }: { householdId: string; onAdded?: () => void }) {
  const add = useServerFn(addExpense);
  const { names: hhCats } = useCategoryNames(householdId);
  const { data: recentLabels = [] } = useRecentLabels(householdId);
  const categories = hhCats.length ? hhCats : DEFAULT_CATEGORIES;
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "other");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState(false);
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [occurredAt, setOccurredAt] = useState<string>(nowLocal);
  const [loading, setLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestAmount, setSuggestAmount] = useState(0);
  const t = useT();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount.replace(",", "."));
    if (!isFinite(n) || n <= 0) return toast.error(t("expQuick.invalidAmount"));
    setLoading(true);
    try {
      const occurredIso =
        customDate && occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString();
      await add({
        data: {
          household_id: householdId,
          amount: n,
          category,
          merchant: merchant || null,
          note: note || null,
          source: "manual",
          kind,
          is_salary: false,
          occurred_at: occurredIso,
          labels,
        },
      });
      setAmount("");
      setMerchant("");
      setNote("");
      setLabels([]);
      setCustomDate(false);
      setOccurredAt(nowLocal());
      toast.success(
        kind === "income" ? t("expQuick.moneyReceivedAdded") : t("expQuick.expenseAdded"),
      );
      onAdded?.();
      if (kind === "income") {
        setSuggestAmount(n);
        setSuggestOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => {
              setKind("expense");
              setCategory("groceries");
            }}
            className={`px-3 py-1.5 text-sm rounded ${kind === "expense" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            {t("expQuick.kindExpense")}
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("income");
              setCategory("gifts");
            }}
            className={`px-3 py-1.5 text-sm rounded ${kind === "income" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            {t("expQuick.kindIncome")}
          </button>
        </div>
        {kind === "income" && (
          <p className="text-xs text-muted-foreground">
            {t("expQuick.salaryHint", { label: t("expQuick.salaryReceivedLabel") })}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>{t("expQuick.amountLabel")}</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>{t("expQuick.categoryLabel")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>
              {kind === "income" ? t("expQuick.fromLabel") : t("expQuick.merchantLabel")}
            </Label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={
                kind === "income"
                  ? t("expQuick.fromPlaceholder")
                  : t("expQuick.merchantPlaceholder")
              }
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <Plus /> {t("expQuick.add")}
                </>
              )}
            </Button>
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none mb-2">
              <input
                type="checkbox"
                checked={customDate}
                onChange={(e) => setCustomDate(e.target.checked)}
                className="accent-primary size-4"
              />
              <span>
                {t("expQuick.customDateLabel")}{" "}
                {!customDate && (
                  <span className="text-muted-foreground">{t("expQuick.defaultsToNow")}</span>
                )}
              </span>
            </label>
            {customDate && (
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            )}
          </div>
          <div className="md:col-span-2">
            <Label>{t("expQuick.noteLabel")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Label>{t("expQuick.labelsLabel")}</Label>
            <LabelsInput value={labels} onChange={setLabels} suggestions={recentLabels} />
          </div>
        </div>
      </form>
      <IncomeAllocationSuggestion
        householdId={householdId}
        amount={suggestAmount}
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
      />
    </>
  );
}

function AiMemoForm({ householdId, onAdded }: { householdId: string; onAdded?: () => void }) {
  const parse = useServerFn(parseMemo);
  const bulk = useServerFn(addExpensesBulk);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useT();

  async function doParse() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await parse({ data: { text, householdId } });
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.parsingFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!items?.length) return;
    setLoading(true);
    try {
      await bulk({
        data: {
          items: items.map((i) => ({
            household_id: householdId,
            amount: i.amount,
            category: i.category,
            merchant: i.merchant,
            occurred_at: i.occurred_at,
            note: i.note,
            source: "ai_memo" as const,
          })),
        },
      });
      toast.success(
        items.length === 1
          ? t("expQuick.addedExpenseSingular")
          : t("expQuick.addedExpensesPlural", { count: items.length }),
      );
      setItems(null);
      setText("");
      onAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder={t("expQuick.aiPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      {!items ? (
        <Button onClick={doParse} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
          {t("expQuick.parseWithAi")}
        </Button>
      ) : (
        <ParsedReview
          items={items}
          setItems={setItems}
          onConfirm={confirm}
          onCancel={() => setItems(null)}
          householdId={householdId}
          loading={loading}
        />
      )}
    </div>
  );
}

function VoiceForm({ householdId, onAdded }: { householdId: string; onAdded?: () => void }) {
  const parseVoice = useServerFn(parseVoiceMemo);
  const bulk = useServerFn(addExpensesBulk);
  const [recording, setRecording] = useState(false);
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const t = useT();

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const buf = await blob.arrayBuffer();
        const base64 = bufferToBase64(buf);
        setLoading(true);
        try {
          const res = await parseVoice({
            data: { audio_base64: base64, mime_type: mime, householdId },
          });
          setTranscript(res.transcript);
          setItems(res.items);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("expQuick.voiceParsingFailed"));
        } finally {
          setLoading(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error(t("expQuick.micPermissionNeeded"));
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function confirm() {
    if (!items?.length) return;
    setLoading(true);
    try {
      await bulk({
        data: {
          items: items.map((i) => ({
            household_id: householdId,
            amount: i.amount,
            category: i.category,
            merchant: i.merchant,
            occurred_at: i.occurred_at,
            note: i.note,
            source: "ai_voice" as const,
          })),
        },
      });
      toast.success(
        items.length === 1
          ? t("expQuick.addedExpenseSingular")
          : t("expQuick.addedExpensesPlural", { count: items.length }),
      );
      setItems(null);
      setTranscript("");
      onAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {!recording ? (
          <Button onClick={start} disabled={loading}>
            <Mic /> {t("expQuick.startRecording")}
          </Button>
        ) : (
          <Button onClick={stop} variant="destructive">
            <MicOff /> {t("expQuick.stopAndParse")}
          </Button>
        )}
        {loading && <Loader2 className="animate-spin text-muted-foreground" />}
        {recording && (
          <span className="text-sm text-muted-foreground animate-pulse">
            {t("expQuick.listening")}
          </span>
        )}
      </div>
      {transcript && (
        <div className="text-sm bg-muted/50 rounded-md p-3">
          <p className="text-xs uppercase text-muted-foreground mb-1">{t("expQuick.transcript")}</p>
          <p>{transcript}</p>
        </div>
      )}
      {items && (
        <ParsedReview
          items={items}
          setItems={setItems}
          onConfirm={confirm}
          onCancel={() => {
            setItems(null);
            setTranscript("");
          }}
          loading={loading}
          householdId={householdId}
        />
      )}
    </div>
  );
}

function ParsedReview({
  items,
  setItems,
  onConfirm,
  onCancel,
  loading,
  householdId,
}: {
  items: Parsed[];
  setItems: (v: Parsed[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  householdId: string;
}) {
  const { names: hhCats } = useCategoryNames(householdId);
  const catOptions = hhCats.length ? hhCats : DEFAULT_CATEGORIES;
  const t = useT();
  function update(idx: number, patch: Partial<Parsed>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  if (!items.length)
    return <p className="text-sm text-muted-foreground">{t("expQuick.nothingDetected")}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length === 1
          ? t("expQuick.reviewOneExpense")
          : t("expQuick.reviewExpenses", { count: items.length })}
      </p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-md p-2">
            <Input
              className="col-span-3"
              type="number"
              step="0.01"
              value={it.amount}
              onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
            />
            <Select value={it.category} onValueChange={(v) => update(i, { category: v })}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="col-span-3"
              placeholder="merchant"
              value={it.merchant ?? ""}
              onChange={(e) => update(i, { merchant: e.target.value })}
            />
            <span className="col-span-2 text-xs text-muted-foreground">
              {fmtDateTime(it.occurred_at)}
            </span>
            <Button variant="ghost" size="sm" className="col-span-1" onClick={() => remove(i)}>
              ×
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={onConfirm} disabled={loading || !items.length}>
          {loading ? <Loader2 className="animate-spin" /> : null}{" "}
          {t("expQuick.confirmAndSave", {
            amount: money(items.reduce((s, i) => s + i.amount, 0)),
          })}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("expQuick.cancel")}
        </Button>
      </div>
    </div>
  );
}

function PhotoForm({ householdId, onAdded }: { householdId: string; onAdded?: () => void }) {
  const parse = useServerFn(parseReceiptPhoto);
  const bulk = useServerFn(addExpensesBulk);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [base64, setBase64] = useState<string>("");
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useT();

  function clear() {
    setPreview(null);
    setBase64("");
    setMime("");
    setItems(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error(t("expQuick.pickImage"));
    if (f.size > 8 * 1024 * 1024) return toast.error(t("expQuick.imageTooLarge"));
    const buf = await f.arrayBuffer();
    const b64 = bufferToBase64(buf);
    setBase64(b64);
    setMime(f.type);
    setPreview(URL.createObjectURL(f));
    setItems(null);
  }

  async function doParse() {
    if (!base64) return;
    setLoading(true);
    try {
      const res = await parse({ data: { image_base64: base64, mime_type: mime, householdId } });
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.photoParsingFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!items?.length) return;
    setLoading(true);
    try {
      await bulk({
        data: {
          items: items.map((i) => ({
            household_id: householdId,
            amount: i.amount,
            category: i.category,
            merchant: i.merchant,
            occurred_at: i.occurred_at,
            note: i.note,
            source: "ai_photo" as const,
          })),
        },
      });
      toast.success(
        items.length === 1
          ? t("expQuick.addedExpenseSingular")
          : t("expQuick.addedExpensesPlural", { count: items.length }),
      );
      clear();
      onAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expQuick.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!preview ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <Button onClick={() => inputRef.current?.click()} variant="outline">
            <Camera /> {t("expQuick.takeOrUploadPhoto")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("expQuick.photoHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative inline-block">
            <img src={preview} alt="Receipt preview" className="max-h-64 rounded-md border" />
            <button
              type="button"
              onClick={clear}
              className="absolute top-1 right-1 rounded-full bg-background/90 border p-1 hover:bg-background"
              aria-label={t("expQuick.removeAria")}
            >
              <X className="size-3.5" />
            </button>
          </div>
          {!items ? (
            <div className="flex gap-2">
              <Button onClick={doParse} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
                {t("expQuick.parseReceipt")}
              </Button>
              <Button variant="ghost" onClick={clear} disabled={loading}>
                {t("expQuick.cancel")}
              </Button>
            </div>
          ) : (
            <ParsedReview
              items={items}
              setItems={setItems}
              onConfirm={confirm}
              onCancel={clear}
              loading={loading}
              householdId={householdId}
            />
          )}
        </div>
      )}
    </div>
  );
}
