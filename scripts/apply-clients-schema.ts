/**
 * Apply clients schema migration (003_clients.sql)
 * Uses direct postgres connection via pg module
 */
import { Client } from 'pg'

// Supabase postgres connection
// Service key is used as JWT password via Supabase's postgres JWT auth
const PROJECT_REF = 'fbgqzouxbagmmlzibyhl'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

const SQL = `
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  name text not null,
  type text default 'pessoa_juridica',
  document text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'clients_firm') THEN
    CREATE POLICY "clients_firm" ON public.clients FOR ALL USING (
      firm_id IN (SELECT firm_id FROM public.users WHERE id = auth.uid())
    );
  END IF;
END $$;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
`

async function main() {
  console.log('Applying 003_clients.sql migration...\n')

  const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('Connected to postgres!')
    await client.query(SQL)
    console.log('✓ Migration applied successfully!')
  } catch (err: any) {
    console.error('Postgres connection failed:', err.message)
    console.log('\nTrying pooler connection...')

    const pooler = new Client({
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    })

    try {
      await pooler.connect()
      console.log('Connected via pooler!')
      await pooler.query(SQL)
      console.log('✓ Migration applied successfully!')
      await pooler.end()
    } catch (err2: any) {
      console.error('Pooler also failed:', err2.message)
      printManual()
    }
  } finally {
    try { await client.end() } catch {}
  }
}

function printManual() {
  console.log('\n========================================')
  console.log('AUTO-APPLY FAILED — Run this SQL manually:')
  console.log('Supabase Dashboard: https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
  console.log('========================================\n')
  console.log(SQL)
  console.log('\n========================================')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  printManual()
  process.exit(0)
})
