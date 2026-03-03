-- Migration 006: processos table for contencioso (litigation defense)
CREATE TABLE IF NOT EXISTS processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  client_id UUID REFERENCES clients(id),
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
  fase TEXT DEFAULT 'recebido' CHECK (fase IN (
    'recebido','extracao','docs_solicitados','docs_recebidos',
    'contestacao_gerando','contestacao_revisao','protocolado','aguardando_replica'
  )),
  prazo_contestacao DATE,
  risco TEXT DEFAULT 'medio' CHECK (risco IN ('alto','medio','baixo')),
  status TEXT DEFAULT 'ativo',
  teses_defesa JSONB DEFAULT '[]',
  contestacao_gerada TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_processos" ON processos
  FOR ALL USING (
    firm_id = (SELECT firm_id FROM users WHERE id = auth.uid())
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_processos_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS processos_updated_at ON processos;
CREATE TRIGGER processos_updated_at
  BEFORE UPDATE ON processos
  FOR EACH ROW EXECUTE FUNCTION update_processos_updated_at();

-- Demo seed data
INSERT INTO processos (
  firm_id, client_id, numero_processo, tribunal, comarca, vara, juiz,
  classe_processual, assunto, valor_causa,
  polo_ativo, polo_passivo, pedidos, tutela_urgencia,
  fase, risco, prazo_contestacao,
  fatos_resumidos, resumo_executivo
) VALUES (
  '1f430c10-550a-4267-9193-e03c831fc394',
  '8513fef2-95bf-4a4d-a098-ad7b4d2819d7',
  '1023456-78.2024.8.26.0100',
  'TJSP', 'São Paulo', '15ª Vara Cível', 'Dr. Roberto Almeida Costa',
  'Procedimento Comum Cível', 'Indenização por Danos Morais e Materiais',
  285000,
  '{"nome": "João Carlos Ferreira", "cpf_cnpj": "123.456.789-00", "advogado": "Dr. Paulo Mendes", "oab": "OAB/SP 45.231"}',
  '{"nome": "Petrobras S.A.", "cpf_cnpj": "33.000.167/0001-01"}',
  '["Indenização por danos morais R$ 150.000", "Indenização por danos materiais R$ 85.000", "Lucros cessantes R$ 50.000"]',
  false,
  'docs_solicitados', 'alto',
  CURRENT_DATE + INTERVAL ''15 days'',
  'O autor alega que foi demitido sem justa causa após 8 anos de serviço, tendo sido privado de benefícios contratuais e sofrido abalo psicológico em decorrência das circunstâncias da demissão. Alega ainda que documentos de rescisão apresentam irregularidades.',
  'Ação de indenização movida por ex-funcionário pleiteando R$ 285.000 em danos morais, materiais e lucros cessantes. Risco classificado como ALTO dado o valor elevado e alegações de irregularidade em documentos. Solicitamos urgentemente: (1) CTPS e documentos de admissão, (2) Termo de Rescisão assinado, (3) Registros de ponto dos últimos 12 meses. Prazo de contestação: 15 dias úteis.'
) ON CONFLICT DO NOTHING;
