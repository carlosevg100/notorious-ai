# Notorious AI — V4 Rebuild Brief
**Issued by:** Mr. Pickles (CEO)
**Date:** 2026-03-04
**Deadline:** 4 hours (demo B/Luz sexta-feira)
**Executor:** Mr. Musk (CTO) + Claude Code

---

## Contexto e Problema

A v3 atual está quebrada. Extração fica em loop infinito. Causa raiz: arquitetura fundamentalmente errada.

**O que está errado:**
- PDF parsing no browser (pdfjs-dist) — falha em PDFs pesados, sem controle de erros
- Serverless Vercel com 10s timeout processa o arquivo — timeout garantido em docs reais
- Sem feedback real de progresso — UI trava sem saber o que aconteceu
- Sem tratamento de erro robusto

**Isso não se resolve com patch. É rebuild de arquitetura.**

---

## Visão do Produto

Notorious AI não é apenas um app para B/Luz. É uma plataforma de IA jurídica para escritórios de advocacia brasileiros processarem **milhares de documentos por dia** para clientes enterprise (Latam Airlines, bancos, seguradoras).

O modelo enterprise:
- Escritório tem múltiplos clientes corporativos
- Cada cliente tem múltiplos projetos/processos
- Cada processo tem múltiplos documentos
- Sistema ingere, extrai, analisa e gera peças automaticamente
- Tudo com rastreabilidade e organização por cliente/projeto

---

## Nova Arquitetura (Obrigatório implementar exatamente assim)

```
FLUXO ATUAL (quebrado):
Browser → (PDF parse) → Vercel API (10s) → OpenAI → TIMEOUT

NOVO FLUXO (bulletproof):
1. Browser → Supabase Storage (upload direto, presigned URL)
2. Browser chama /api/process-document com { storage_path, processo_id }
3. Vercel API (leve, <100ms) → chama Supabase Edge Function via HTTP
4. Edge Function (Deno, até 150s):
   → baixa arquivo do Storage
   → extrai texto (pdfjs-dist ESM ou mammoth para DOCX)
   → chama OpenAI GPT-4o-mini com texto extraído
   → salva resultado estruturado no DB
   → atualiza status do documento
5. Frontend → Supabase Realtime subscription → atualiza UI automaticamente
```

**Por que Edge Functions:**
- Sem timeout de 10s (até 150s de execução)
- Roda Deno (ESM imports, sem node_modules)
- Gratuito no plano free (500k invocações/mês)
- Escala automaticamente para múltiplos docs em paralelo

---

## Supabase Setup

**Projeto:** fbgqzouxbagmmlzibyhl.supabase.co
**Service Role Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s

### Bucket de Storage (criar se não existir)
Nome: `documents`
Estrutura: `/firms/{firmId}/clients/{clientId}/projects/{projectId}/{filename}`
Acesso: privado (só via service role ou presigned URLs)

### Schema de banco novo (aplicar via Supabase SQL Editor)

```sql
-- Limpar tabelas antigas se existirem (cuidado com dados demo)
-- Manter tabelas de auth/users do Supabase

-- Firms (escritórios de advocacia)
CREATE TABLE IF NOT EXISTS firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter', -- starter, professional, enterprise
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users pertencentes a uma firm
CREATE TABLE IF NOT EXISTS firm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'lawyer', -- admin, lawyer, paralegal
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(firm_id, user_id)
);

-- Clientes da firma
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  type TEXT DEFAULT 'empresa', -- empresa, pessoa_fisica, orgao_publico
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projetos (processos jurídicos)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  numero_processo TEXT,
  tipo TEXT DEFAULT 'contencioso', -- contencioso, consultivo, trabalhista, tributario
  fase TEXT DEFAULT 'analise', -- analise, contestacao, recurso, execucao, encerrado
  vara TEXT,
  comarca TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- path no Supabase Storage
  file_type TEXT, -- pdf, docx, txt, image
  file_size_bytes BIGINT,
  processing_status TEXT DEFAULT 'pending',
  -- pending | uploading | processing | completed | error
  processing_error TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  extracted_text TEXT, -- texto bruto extraído
  extracted_data JSONB, -- dados estruturados (ver spec abaixo)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prazos (calculados em dias úteis)
CREATE TABLE IF NOT EXISTS prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  data_prazo DATE NOT NULL,
  tipo TEXT DEFAULT 'processual', -- processual, contratual, administrativo
  status TEXT DEFAULT 'pendente', -- pendente, cumprido, vencido
  dias_uteis_restantes INT, -- calculado e armazenado
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Peças geradas por IA
CREATE TABLE IF NOT EXISTS pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- contestacao, recurso, peticao, parecer
  conteudo TEXT NOT NULL,
  modelo_ia TEXT DEFAULT 'gpt-4o-mini',
  versao INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages por projeto
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes importantes
CREATE INDEX IF NOT EXISTS idx_projects_firm ON projects(firm_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_prazos_data ON prazos(data_prazo);

-- Enable RLS
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (acesso por firm_id via service role para Edge Functions)
-- Para o MVP, usar service role key no backend (bypass RLS)
-- RLS policies completas são roadmap para multi-tenant seguro

-- Demo data: criar firm B/Luz
INSERT INTO firms (id, name, slug) VALUES 
  ('1f430c10-550a-4267-9193-e03c831fc394', 'B/Luz Advogados', 'bluz')
ON CONFLICT (id) DO NOTHING;

-- Demo user mapping (cristiano@bluz.com.br)
-- Será inserido após confirmar UUID do usuário no Supabase Auth
```

---

## Edge Function: process-document

**Localização:** `supabase/functions/process-document/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!

serve(async (req) => {
  const { document_id } = await req.json()
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // 1. Buscar documento
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single()
  
  // 2. Atualizar status → processing
  await supabase.from('documents').update({
    processing_status: 'processing',
    processing_started_at: new Date().toISOString()
  }).eq('id', document_id)
  
  try {
    // 3. Download arquivo do Storage
    const { data: fileData } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)
    
    const buffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    
    // 4. Extrair texto baseado no tipo
    let extractedText = ''
    
    if (doc.file_type === 'txt') {
      extractedText = new TextDecoder().decode(bytes)
    } else if (doc.file_type === 'pdf') {
      // Usar pdfjs-dist via esm.sh (funciona em Deno)
      const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs')
      const loadingTask = pdfjsLib.getDocument({ data: bytes })
      const pdf = await loadingTask.promise
      const maxPages = Math.min(pdf.numPages, 50) // máx 50 páginas
      const textParts = []
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        textParts.push(content.items.map((item: any) => item.str).join(' '))
      }
      extractedText = textParts.join('\n\n')
    } else if (doc.file_type === 'docx') {
      // Para DOCX: converter para texto simples via mammoth (browser-side já fez)
      // Se chegou aqui como DOCX, tentar decode direto
      extractedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
        .replace(/[^\x20-\x7E\u00C0-\u024F\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    if (!extractedText || extractedText.length < 100) {
      throw new Error('Não foi possível extrair texto do documento. Verifique se o PDF não é uma imagem escaneada.')
    }
    
    // 5. Extrair dados estruturados com OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [{
          role: 'system',
          content: `Você é um especialista em análise de documentos jurídicos brasileiros. 
Extraia as informações do documento e retorne APENAS JSON válido, sem markdown, sem explicações.
Se uma informação não estiver presente, use null.`
        }, {
          role: 'user',
          content: `Analise este documento jurídico e extraia as informações em JSON com EXATAMENTE esta estrutura:

{
  "tipo_documento": "string (petição inicial, contestação, recurso, contrato, laudo, etc)",
  "numero_processo": "string ou null",
  "vara": "string ou null",
  "comarca": "string ou null",
  "partes": {
    "autor": "string ou null",
    "reu": "string ou null",
    "advogado_autor": "string ou null",
    "advogado_reu": "string ou null"
  },
  "causa_pedir": "string (resumo em 1-2 frases)",
  "pedidos": ["string", "string"],
  "fatos_relevantes": ["string", "string"],
  "teses_juridicas": ["string"],
  "tutela_antecipada": {
    "requerida": boolean,
    "fundamento": "string ou null"
  },
  "valor_causa": "string ou null",
  "prazos_identificados": [
    {
      "descricao": "string",
      "data": "YYYY-MM-DD ou null",
      "tipo": "processual|contratual|administrativo"
    }
  ],
  "risco_estimado": "baixo|medio|alto",
  "risco_justificativa": "string",
  "resumo_executivo": "string (150-200 palavras, em português, narrativa clara para o sócio)"
}

DOCUMENTO:
${extractedText.substring(0, 15000)}`
        }]
      })
    })
    
    const openaiData = await openaiResponse.json()
    const rawContent = openaiData.choices[0].message.content.trim()
    
    // Limpar JSON se vier com markdown
    const jsonContent = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const extractedData = JSON.parse(jsonContent)
    
    // 6. Salvar resultado
    await supabase.from('documents').update({
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      extracted_text: extractedText.substring(0, 50000),
      extracted_data: extractedData
    }).eq('id', document_id)
    
    // 7. Criar prazos no DB se identificados
    if (extractedData.prazos_identificados?.length > 0) {
      const prazosInsert = extractedData.prazos_identificados
        .filter((p: any) => p.data)
        .map((p: any) => ({
          firm_id: doc.firm_id,
          project_id: doc.project_id,
          document_id: doc.id,
          descricao: p.descricao,
          data_prazo: p.data,
          tipo: p.tipo || 'processual'
        }))
      
      if (prazosInsert.length > 0) {
        await supabase.from('prazos').insert(prazosInsert)
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    await supabase.from('documents').update({
      processing_status: 'error',
      processing_error: error.message
    }).eq('id', document_id)
    
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

**Deploy da Edge Function:**
```bash
supabase functions deploy process-document --project-ref fbgqzouxbagmmlzibyhl

# Setar secrets
supabase secrets set OPENAI_API_KEY=[REDACTED_OPENAI_KEY] \
  --project-ref fbgqzouxbagmmlzibyhl
```

---

## Stack Frontend — o que muda

### Variáveis de ambiente (.env.local e Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://fbgqzouxbagmmlzibyhl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_t8YIRaJgl-dUZkYgLwXM2w_HCyLqeqz
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s
OPENAI_API_KEY=[REDACTED_OPENAI_KEY]
```

### Fluxo de upload novo (Next.js API route /api/upload)

```typescript
// /api/upload/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const formData = await req.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string
  const firmId = formData.get('firm_id') as string
  
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'docx' : 'txt'
  const storagePath = `firms/${firmId}/projects/${projectId}/${Date.now()}-${file.name}`
  
  // Upload para Storage
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false
    })
  
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }
  
  // Criar registro no DB
  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      firm_id: firmId,
      project_id: projectId,
      name: file.name,
      storage_path: storagePath,
      file_type: fileType,
      file_size_bytes: file.size,
      processing_status: 'pending'
    })
    .select()
    .single()
  
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  
  // Disparar Edge Function assincronamente (não aguarda resultado)
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`
  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ document_id: doc.id })
  }).catch(console.error) // fire-and-forget
  
  // Retorna imediatamente com o doc_id
  return NextResponse.json({ 
    success: true, 
    document_id: doc.id,
    project_id: projectId
  })
}
```

---

## UI — Estrutura de Páginas

### Navegação principal (sidebar)
```
Dashboard (/)
Clientes (/clients)
  └── Detalhe cliente (/clients/[id])
      └── Projeto (/projects/[id])
Prazos (/prazos)
Peças (/pecas) — documentos gerados por IA
```

### Dashboard (/)
- Cards: Total processos ativos | Documentos pendentes | Prazos esta semana | Prazos vencidos
- Pipeline visual: Análise | Contestação | Recurso | Execução | Encerrado (contagem por fase)
- Tabela: Prazos próximos (próximos 7 dias úteis) — com link para o processo

### Clientes (/clients)
- Grid de cards de clientes
- Cada card: nome, número de processos ativos, documentos pendentes de análise
- Botão: + Novo Cliente
- Click no card → /clients/[id]

### Detalhe do Cliente (/clients/[id])
- Header: nome do cliente, CNPJ, email
- Lista de projetos (processos)
- Cada projeto: nome, fase, número de documentos, próximo prazo
- Botão: + Novo Processo

### Hub do Processo (/projects/[id])
Abas: **Documentos** | **Análise** | **Prazos** | **Peças** | **Chat**

**Aba Documentos (DEFAULT ao abrir):**
- Upload area: drag-and-drop ou click (aceita PDF, DOCX, TXT, múltiplos arquivos)
- Lista de documentos com status em tempo real (Supabase Realtime):
  - ⏳ Pendente
  - 🔄 Processando... (spinner)
  - ✅ Concluído
  - ❌ Erro — [mensagem]
- Click num documento → expande/abre análise desse documento

**Aba Análise:**
- Se não há documentos processados: empty state com CTA para upload
- Se há documentos: mostrar extracted_data do(s) documento(s)
- Layout 2 colunas:
  - Esquerda: Resumo Executivo + Partes + Causa de Pedir + Teses
  - Direita: Pedidos (numerados) + Fatos Relevantes + Risco + Tutela Antecipada
- Se múltiplos docs: dropdown para selecionar qual documento visualizar

**Aba Prazos:**
- Tabela: Descrição | Data | Tipo | Dias Úteis Restantes | Status
- Badge colorido: verde >7 d.u., âmbar ≤7, vermelho ≤3, VENCIDO
- Botão: + Adicionar Prazo Manual

**Aba Peças:**
- Botões de geração: [Gerar Contestação] [Gerar Recurso] [Gerar Petição]
- Histórico de peças geradas (lista com data, tipo, versão)
- Click → modal com editor de texto (readonly v1, editável v2)

**Aba Chat:**
- Chat com IA contextualizado nos documentos do processo
- System prompt inclui todos os extracted_data do projeto
- Interface simples: input + histórico de mensagens

---

## Lógica de dias úteis (reutilizar da v3)

```typescript
const FERIADOS_NACIONAIS = [
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'
]

function isFeriadoNacional(date: Date): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return FERIADOS_NACIONAIS.includes(mmdd)
}

function isDiaUtil(date: Date): boolean {
  const dow = date.getDay()
  return dow !== 0 && dow !== 6 && !isFeriadoNacional(date)
}

function diasUteisRestantes(dataPrazo: Date): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dataPrazo)
  prazo.setHours(0, 0, 0, 0)
  
  if (prazo < hoje) return -1 // vencido
  
  let count = 0
  const cursor = new Date(hoje)
  while (cursor <= prazo) {
    if (isDiaUtil(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}
```

---

## Realtime para status de documentos

```typescript
// Hook: useDocumentStatus(projectId)
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useDocuments(projectId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  
  useEffect(() => {
    // Busca inicial
    supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocuments(data || []))
    
    // Subscribe a mudanças em tempo real
    const channel = supabase
      .channel(`documents:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => [payload.new as Document, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(d => 
            d.id === payload.new.id ? payload.new as Document : d
          ))
        }
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [projectId])
  
  return documents
}
```

---

## Auth e seed de demo

Login demo: `cristiano@bluz.com.br` / `Notorious2024!`
Firm ID: `1f430c10-550a-4267-9193-e03c831fc394`

Após rebuild, criar no Supabase:
1. Confirmar que usuário existe em auth.users
2. Inserir em firm_users: `(firm_id: 1f430c10..., user_id: <uuid do cristiano>)`
3. Criar cliente demo: "TechInova Ltda" vinculado à B/Luz
4. Criar 1 processo demo vinculado à TechInova (sem documentos — para testar o upload ao vivo)

---

## Checklist de entrega (tudo deve passar antes de considerar done)

- [ ] `npm run build` — zero erros TypeScript
- [ ] Login funciona (cristiano@bluz.com.br)
- [ ] Dashboard carrega com dados (mesmo que vazios)
- [ ] Upload de PDF funciona (drag-and-drop + click)
- [ ] Status muda de "pending" → "processing" → "completed" em tempo real sem reload
- [ ] Dados extraídos aparecem na aba Análise após processamento
- [ ] Prazos identificados aparecem automaticamente na aba Prazos
- [ ] Chat responde com contexto do processo
- [ ] Geração de contestação funciona (botão na aba Peças)
- [ ] Deploy no Vercel sem erros
- [ ] Edge Function deployada e funcionando no Supabase

---

## Credenciais completas

```
GitHub: carlosevg100
GitHub Token: [REDACTED_GITHUB_TOKEN]
Repo: https://github.com/carlosevg100/notorious-ai

Vercel Token: [REDACTED_VERCEL_TOKEN]
Vercel Account: carlosevg100-9887

Supabase URL: https://fbgqzouxbagmmlzibyhl.supabase.co
Supabase Anon Key: sb_publishable_t8YIRaJgl-dUZkYgLwXM2w_HCyLqeqz
Supabase Service Role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s

OpenAI: [REDACTED_OPENAI_KEY]
```

---

## Ordem de execução

1. `git clone https://github.com/carlosevg100/notorious-ai` no diretório de trabalho
2. Aplicar novo schema SQL no Supabase (via API ou dashboard)
3. Criar bucket `documents` no Supabase Storage
4. Rebuild completo do Next.js app (limpar /app, reescrever do zero com nova arquitetura)
5. Criar `supabase/functions/process-document/index.ts`
6. Instalar Supabase CLI, deploy da Edge Function
7. Setar secrets da Edge Function
8. `npm run build` — corrigir todos os erros
9. `git add -A && git commit -m "v4: bulletproof architecture — edge functions, realtime, storage"` 
10. `git push` → Vercel auto-deploy
11. Verificar deploy em https://notorious-ai.vercel.app
12. Testar fluxo completo: login → criar projeto → upload PDF → aguardar extração → verificar análise
13. Reportar com evidências: URL + commit hash + screenshot ou log de extração bem-sucedida

---

Deadline: 4 horas a partir de agora.
Prioridade absoluta: extração funcional com PDF real.
