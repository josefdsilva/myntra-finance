-- Recurring-income categories are space-specific. Businesses need categories
-- like services rendered, product sales, subscriptions/retainers, interest and
-- grants alongside the existing personal ones (salary, rent, pension, benefits).
-- Relax the type CHECK to the full union; the UI shows the kind-appropriate set.

ALTER TABLE public.incomes DROP CONSTRAINT IF EXISTS incomes_type_check;

ALTER TABLE public.incomes
  ADD CONSTRAINT incomes_type_check
  CHECK (type IN (
    'salary', 'rent', 'pension', 'benefits',
    'services', 'sales', 'subscriptions', 'interest', 'grants',
    'other'
  ));
