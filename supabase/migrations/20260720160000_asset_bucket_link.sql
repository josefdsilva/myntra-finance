-- Link an investment project (bucket) to an asset. Money going INTO the linked
-- project — manual deposits/transfers AND confirmed monthly allocations —
-- automatically raises the asset's current value and cost basis; money leaving
-- lowers them. One bucket links to at most one asset.
--
-- Net worth de-duplication (handled in the app layer): a linked project's
-- balance is no longer counted as savings, because the asset now represents
-- that money. On linking, the app absorbs the project's current balance into
-- the asset so the transition is continuous.
ALTER TABLE public.assets
  ADD COLUMN bucket_id UUID REFERENCES public.buckets(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX assets_bucket_id_uidx ON public.assets(bucket_id) WHERE bucket_id IS NOT NULL;

-- Apply a signed delta (value AND cost basis) to the asset linked to a bucket.
-- No-ops when the bucket has no linked asset; never drops below zero.
CREATE OR REPLACE FUNCTION private.adjust_asset_for_bucket(_bucket_id uuid, _delta numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.assets
     SET current_value  = GREATEST(0, current_value + _delta),
         acquired_value = GREATEST(0, COALESCE(acquired_value, 0) + _delta)
   WHERE bucket_id = _bucket_id;
$$;
REVOKE ALL ON FUNCTION private.adjust_asset_for_bucket(uuid, numeric) FROM PUBLIC, anon, authenticated;

-- Movements: deposits/transfers into a linked bucket raise the asset; out lowers it.
CREATE OR REPLACE FUNCTION public.trg_asset_sync_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.to_type = 'bucket' AND NEW.to_id IS NOT NULL THEN
      PERFORM private.adjust_asset_for_bucket(NEW.to_id, NEW.amount);
    END IF;
    IF NEW.from_type = 'bucket' AND NEW.from_id IS NOT NULL THEN
      PERFORM private.adjust_asset_for_bucket(NEW.from_id, -NEW.amount);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.to_type = 'bucket' AND OLD.to_id IS NOT NULL THEN
      PERFORM private.adjust_asset_for_bucket(OLD.to_id, -OLD.amount);
    END IF;
    IF OLD.from_type = 'bucket' AND OLD.from_id IS NOT NULL THEN
      PERFORM private.adjust_asset_for_bucket(OLD.from_id, OLD.amount);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_asset_sync_movement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER assets_sync_on_movement
  AFTER INSERT OR DELETE ON public.account_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_asset_sync_movement();

-- Allocations: a confirmed monthly allocation into a linked bucket raises the
-- asset by the CHANGE in amount (covers set, add and undo).
CREATE OR REPLACE FUNCTION public.trg_asset_sync_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.adjust_asset_for_bucket(NEW.bucket_id, NEW.amount);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bucket_id = OLD.bucket_id THEN
      PERFORM private.adjust_asset_for_bucket(NEW.bucket_id, NEW.amount - OLD.amount);
    ELSE
      PERFORM private.adjust_asset_for_bucket(OLD.bucket_id, -OLD.amount);
      PERFORM private.adjust_asset_for_bucket(NEW.bucket_id, NEW.amount);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM private.adjust_asset_for_bucket(OLD.bucket_id, -OLD.amount);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_asset_sync_allocation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER assets_sync_on_allocation
  AFTER INSERT OR UPDATE OR DELETE ON public.bucket_allocations
  FOR EACH ROW EXECUTE FUNCTION public.trg_asset_sync_allocation();
