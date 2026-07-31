-- Add the expense sources used by newer capture paths. 'share' is written by the
-- Share-to-bynku flow (addExpensesBulk with source 'share'); 'plan' is written
-- when resolving a plan optionally records a real expense. ADD VALUE is safe to
-- run standalone (see the earlier 'ai_photo' addition) and only registers the
-- label — it is not used elsewhere in this migration.
ALTER TYPE public.expense_source ADD VALUE IF NOT EXISTS 'share';
ALTER TYPE public.expense_source ADD VALUE IF NOT EXISTS 'plan';
