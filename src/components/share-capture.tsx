import { useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  parseMemo,
  parseReceiptPhoto,
  extractStatementTransactions,
} from "@/lib/ai-parse.functions";
import { categorizeMerchants, saveMerchantRule } from "@/lib/statement-import.functions";
import { prepareImageForUpload } from "@/lib/image-prep";
import { addExpensesBulk } from "@/lib/budget.functions";
import { existingFingerprints } from "@/lib/import.functions";
import { txnFingerprint } from "@/lib/import-dedup";
import { defaultIntentForCategory, type IntentLevel } from "@/lib/intent";
import { money, fmtDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCategoryNames } from "@/hooks/use-categories";

// Encode a large ArrayBuffer to base64 without blowing the call stack.
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

function humanError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    const m = err.message.trim();
    const technical =
      m.length > 120 ||
      m.startsWith("{") ||
      m.startsWith("[") ||
      m.includes('"code"') ||
      m.includes("ZodError") ||
      m.toLowerCase().includes("valid json") ||
      m.includes("\n");
    if (!technical) return m;
  }
  return fallback;
}

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

type ParsedRow = {
  direction: "out" | "in";
  amount: number;
  category: string;
  merchant: string;
  occurred_at?: string;
  note?: string;
};

type Row = ParsedRow & {
  /** Need-level, auto-derived from the category; adjustable later on Expenses. */
  intent?: IntentLevel;
  /** Dedup fingerprint (also stored in source_meta.fp so re-imports are clean). */
  fp?: string;
  /** True when this row matches an existing ledger transaction. */
  duplicate?: boolean;
  /** Whether this row will be saved. Duplicates default to unchecked. */
  include: boolean;
  /** The auto-suggested category, so we can learn from a user's correction. */
  suggestedCategory?: string;
  /** Free-text tags the user adds in review (e.g. "holiday", "reimbursable"). */
  labels?: string[];
};

const isCsvFile = (f: File) =>
  f.type.includes("csv") ||
  f.type.includes("tab-separated") ||
  /\.(csv|tsv)$/i.test(f.name);
const isTextFile = (f: File) => f.type === "text/plain" || /\.txt$/i.test(f.name);
const isImageFile = (f: File) =>
  f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name);
const isPdfFile = (f: File) => f.type.includes("pdf") || /\.pdf$/i.test(f.name);

export function ShareCapture({
  householdId,
  initialText = "",
  initialFiles,
  onDone,
}: {
  householdId: string;
  initialText?: string;
  initialFiles?: File[];
  onDone?: () => void;
}) {
  const t = useT();
  const parseText = useServerFn(parseMemo);
  const parsePhoto = useServerFn(parseReceiptPhoto);
  const extract = useServerFn(extractStatementTransactions);
  const categorize = useServerFn(categorizeMerchants);
  const bulk = useServerFn(addExpensesBulk);
  const existFp = useServerFn(existingFingerprints);
  const saveRule = useServerFn(saveMerchantRule);

  const { names: hhCats } = useCategoryNames(householdId);
  // Always include the fallback categories the parser may assign ("income",
  // "other") so a row's value is never orphaned from the dropdown options.
  const catOptions = Array.from(
    new Set([...(hhCats.length ? hhCats : DEFAULT_CATEGORIES), "income", "other"]),
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const confirmWord = t("share.confirmWord");
  const confirmed = confirmText.trim().toLowerCase() === confirmWord.trim().toLowerCase();

  function addRows(next: Row[]) {
    setRows((prev) => [...(prev ?? []), ...next]);
  }

  // Turn freshly-parsed rows into review rows: derive the need-level from the
  // category, compute a dedup fingerprint, and flag (and uncheck) any that match
  // a transaction already in the ledger — so re-importing an overlapping
  // statement never doubles anything.
  async function finalizeRows(parsed: ParsedRow[]): Promise<Row[]> {
    const withMeta: Row[] = parsed.map((r) => {
      const kind = r.direction === "in" ? "income" : "expense";
      const fp = txnFingerprint({
        date: r.occurred_at ?? new Date().toISOString(),
        amount: r.amount,
        description: r.merchant,
        kind,
      });
      return {
        ...r,
        fp,
        intent: r.direction === "in" ? undefined : defaultIntentForCategory(r.category),
        suggestedCategory: r.category,
        duplicate: false,
        include: true,
        labels: [],
      };
    });
    const dates = withMeta.map((r) => r.occurred_at).filter(Boolean) as string[];
    if (dates.length) {
      const start = dates.reduce((a, b) => (a < b ? a : b));
      const endDay = dates.reduce((a, b) => (a > b ? a : b)).slice(0, 10);
      const end = `${endDay}T23:59:59.999Z`;
      try {
        const { fingerprints } = await existFp({
          data: { household_id: householdId, start, end },
        });
        const seen = new Set(fingerprints);
        for (const r of withMeta) {
          if (r.fp && seen.has(r.fp)) {
            r.duplicate = true;
            r.include = false;
          }
        }
      } catch {
        // Dedup is best-effort; if the lookup fails, show every row as new.
      }
    }
    return withMeta;
  }

  // Files handed in from an OS share (via the service worker) are parsed once,
  // automatically, so the user lands straight on the review deck.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialFiles?.length) return;
    seededRef.current = true;
    void handleFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  async function runText() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await parseText({ data: { text: text.slice(0, 2000), householdId } });
      const mapped: ParsedRow[] = (res.items ?? []).map((i) => ({
        direction: "out",
        amount: Math.abs(i.amount) || 0,
        category: i.category || "other",
        merchant: i.merchant ?? "",
        occurred_at: i.occurred_at,
        note: i.note ?? undefined,
      }));
      if (!mapped.length) toast.info(t("share.nothingDetected"));
      else {
        addRows(await finalizeRows(mapped));
        setText("");
      }
    } catch (err) {
      toast.error(humanError(err, t("share.parseFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function runReceipt(file: File): Promise<ParsedRow[]> {
    // Downscale + transcode to JPEG first (handles big iPhone photos and HEIC).
    const prepped = await prepareImageForUpload(file);
    const res = await parsePhoto({
      data: { image_base64: prepped.base64, mime_type: prepped.mimeType, householdId },
    });
    return (res.items ?? []).map((i) => ({
      direction: "out" as const,
      amount: Math.abs(i.amount) || 0,
      category: i.category || "other",
      merchant: i.merchant ?? "",
      occurred_at: i.occurred_at,
      note: i.note ?? undefined,
    }));
  }

  async function runTextFile(file: File): Promise<ParsedRow[]> {
    const raw = (await file.text()).slice(0, 2000);
    if (!raw.trim()) return [];
    const res = await parseText({ data: { text: raw, householdId } });
    return (res.items ?? []).map((i) => ({
      direction: "out" as const,
      amount: Math.abs(i.amount) || 0,
      category: i.category || "other",
      merchant: i.merchant ?? "",
      occurred_at: i.occurred_at,
      note: i.note ?? undefined,
    }));
  }

  async function runStatement(file: File): Promise<ParsedRow[]> {
    const b64 = bufferToBase64(await file.arrayBuffer());
    const res = await extract({
      data: {
        file_base64: b64,
        mime_type: file.type || "text/csv",
        file_name: file.name || "shared.csv",
        householdId,
      },
    });
    const items = res.items ?? [];
    // Categorize only the money-out descriptions (money-in stays uncategorized).
    const outKeys = Array.from(
      new Set(
        items
          .filter((i) => i.amount < 0)
          .map((i) => (i.description || "").trim().slice(0, 120))
          .filter(Boolean),
      ),
    ).slice(0, 300);
    let map: Record<string, string> = {};
    if (outKeys.length) {
      try {
        const c = await categorize({ data: { householdId, merchants: outKeys } });
        map = c.map ?? {};
      } catch {
        // Categorization is best-effort; fall back to "other".
      }
    }
    return items
      .filter((i) => Number.isFinite(i.amount) && i.amount !== 0)
      .map((i) => {
        const desc = (i.description || "").trim().slice(0, 120);
        const out = i.amount < 0;
        return {
          direction: out ? ("out" as const) : ("in" as const),
          amount: Math.abs(i.amount),
          category: out ? (map[desc] ?? "other") : "income",
          merchant: desc,
          occurred_at: i.date,
          note: undefined,
        };
      });
  }

  async function handleFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const collected: ParsedRow[] = [];
      let skipped = 0;
      for (const f of files) {
        try {
          if (isImageFile(f) || isPdfFile(f)) collected.push(...(await runReceipt(f)));
          else if (isCsvFile(f)) collected.push(...(await runStatement(f)));
          else if (isTextFile(f)) collected.push(...(await runTextFile(f)));
          else skipped += 1;
        } catch (err) {
          toast.error(humanError(err, t("share.parseFailed")));
        }
      }
      if (skipped) toast.info(t("share.unsupportedSkipped", { count: skipped }));
      if (collected.length) addRows(await finalizeRows(collected));
      else if (!skipped) toast.info(t("share.nothingDetected"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev
        ? prev.map((r, i) => {
            if (i !== idx) return r;
            const next = { ...r, ...patch };
            // Changing the category re-derives the need-level (unless income).
            if (patch.category !== undefined) {
              next.intent = next.direction === "in" ? undefined : defaultIntentForCategory(next.category);
            }
            return next;
          })
        : prev,
    );
  }
  function remove(idx: number) {
    setRows((prev) => {
      const next = (prev ?? []).filter((_, i) => i !== idx);
      return next.length ? next : null;
    });
  }

  async function save() {
    if (!rows?.length || !confirmed) return;
    const toSave = rows.filter((r) => r.include && r.amount > 0);
    if (!toSave.length) {
      toast.info(t("share.nothingToSave"));
      return;
    }
    setBusy(true);
    try {
      await bulk({
        data: {
          items: toSave.map((r) => ({
            household_id: householdId,
            amount: r.amount,
            category: r.category,
            merchant: r.merchant || null,
            occurred_at: r.occurred_at,
            note: r.note || null,
            source: "share" as const,
            kind: r.direction === "in" ? ("income" as const) : ("expense" as const),
            intent: r.direction === "in" ? null : (r.intent ?? null),
            labels: r.labels ?? [],
            // Fingerprint travels with the row so a future re-import can skip it.
            source_meta: r.fp ? { fp: r.fp } : undefined,
          })),
        },
      });
      // Learn from corrections: when a money-out row's category was changed away
      // from the suggestion, remember merchant → category for next time.
      const corrections = toSave.filter(
        (r) =>
          r.direction === "out" &&
          r.merchant &&
          r.category &&
          r.category !== r.suggestedCategory,
      );
      await Promise.allSettled(
        corrections.map((r) =>
          saveRule({ data: { householdId, merchant: r.merchant, category: r.category } }),
        ),
      );
      toast.success(
        toSave.length === 1 ? t("share.savedOne") : t("share.savedMany", { count: toSave.length }),
      );
      setRows(null);
      setConfirmText("");
      onDone?.();
    } catch (err) {
      toast.error(humanError(err, t("share.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  const netIn = (rows ?? [])
    .filter((r) => r.direction === "in")
    .reduce((s, r) => s + r.amount, 0);
  const netOut = (rows ?? [])
    .filter((r) => r.direction === "out")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      {!rows && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={
              "rounded-xl border-2 border-dashed p-8 text-center transition-colors " +
              (dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25")
            }
          >
            <Upload className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{t("share.dropTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("share.dropHint")}</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/csv,text/tab-separated-values,text/plain,.csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{" "}
              {t("share.chooseFiles")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("share.pasteLabel")}</Label>
            <Textarea
              rows={3}
              placeholder={t("share.pastePlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button onClick={runText} disabled={busy || !text.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {t("share.readText")}
            </Button>
          </div>
        </>
      )}

      {rows && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {rows.length === 1
                ? t("share.reviewOne")
                : t("share.reviewMany", { count: rows.length })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> {t("share.addMore")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/csv,text/tab-separated-values,text/plain,.csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {rows.some((r) => r.duplicate) && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {t("share.duplicatesFound", { count: rows.filter((r) => r.duplicate).length })}
            </p>
          )}

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1.5 rounded-md bg-muted/30 p-2 ${!r.include ? "opacity-55" : ""}`}
              >
                <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => update(i, { include: e.target.checked })}
                  className="size-4 shrink-0"
                  aria-label={t("share.include")}
                />
                {r.duplicate && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {t("share.dupTag")}
                  </span>
                )}
                <div className="grid grid-cols-12 items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    update(i, { direction: r.direction === "out" ? "in" : "out" })
                  }
                  title={t("share.toggleDirection")}
                  className={
                    "col-span-2 inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium " +
                    (r.direction === "in"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600")
                  }
                >
                  {r.direction === "in" ? (
                    <ArrowDownLeft className="size-3.5" />
                  ) : (
                    <ArrowUpRight className="size-3.5" />
                  )}
                  {r.direction === "in" ? t("share.in") : t("share.out")}
                </button>
                <Input
                  className="col-span-2"
                  type="number"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                />
                <Select value={r.category} onValueChange={(v) => update(i, { category: v })}>
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
                  placeholder={t("share.merchant")}
                  value={r.merchant}
                  onChange={(e) => update(i, { merchant: e.target.value })}
                />
                <span className="col-span-1 truncate text-[11px] text-muted-foreground">
                  {r.occurred_at ? fmtDateTime(r.occurred_at) : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="col-span-1"
                  onClick={() => remove(i)}
                  aria-label={t("share.remove")}
                >
                  <X className="size-4" />
                </Button>
                </div>
                </div>
                <input
                  className="ml-6 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                  placeholder={t("share.labelsPlaceholder")}
                  value={(r.labels ?? []).join(", ")}
                  onChange={(e) =>
                    update(i, {
                      labels: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {t("share.totals", { out: money(netOut), in: money(netIn) })}
          </p>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <Label className="text-sm">
              {t("share.typeToConfirm", { word: confirmWord })}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-48"
                value={confirmText}
                placeholder={confirmWord}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                onClick={save}
                disabled={busy || !confirmed || !rows.some((r) => r.include && r.amount > 0)}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}{" "}
                {t("share.saveCount", {
                  count: rows.filter((r) => r.include && r.amount > 0).length,
                })}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setRows(null);
                  setConfirmText("");
                }}
              >
                {t("share.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
