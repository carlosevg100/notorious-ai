import { Client } from 'pg'

const PROJECT_REF = 'fbgqzouxbagmmlzibyhl'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
const CLIENT_ID = '8513fef2-95bf-4a4d-a098-ad7b4d2819d7'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL,
  client_id UUID,
  numero_processo TEXT,
  tribunal TEXT,
  comarca TEXT,
  vara TEXT,
  juiz TEXT,
  classe_processual TEXT,
  assunto TEXT,
  valor_causa NUMERIC,
  polo_ativo JSONB DEFAULT '{}',
  polo_passivo JSONB DEFAULT '{}',
  pedidos JSONB DEFAULT '[]',
  tutela_urgencia BOOLEAN DEFAULT FALSE,
  fatos_resumidos TEXT,
  causa_pedir TEXT,
  fundamentos_juridicos JSONB DEFAULT '[]',
  documentos_mencionados JSONB DEFAULT '[]',
  resumo_executivo TEXT,
  fase TEXT DEFAULT 'recebido',
  prazo_contestacao DATE,
  risco TEXT DEFAULT 'medio',
  status TEXT DEFAULT 'ativo',
  teses_defesa JSONB DEFAULT '[]',
  contestacao_gerada TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'processos' AND policyname = 'firm_processos') THEN
    CREATE POLICY "firm_processos" ON public.processos FOR ALL USING (
      firm_id IN (SELECT firm_id FROM public.users WHERE id = auth.uid())
    );
  END IF;
END $$;
`

const SEED_SQL = `
INSERT INTO public.processos (
  firm_id, client_id, numero_processo, tribunal, comarca, vara, juiz,
  classe_processual, assunto, valor_causa,
  polo_ativo, polo_passivo, pedidos, tutela_urgencia,
  fase, risco, prazo_contestacao,
  fatos_resumidos, resumo_executivo
) VALUES (
  '${FIRM_ID}',
  '${CLIENT_ID}',
  '1023456-78.2024.8.26.0100',
  'TJSP', 'São Paulo', '15ª Vara Cível', 'Dr. Roberto Almeida Costa',
  'Procedimento Comum Cível', 'Indenização por Danos Morais e Materiais',
  285000,
  '{"nome": "João Carlos Ferreira", "cpf_cnpj": "123.456.789-00", "advogado": "Dr. Paulo Mendes", "oab": "OAB/SP 45.231"}',
  '{"nome": "Petrobras S.A.", "cpf_cnpj": "33.000.167/0001-01"}',
  '["Indenização por danos morais R$ 150.000", "Indenização por danos materiais R$ 85.000", "Lucros cessantes R$ 50.000"]',
  false,
  'docs_solicitados', 'alto',
  CURRENT_DATE + INTERVAL '15 days',
  'O autor alega que foi demitido sem justa causa após 8 anos de serviço, tendo sido privado de benefícios contratuais e sofrido abalo psicológico em decorrência das circunstâncias da demissão. Alega ainda que documentos de rescisão apresentam irregularidades.',
  'Ação de indenização movida por ex-funcionário pleiteando R$ 285.000 em danos morais, materiais e lucros cessantes. Risco classificado como ALTO dado o valor elevado e alegações de irregularidade em documentos. Solicitamos urgentemente: (1) CTPS e documentos de admissão, (2) Termo de Rescisão assinado, (3) Registros de ponto dos últimos 12 meses. Prazo de contestação: 15 dias úteis.'
) ON CONFLICT DO NOTHING;
`

async function applyWithClient(client: Client) {
  await client.connect()
  console.log('Connected!')
  await client.query(SCHEMA_SQL)
  console.log('✓ Schema applied!')
  await client.query(SEED_SQL)
  console.log('✓ Demo data seeded!')
  await client.end()
}

async function main() {
  console.log('Applying 006_processos migration + seed...\n')

  // Try direct connection
  const direct = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  try {
    await applyWithClient(direct)
    console.log('\n✅ Done!')
    return
  } catch (err: any) {
    console.log('Direct failed:', err.message)
  }

  // Try pooler
  const pooler = new Client({
    host: `aws-0-us-east-1.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })

  try {
    await applyWithClient(pooler)
    console.log('\n✅ Done!')
    return
  } catch (err2: any) {
    console.log('Pooler failed:', err2.message)
    console.log('\n⚠️  AUTO-APPLY FAILED. Apply this SQL manually in Supabase Dashboard:')
    console.log('https://supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new')
    console.log('\n--- COPY THIS SQL ---')
    console.log(SCHEMA_SQL)
    console.log(SEED_SQL)
    console.log('--- END SQL ---')
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(0)
})
