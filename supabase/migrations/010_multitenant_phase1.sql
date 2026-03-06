-- ============================================================
-- MIGRATION 010: Multi-Tenant Phase 1
-- Litigator AI — Multi-Tenant B2B SaaS Infrastructure
-- Date: 2026-03-06
-- Reviewed by: Mr. Architect
--
-- APPLY VIA: Supabase Dashboard > SQL Editor
-- Run sections 1-11. Section 12 (storage) requires storage path
-- format verification first.
-- ============================================================


-- ============================================================
-- SECTION 1: SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_firm_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT firm_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  )
$$;


-- ============================================================
-- SECTION 2: EXTEND EXISTING TABLES
-- ============================================================

ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS oab_seccional TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'founder',
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;


-- ============================================================
-- SECTION 3: NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.firm_settings (
  firm_id    UUID PRIMARY KEY REFERENCES public.firms(id) ON DELETE CASCADE,
  logo_url   TEXT,
  address    TEXT,
  phone      TEXT,
  max_users              INT DEFAULT 5,
  max_active_processes   INT DEFAULT 50,
  features               JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.firm_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    UUID REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'advogado',
  invited_by UUID REFERENCES auth.users(id),
  token      UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  CONSTRAINT firm_invitations_valid_role   CHECK (role IN ('admin', 'advogado', 'estagiario', 'consulta')),
  CONSTRAINT firm_invitations_valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_firm_invitations_token
  ON public.firm_invitations(token);

CREATE INDEX IF NOT EXISTS idx_firm_invitations_firm_email
  ON public.firm_invitations(firm_id, email);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 4: ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE public.firm_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 5: ADD ROLE CONSTRAINT ON users
-- ============================================================

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_valid_role
    CHECK (role IN ('admin', 'advogado', 'estagiario', 'consulta'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 6: FIX EXISTING RLS POLICIES ON users TABLE
-- ============================================================

DROP POLICY IF EXISTS "user_self"        ON public.users;
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


-- ============================================================
-- SECTION 7: FIX firms TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS "firm_access" ON public.firms;
DROP POLICY IF EXISTS "firm_read_own" ON public.firms;

DO $$ BEGIN
  CREATE POLICY "firms_see_own" ON public.firms FOR SELECT USING (id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firms_admin_update" ON public.firms FOR UPDATE
    USING (id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firms_platform_admin_all" ON public.firms FOR ALL USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 8: RLS POLICIES FOR NEW TABLES
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "firm_settings_read_own" ON public.firm_settings FOR SELECT
    USING (firm_id = public.get_my_firm_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firm_settings_admin_insert" ON public.firm_settings FOR INSERT
    WITH CHECK (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firm_settings_admin_update" ON public.firm_settings FOR UPDATE
    USING (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "firm_settings_platform_admin" ON public.firm_settings FOR ALL
    USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invitations_admin_all" ON public.firm_invitations FOR ALL
    USING (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin')
    WITH CHECK (firm_id = public.get_my_firm_id() AND public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invitations_platform_admin" ON public.firm_invitations FOR ALL
    USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "platform_admins_self" ON public.platform_admins FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 9: LOCK DOWN firm_users (migration 007 dead table)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firm_users'
  ) THEN
    DROP POLICY IF EXISTS "firm_users_platform_admin_only" ON public.firm_users;

    CREATE POLICY "firm_users_platform_admin_only"
      ON public.firm_users FOR ALL
      USING (public.is_platform_admin());
  END IF;
END $$;


-- ============================================================
-- SECTION 10: UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS firm_settings_updated_at ON public.firm_settings;
CREATE TRIGGER firm_settings_updated_at
  BEFORE UPDATE ON public.firm_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS firms_updated_at ON public.firms;
CREATE TRIGGER firms_updated_at
  BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- SECTION 11: AUTH TRIGGER — Auto-create public.users on invite
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, firm_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    (NEW.raw_user_meta_data->>'firm_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'advogado')
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data->>'invitation_id' IS NOT NULL THEN
    UPDATE public.firm_invitations
    SET status = 'accepted'
    WHERE id = (NEW.raw_user_meta_data->>'invitation_id')::uuid
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 12: STORAGE POLICY FIX
--
-- PREREQUISITE: Storage paths MUST use {firm_id}/{project_id}/{filename}
-- Verify upload code before applying. If paths don't match, SKIP this section.
-- ============================================================

DROP POLICY IF EXISTS "upload_docs"  ON storage.objects;
DROP POLICY IF EXISTS "read_docs"    ON storage.objects;
DROP POLICY IF EXISTS "delete_docs"  ON storage.objects;

CREATE POLICY "upload_docs_firm_scoped"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

CREATE POLICY "read_docs_firm_scoped"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

CREATE POLICY "update_docs_firm_scoped"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

CREATE POLICY "delete_docs_firm_scoped"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );


-- ============================================================
-- END OF MIGRATION 010
-- ============================================================
