-- Business-mode prototype: a workspace ("household") is either a personal
-- household or a business entity. This single attribute drives the whole
-- personal/business distinction in the app — same data model, mode-aware UI.
-- advisor_email is the tax advisor a business space can hand its quarter off to.
ALTER TABLE public.households
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'business')),
  ADD COLUMN advisor_email TEXT;
