ALTER TABLE public.households ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

CREATE TABLE public.synthetic_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  email text NOT NULL,
  label text NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  seeded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.synthetic_personas TO service_role;

ALTER TABLE public.synthetic_personas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER synthetic_personas_touch_updated_at
BEFORE UPDATE ON public.synthetic_personas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_households_is_synthetic ON public.households(is_synthetic) WHERE is_synthetic;