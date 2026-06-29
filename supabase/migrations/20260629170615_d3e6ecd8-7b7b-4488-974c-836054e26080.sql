
-- ============ Enums ============
CREATE TYPE public.member_role AS ENUM ('owner', 'member');
CREATE TYPE public.bucket_target_type AS ENUM ('pct_surplus', 'fixed_monthly', 'fixed_yearly');
CREATE TYPE public.expense_source AS ENUM ('manual', 'ai_memo', 'ai_voice', 'statement');
CREATE TYPE public.import_status AS ENUM ('pending', 'parsed', 'approved', 'failed');

-- ============ Households ============
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  baseline_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- ============ Household members ============
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
CREATE INDEX household_members_user_idx ON public.household_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- ============ Security definer helper ============
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_household()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.household_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1
$$;

-- ============ Profiles ============
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Members can view profiles in same household"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() AND hm2.user_id = profiles.user_id
  ));
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============ Household RLS ============
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id, auth.uid()));
CREATE POLICY "Authenticated can create household"
  ON public.households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update household"
  ON public.households FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = households.id AND user_id = auth.uid() AND role = 'owner'
  ));
CREATE POLICY "Owners can delete household"
  ON public.households FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = households.id AND user_id = auth.uid() AND role = 'owner'
  ));

-- ============ household_members RLS ============
CREATE POLICY "Members can view their household members"
  ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY "Self insert as creator"
  ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can remove members"
  ON public.household_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_members.household_id
      AND hm.user_id = auth.uid() AND hm.role = 'owner'
  ));

-- ============ Invitations ============
CREATE TABLE public.household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_invitations TO authenticated;
GRANT ALL ON public.household_invitations TO service_role;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invites for their household"
  ON public.household_invitations FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY "Members can create invites"
  ON public.household_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "Members can delete invites"
  ON public.household_invitations FOR DELETE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

-- ============ Incomes ============
CREATE TABLE public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX incomes_household_idx ON public.incomes(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomes TO authenticated;
GRANT ALL ON public.incomes TO service_role;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage incomes"
  ON public.incomes FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ============ Fixed expenses ============
CREATE TABLE public.fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fixed_expenses_household_idx ON public.fixed_expenses(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expenses TO authenticated;
GRANT ALL ON public.fixed_expenses TO service_role;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage fixed expenses"
  ON public.fixed_expenses FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ============ Buckets ============
CREATE TABLE public.buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_type public.bucket_target_type NOT NULL DEFAULT 'pct_surplus',
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX buckets_household_idx ON public.buckets(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buckets TO authenticated;
GRANT ALL ON public.buckets TO service_role;
ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage buckets"
  ON public.buckets FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ============ Expenses ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  added_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  merchant TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  source public.expense_source NOT NULL DEFAULT 'manual',
  source_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_household_occurred_idx ON public.expenses(household_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ============ Bank imports ============
CREATE TABLE public.bank_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT,
  status public.import_status NOT NULL DEFAULT 'pending',
  raw_extract JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_imports_household_idx ON public.bank_imports(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_imports TO authenticated;
GRANT ALL ON public.bank_imports TO service_role;
ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage bank imports"
  ON public.bank_imports FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_households_updated BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_incomes_updated BEFORE UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fixed_expenses_updated BEFORE UPDATE ON public.fixed_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_buckets_updated BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
