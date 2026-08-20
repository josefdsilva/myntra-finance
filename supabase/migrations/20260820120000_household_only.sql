-- Bynku is household-only: "business" ceases to exist as a space kind.
-- Safe to run now — converts any existing business spaces to personal (all their
-- data is preserved) and forbids the value going forward. Does NOT drop columns
-- (see 20260820120500_drop_business_columns.sql, which must run only after the
-- app code that references them has been deployed).

-- 1) Convert existing business households to personal. Their buckets, incomes,
--    expenses, debts, etc. are untouched — only the space "kind" changes.
update public.households set kind = 'personal' where kind <> 'personal';

-- 2) Default new rows to personal and forbid anything but 'personal'. After the
--    UPDATE above every row is 'personal', so the CHECK adds cleanly.
alter table public.households alter column kind set default 'personal';
alter table public.households drop constraint if exists households_kind_check;
alter table public.households add constraint households_kind_check check (kind = 'personal');
