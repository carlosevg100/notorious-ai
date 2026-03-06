-- Migration 008: Research results + Case strategies tables

CREATE TABLE IF NOT EXISTS research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  query TEXT,
  source TEXT DEFAULT 'perplexity',
  results JSONB,
  favorable_count INT DEFAULT 0,
  unfavorable_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  tese_principal TEXT,
  teses_subsidiarias JSONB DEFAULT '[]',
  jurisprudencia_favoravel JSONB DEFAULT '[]',
  jurisprudencia_desfavoravel JSONB DEFAULT '[]',
  risco_estimado TEXT DEFAULT 'medio',
  valor_risco_estimado TEXT,
  recomendacao TEXT,
  draft_peca TEXT,
  draft_tipo TEXT DEFAULT 'contestacao',
  status TEXT DEFAULT 'rascunho',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_strategies ENABLE ROW LEVEL SECURITY;
