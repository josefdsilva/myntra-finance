import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Who the household is — first name, age and role per member. Used to tailor the
// journey (school horizon, retirement rung, buffer size) and to frame the coach's
// language. Optional everywhere: a household can skip this entirely.

export type HouseholdPerson = {
  id: string;
  name: string | null;
  age: number | null;
  role: string;
  sort_order: number;
};

const SELECT = "id, name, age, role, sort_order";

export const listPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("household_people")
      .select(SELECT)
      .eq("household_id", data.household_id)
      .order("sort_order", { ascending: true });
    return (rows as HouseholdPerson[] | null) ?? [];
  });

export const upsertPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        household_id: z.string().uuid(),
        name: z.string().max(60).nullable().optional(),
        age: z.number().int().min(0).max(120).nullable().optional(),
        role: z
          .enum([
            "employed",
            "self_employed",
            "student",
            "homemaker",
            "retired",
            "unemployed",
            "child",
          ])
          .optional(),
        sort_order: z.number().int().min(0).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, household_id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase
        .from("household_people")
        .update(rest)
        .eq("id", id)
        .eq("household_id", household_id);
      if (error) throw error;
      return { id };
    }
    const { data: inserted, error } = await context.supabase
      .from("household_people")
      .insert({ household_id, role: rest.role ?? "employed", ...rest })
      .select("id")
      .single();
    if (error) throw error;
    return { id: (inserted as { id: string }).id };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("household_people")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
