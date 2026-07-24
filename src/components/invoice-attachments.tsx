import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip, FileText, Trash2, Eye, Loader2, AlertTriangle, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { addInvoice, deleteInvoice } from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/heic,image/webp,application/pdf";

type InvoiceRow = {
  id: string;
  path: string;
  file_name: string | null;
  mime_type: string | null;
};

/**
 * Manage the invoices/receipts attached to one expense or one plan. Files live
 * in the private `invoices` bucket; we only ever open them via short-lived
 * signed URLs. For business spaces an expense with no invoice is flagged.
 */
export function InvoiceAttachments({
  householdId,
  expenseId,
  planId,
  isBusiness = false,
}: {
  householdId: string;
  expenseId?: string;
  planId?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const addFn = useServerFn(addInvoice);
  const delFn = useServerFn(deleteInvoice);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const targetKey = expenseId ? ["invoices", "expense", expenseId] : ["invoices", "plan", planId];
  const { data: invoices = [], refetch } = useQuery({
    enabled: !!(expenseId || planId),
    queryKey: targetKey,
    queryFn: async () => {
      const col = expenseId ? "expense_id" : "plan_id";
      const val = expenseId ?? planId!;
      const { data, error } = await supabase
        .from("invoices")
        .select("id, path, file_name, mime_type")
        .eq(col, val)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${householdId}/${crypto.randomUUID()}/${safe}`;
        const { error: upErr } = await supabase.storage
          .from("invoices")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        await addFn({
          data: {
            household_id: householdId,
            expense_id: expenseId ?? null,
            plan_id: planId ?? null,
            path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          },
        });
      }
      toast.success(t("inv.uploadedToast"));
      refetch();
      // The expenses list flags rows without invoices — refresh that set.
      qc.invalidateQueries({ queryKey: ["invoice-flags", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inv.failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function view(path: string) {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error(t("inv.failed"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await delFn({ data: { id } });
      refetch();
      qc.invalidateQueries({ queryKey: ["invoice-flags", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inv.failed"));
    } finally {
      setBusy(false);
    }
  }

  const missing = isBusiness && invoices.length === 0;

  return (
    <div className="space-y-2">
      {invoices.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{inv.file_name ?? t("inv.file")}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" className="size-7" onClick={() => view(inv.path)}>
                  <Eye className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground"
                  disabled={busy}
                  onClick={() => remove(inv.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" />
          {missing ? (
            <Badge variant="outline" className="gap-1 text-destructive">
              <AlertTriangle className="size-3" /> {t("inv.missing")}
            </Badge>
          ) : (
            t("inv.none")
          )}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t("inv.attach")}
      </Button>
    </div>
  );
}
