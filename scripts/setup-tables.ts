import { Client } from 'pg'

const PROJECT_REF = 'fbgqzouxbagmmlzibyhl'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const SQL = `
CREATE TABLE IF NOT EXISTS firm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'lawyer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(firm_id, user_id)
);

CREATE TABLE IF NOT EXISTS prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  data_prazo DATE NOT NULL,
  tipo TEXT DEFAULT 'processual',
  status TEXT DEFAULT 'pendente',
  dias_uteis_restantes INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  modelo_ia TEXT DEFAULT 'gpt-4o-mini',
  versao INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE firm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pecas ENABLE ROW LEVEL SECURITY;

-- Enable realtime for documents
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
`

const configs = [
  // Direct connection - various password formats
  { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres.${PROJECT_REF}', password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
  { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres', password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
  // Try pooler with different users
  { host: `aws-0-sa-east-1.pooler.supabase.com`, port: 5432, database: 'postgres', user: `postgres.${PROJECT_REF}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
  { host: `aws-0-us-west-1.pooler.supabase.com`, port: 5432, database: 'postgres', user: `postgres.${PROJECT_REF}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
]

async function main() {
  for (const config of configs) {
    const client = new Client(config)
    try {
      await client.connect()
      console.log(`Connected: ${config.host} as ${config.user}`)
      await client.query(SQL)
      console.log('✓ Tables created!')
      await client.end()
      process.exit(0)
    } catch (err: any) {
      console.log(`✗ ${config.host}/${config.user}: ${err.message.split('\n')[0]}`)
      try { await client.end() } catch {}
    }
  }
  console.log('All connection attempts failed - tables will need manual creation')
}

main()
