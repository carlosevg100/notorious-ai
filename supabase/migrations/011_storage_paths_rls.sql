-- ============================================================
-- MIGRATION 011: Storage Paths & RLS Policies
-- Litigator AI — Storage Security Fix
-- Date: 2026-03-06
-- Author: Mr. Web (sprint)
--
-- WHAT THIS DOES:
-- 1. Documents storage bucket set to PRIVATE
-- 2. Storage RLS policies scoped to firm_id (Section 12 from 010)
--
-- NOTE: Storage path data migration (documents/ prefix → firm_id/ prefix)
-- was performed via script: scripts/migrate-storage-paths.ts
-- All 55 existing documents migrated to {firm_id}/{project_id}/{filename}
-- ============================================================


-- ============================================================
-- SECTION 1: MAKE DOCUMENTS BUCKET PRIVATE
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'documents';


-- ============================================================
-- SECTION 2: STORAGE RLS POLICIES — firm-scoped access
-- ============================================================

-- Drop any pre-existing policies (idempotent)
DROP POLICY IF EXISTS "upload_docs"              ON storage.objects;
DROP POLICY IF EXISTS "read_docs"                ON storage.objects;
DROP POLICY IF EXISTS "delete_docs"              ON storage.objects;
DROP POLICY IF EXISTS "upload_docs_firm_scoped"  ON storage.objects;
DROP POLICY IF EXISTS "read_docs_firm_scoped"    ON storage.objects;
DROP POLICY IF EXISTS "update_docs_firm_scoped"  ON storage.objects;
DROP POLICY IF EXISTS "delete_docs_firm_scoped"  ON storage.objects;
DROP POLICY IF EXISTS "firm_storage_select"      ON storage.objects;
DROP POLICY IF EXISTS "firm_storage_insert"      ON storage.objects;
DROP POLICY IF EXISTS "firm_storage_delete"      ON storage.objects;

-- INSERT: users can only upload to their own firm's folder
CREATE POLICY "upload_docs_firm_scoped"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

-- SELECT: users can only read files in their own firm's folder
CREATE POLICY "read_docs_firm_scoped"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

-- UPDATE: users can only update files in their own firm's folder
CREATE POLICY "update_docs_firm_scoped"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

-- DELETE: users can only delete files in their own firm's folder
CREATE POLICY "delete_docs_firm_scoped"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );


-- ============================================================
-- END OF MIGRATION 011
-- ============================================================
