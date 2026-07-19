DROP INDEX IF EXISTS public.pending_transactions_bank_dedup_idx;
DROP INDEX IF EXISTS public.pending_tx_bank_dedup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pending_transactions_bank_dedup_idx
  ON public.pending_transactions (bank_account_id, external_transaction_id);