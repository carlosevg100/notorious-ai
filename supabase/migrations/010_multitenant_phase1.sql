-- ============================================================
-- 010_multitenant_phase1.sql — Multi-tenant support
-- ============================================================

-- 1. SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_firm_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firm_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

-- 2. Extend firms table
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS oab_seccional TEXT;
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'active';

-- 3. Extend users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Create firm_settings table
CREATE TABLE IF NOT EXISTS public.firm_settings (
  firm_id UUID PRIMARY KEY REFERENCES public.firms(id) ON DELETE CASCADE,
  logo_url TEXT, address TEXT, phone TEXT,
  max_users INT DEFAULT 5, max_active_processes INT DEFAULT 50,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create firm_invitations table
CREATE TABLE IF NOT EXISTS public.firm_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'advogado',
  invited_by UUID REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  CONSTRAINT firm_invitations_valid_role CHECK (role IN ('admin', 'advogado', 'estagiario', 'consulta')),
  CONSTRAINT firm_invitations_valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- 6. Create platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Enable RLS on new tables
ALTER TABLE public.firm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 8. Add role constraint
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_valid_role CHECK (role IN ('admin', 'advogado', 'estagiario', 'consulta'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. FIX users table RLS
DROP POLICY IF EXISTS "user_self" ON public.users;
DROP POLICY IF EXISTS "user_insert_self" ON public.users;

DO $$ BEGIN
  CREATE POLICY "users_see_self" ON public.users FOR SELECT USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_see_firm_members" ON public.users FOR SELECT USING (firm_id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_platform_admin_all" ON public.users FOR ALL USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_update_self" ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "admin_manage_firm_users" ON public.users FOR UPDATE
    USING (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin' AND id <> auth.uid())
    WITH CHECK (firm_id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_insert_self" ON public.users FOR INSERT WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Fix firms table RLS
DROP POLICY IF EXISTS "firm_read_own" ON public.firms;
DO $$ BEGIN
  CREATE POLICY "firm_read_own" ON public.firms FOR SELECT USING (id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firm_platform_admin_all" ON public.firms FOR ALL USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS for new tables
DO $$ BEGIN
  CREATE POLICY "firm_settings_read_own" ON public.firm_settings FOR SELECT USING (firm_id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firm_settings_admin_update" ON public.firm_settings FOR UPDATE USING (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invitations_admin_all" ON public.firm_invitations FOR ALL
    USING (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin')
    WITH CHECK (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "platform_admins_self" ON public.platform_admins FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 11. Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_firm_settings_updated_at BEFORE UPDATE ON public.firm_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 12. AUTH TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, firm_id, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    (NEW.raw_user_meta_data->>'firm_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'advogado')
  )
  ON CONFLICT (id) DO NOTHING;
  IF NEW.raw_user_meta_data->>'invitation_id' IS NOT NULL THEN
    UPDATE public.firm_invitations SET status = 'accepted'
    WHERE id = (NEW.raw_user_meta_data->>'invitation_id')::uuid AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
