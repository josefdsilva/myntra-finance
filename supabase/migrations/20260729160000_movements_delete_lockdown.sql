-- Ledger integrity: account_movements are only ever written or removed by
-- membership-checked SECURITY DEFINER RPCs (record_movement and friends) or by
-- service-role/definer paths (e.g. reset_household). The app never deletes a
-- movement directly from the client, and a direct client DELETE could silently
-- corrupt derived bucket balances. Remove the client DELETE policy so, under
-- RLS, direct client deletes are denied by default. Definer/service paths are
-- unaffected (they bypass RLS).
DROP POLICY IF EXISTS "members delete movements" ON public.account_movements;
