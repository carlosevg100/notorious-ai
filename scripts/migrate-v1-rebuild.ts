import { Client } from 'pg'

const PROJECT_REF = 'fbgqzouxbagmmlzibyhl'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const SQL = `
-- V1 Rebuild Migration — Add missing columns for new UI

-- clients: add cnpj as alias/copy of document, add relationship_notes if missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
-- Copy existing document values to cnpj
UPDATE clients SET cnpj = document WHERE cnpj IS NULL AND document IS NOT NULL;

-- projects: add missing columns for litigation management
ALTER TABLE projects ADD COLUMN IF NOT EXISTS numero_processo TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vara TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS comarca TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'contencioso';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'analise';

-- documents: add missing columns for v1 rebuild
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

-- Copy existing file_path to storage_path where not set
UPDATE documents SET storage_path = file_path WHERE storage_path IS NULL AND file_path IS NOT NULL;

-- Copy upload_status/ai_status to processing_status where not set
UPDATE documents SET processing_status = CASE
  WHEN ai_status = 'completed' THEN 'completed'
  WHEN ai_status = 'processing' THEN 'processing'
  WHEN ai_status = 'error' THEN 'error'
  WHEN upload_status = 'completed' THEN 'pending'
  ELSE 'pending'
END WHERE processing_status = 'pending' AND ai_status IS NOT NULL;

-- Index for processing_status queries
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_firm_id ON projects(firm_id);
CREATE INDEX IF NOT EXISTS idx_prazos_project_id ON prazos(project_id);

-- Notify schema cache to reload
NOTIFY pgrst, 'reload schema';
`

async function main() {
  const configs = [
    {
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    },
    {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    },
    {
      host: `aws-0-sa-east-1.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    }
  ]

  for (const config of configs) {
    const client = new Client(config)
    try {
      await client.connect()
      console.log(`Connected to ${config.host}!`)
      await client.query(SQL)
      console.log('✓ V1 rebuild migration applied successfully!')
      await client.end()
      return
    } catch (err: any) {
      console.error(`Failed ${config.host}:`, err.message)
      try { await client.end() } catch {}
    }
  }
  console.error('All connection attempts failed')
  process.exit(1)
}

main()
