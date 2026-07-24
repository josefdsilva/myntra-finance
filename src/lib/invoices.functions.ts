import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Record a file already uploaded to the private `invoices` Storage bucket as an
// attachment on an expense or a plan. RLS (WITH CHECK on household_id) guarantees
// the caller can only attach within a household they belong to.
export const addInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        expense_id: z.string().uuid().nullable().optional(),
        plan_id: z.string().uuid().nullable().optional(),
        path: z.string().min(1).max(500),
        file_name: z.string().max(300).nullable().optional(),
        mime_type: z.string().max(100).nullable().optional(),
        size_bytes: z.number().int().min(0).nullable().optional(),
      })
      .refine((d) => !!d.expense_id || !!d.plan_id, {
        message: "expense_id or plan_id required",
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("invoices")
      .insert({
        household_id: data.household_id,
        expense_id: data.expense_id ?? null,
        plan_id: data.plan_id ?? null,
        path: data.path,
        file_name: data.file_name ?? null,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// Remove an attachment: delete the Storage object (best-effort) then the row.
export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error: fErr } = await context.supabase
      .from("invoices")
      .select("path")
      .eq("id", data.id)
      .single();
    if (fErr) throw fErr;
    if (row?.path) {
      // Best-effort: never block the row delete on a storage hiccup.
      await context.supabase.storage.from("invoices").remove([row.path]);
    }
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
