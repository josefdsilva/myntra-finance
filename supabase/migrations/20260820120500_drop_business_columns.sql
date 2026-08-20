-- Drop the business-only columns from households. Run this ONLY after the code
-- that reads/writes these columns has been removed and deployed (the accountant
-- handoff, runway/cash-on-hand override, and the sector/employees business
-- profile). If any live query still selects one of these by name, dropping it
-- here will make that query fail — so deploy the code cleanup first.

alter table public.households
  drop column if exists advisor_email,          -- accountant handoff
  drop column if exists cash_on_hand_override,  -- SME runway override
  drop column if exists cash_on_hand_override_at,
  drop column if exists employees,              -- business profile
  drop column if exists sector;                 -- business NACE sector
