-- Add doc_source column to documents table
-- 'parte_autora' = docs from plaintiff (uploaded in Phase 1 / NovoProcesso flow)
-- 'cliente' = docs from our client (uploaded in Phase 2 / project detail page)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_source TEXT DEFAULT 'parte_autora';
