
-- 1) Expand expense source enum to mark bank-synced rows
ALTER TYPE public.expense_source ADD VALUE IF NOT EXISTS 'bank_sync';

-- 2) Bank connections: one row per linked bank per household
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  institution_id text,
  institution_name text NOT NULL,
  institution_logo_url text,
  requisition_id text,
  status text NOT NULL DEFAULT 'active',
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_connections_household_idx ON public.bank_connections(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_connections TO authenticated;
GRANT ALL ON public.bank_connections TO service_role;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage bank connections" ON public.bank_connections
  FOR ALL
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE TRIGGER bank_connections_touch_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Bank accounts: one row per IBAN under a connection
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  display_name text NOT NULL,
  iban_last4 text,
  currency text NOT NULL DEFAULT 'EUR',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_balance numeric(14,2),
  last_balance_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_account_id)
);
CREATE INDEX bank_accounts_household_idx ON public.bank_accounts(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage bank accounts" ON public.bank_accounts
  FOR ALL
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE TRIGGER bank_accounts_touch_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Pending transactions: unified inbox awaiting user action
--    Feeds from bank sync, statement import, and any future channel.
CREATE TABLE public.pending_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'bank_sync' | 'statement'
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  external_transaction_id text, -- unique per bank_account when from bank_sync
  batch_id uuid, -- groups a statement import together
  amount numeric(12,2) NOT NULL, -- positive number; kind decides sign
  kind public.entry_kind NOT NULL DEFAULT 'expense',
  currency text NOT NULL DEFAULT 'EUR',
  occurred_at timestamptz NOT NULL,
  merchant text,
  note text,
  suggested_category text NOT NULL DEFAULT 'other',
  suggested_labels text[] NOT NULL DEFAULT '{}',
  raw jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'dismissed' | 'merged'
  matched_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  approved_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  resolved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_tx_household_status_idx
  ON public.pending_transactions(household_id, status, occurred_at DESC);
CREATE INDEX pending_tx_batch_idx
  ON public.pending_transactions(batch_id) WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX pending_tx_bank_dedup_idx
  ON public.pending_transactions(bank_account_id, external_transaction_id)
  WHERE bank_account_id IS NOT NULL AND external_transaction_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_transactions TO authenticated;
GRANT ALL ON public.pending_transactions TO service_role;
ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage pending tx" ON public.pending_transactions
  FOR ALL
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE TRIGGER pending_tx_touch_updated_at
  BEFORE UPDATE ON public.pending_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Traceability from expenses back to the bank transaction (nullable)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS bank_transaction_id text;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_bank_tx_unique_idx
  ON public.expenses(household_id, bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;
