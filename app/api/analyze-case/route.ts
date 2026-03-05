import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

export interface DocumentoNecessario {
  documento: string
  motivo: string
  prioridade: 'alta' | 'media' | 'baixa'
}

export interface CaseAnalysis {
  resumo_demanda: string
  fundamentos_autor: string[]
  evidencias_apresentadas: Array<{
    documento: string
    descricao: string
    relevancia: string
  }>
  valores_envolvidos: {
    pedido_principal: string
    danos_morais: string
    total: string
  }
  datas_chave: Array<{
    data: string
    evento: string
  }>
  pontos_fortes_autor: string[]
  pontos_fracos_autor: string[]
  risco_preliminar: 'baixo' | 'medio' | 'alto'
  documentos_necessarios_cliente: DocumentoNecessario[]
}

interface SupportingDoc {
  fileName: string
  category: string
  extracted: Record<string, unknown>
}

interface AnalyzeCasePayload {
  project_id: string
  firm_id: string
  peticao_extracted: Record<string, unknown>
  supporting_docs: SupportingDoc[]
}

function buildPrompt(peticao: Record<string, unknown>, docs: SupportingDoc[]): string {
  const docsSection = docs.length > 0
    ? docs.map(d => `\n[${d.category} — ${d.fileName}]\n${JSON.stringify(d.extracted, null, 2)}`).join('\n')
    : '(nenhum documento de suporte)'

  return `Você é um advogado sênior brasileiro especializado em direito processual civil. Analise os documentos da parte autora abaixo e produza uma análise executiva completa para orientar a defesa do réu.

PETIÇÃO INICIAL EXTRAÍDA:
${JSON.stringify(peticao, null, 2)}

DOCUMENTOS DE SUPORTE DA PARTE AUTORA:
${docsSection}

Com base em TODOS os documentos acima, retorne APENAS um JSON válido (sem markdown, sem comentários) com a seguinte estrutura EXATA:
{
  "resumo_demanda": "Parágrafo objetivo: O autor [nome] move ação de [tipo] contra [réu] pleiteando [pedidos]. Inclua o contexto fático principal.",
  "fundamentos_autor": [
    "Fundamento jurídico 1 alegado pelo autor",
    "Fundamento jurídico 2 alegado pelo autor"
  ],
  "evidencias_apresentadas": [
    {
      "documento": "nome do arquivo ou tipo do documento",
      "descricao": "o que o documento contém",
      "relevancia": "como o autor pretende usar esse documento para embasar seus pedidos"
    }
  ],
  "valores_envolvidos": {
    "pedido_principal": "R$ X,XX ou 'Não identificado'",
    "danos_morais": "R$ X,XX ou 'Não requerido'",
    "total": "R$ X,XX ou 'Não identificado'"
  },
  "datas_chave": [
    { "data": "DD/MM/AAAA ou período", "evento": "descrição do evento" }
  ],
  "pontos_fortes_autor": [
    "Ponto forte identificado com base nos documentos apresentados"
  ],
  "pontos_fracos_autor": [
    "Fraqueza ou lacuna identificada — documento não apresentado, contradição, etc."
  ],
  "risco_preliminar": "baixo",
  "documentos_necessarios_cliente": [
    {
      "documento": "nome claro do documento a solicitar ao cliente",
      "motivo": "por que precisamos desse documento para a defesa",
      "prioridade": "alta"
    }
  ]
}

REGRAS:
- risco_preliminar deve ser exatamente: "baixo", "medio" ou "alto"
- prioridade deve ser exatamente: "alta", "media" ou "baixa"
- documentos_necessarios_cliente: liste entre 3 e 8 documentos específicos e relevantes
- Seja técnico, objetivo e orientado à defesa do réu
- Identifique documentos que o autor NÃO apresentou mas mencionou, e que o réu pode ter
`
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeCasePayload = await req.json()
    const { project_id, firm_id, peticao_extracted, supporting_docs } = body

    if (!project_id || !firm_id) {
      return NextResponse.json({ error: 'project_id e firm_id são obrigatórios' }, { status: 400 })
    }

    const prompt = buildPrompt(peticao_extracted, supporting_docs || [])

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Você é um advogado sênior brasileiro especializado em análise processual. Retorne APENAS JSON válido, sem markdown, sem comentários.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('[analyze-case] OpenAI error:', err)
      return NextResponse.json({ error: 'Falha na análise AI' }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'
    const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let analysis: CaseAnalysis
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('[analyze-case] JSON parse error:', cleaned.slice(0, 400))
      return NextResponse.json({ error: 'Falha ao processar resposta da IA' }, { status: 500 })
    }

    // Persist to case_strategies with status='analise_inicial'
    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    await adminSupabase.from('case_strategies').insert({
      project_id,
      firm_id,
      tese_principal: analysis.resumo_demanda || 'Análise inicial pendente',
      teses_subsidiarias: analysis.fundamentos_autor || [],
      jurisprudencia_favoravel: [],
      jurisprudencia_desfavoravel: [],
      risco_estimado: analysis.risco_preliminar || 'medio',
      valor_risco_estimado: null,
      recomendacao: 'Análise inicial — aguardando documentos do cliente',
      draft_peca: JSON.stringify(analysis),
      draft_tipo: 'analise_inicial',
      status: 'analise_inicial',
    })

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    console.error('[analyze-case] error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
