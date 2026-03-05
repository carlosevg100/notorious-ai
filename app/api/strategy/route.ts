import { NextRequest, NextResponse } from 'next/server'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

interface JurisprudenciaItem {
  tribunal: string
  numero: string
  data: string
  ementa: string
  relevancia?: string
  risco?: string
}

interface ResearchResults {
  precedentes_favoraveis: JurisprudenciaItem[]
  precedentes_desfavoraveis: JurisprudenciaItem[]
  probabilidade_exito: number
  fundamentacao: string
}

interface CaseContext {
  tipo_acao?: string | null
  autor?: string | null
  reu?: string | null
  vara?: string | null
  comarca?: string | null
  valor_causa?: string | null
  pedidos?: string | null
  area?: string | null
  numero_processo?: string | null
  nome_processo?: string | null
  supporting_summaries?: string[]
}

interface StrategyPayload {
  project_id: string
  firm_id: string
  case_context: CaseContext
  research_results: ResearchResults
  lawyer_feedback?: string
}

interface StrategyResult {
  tese_principal: string
  teses_subsidiarias: string[]
  jurisprudencia_favoravel: JurisprudenciaItem[]
  jurisprudencia_desfavoravel: JurisprudenciaItem[]
  probabilidade_exito: number
  risco_estimado: string
  valor_risco_estimado: string
  recomendacao: string
  draft: string
}

function buildStrategyPrompt(payload: StrategyPayload): string {
  const { case_context: ctx, research_results: rr, lawyer_feedback } = payload

  const favoraveisText = rr.precedentes_favoraveis.map(p =>
    `- ${p.tribunal} | ${p.numero} (${p.data}): ${p.ementa}${p.relevancia ? ` — Relevância: ${p.relevancia}` : ''}`
  ).join('\n')

  const desfavoraveisText = rr.precedentes_desfavoraveis.map(p =>
    `- ${p.tribunal} | ${p.numero} (${p.data}): ${p.ementa}${p.risco ? ` — Risco: ${p.risco}` : ''}`
  ).join('\n')

  const supportingDocs = ctx.supporting_summaries?.length
    ? `\n\nDOCUMENTOS DE SUPORTE:\n${ctx.supporting_summaries.join('\n')}`
    : ''

  const feedbackSection = lawyer_feedback
    ? `\n\nINSTRUÇÕES ESPECÍFICAS DO ADVOGADO:\n${lawyer_feedback}\n(Incorpore estas instruções na estratégia e na minuta.)`
    : ''

  return `Você é um advogado sênior brasileiro especializado em direito processual civil, com 20 anos de experiência em contestações e defesas em tribunais brasileiros.

CASO PARA ANÁLISE:
- Tipo de Ação: ${ctx.tipo_acao || 'Não identificado'}
- Área: ${ctx.area || 'Cível'}
- Autor: ${ctx.autor || 'Não identificado'}
- Réu: ${ctx.reu || 'Não identificado'}
- Número do Processo: ${ctx.numero_processo || 'Pendente'}
- Vara: ${ctx.vara || 'Não informada'}
- Comarca: ${ctx.comarca || 'Não informada'}
- Valor da Causa: ${ctx.valor_causa || 'Não informado'}
- Pedidos: ${ctx.pedidos || 'Não identificados'}${supportingDocs}

JURISPRUDÊNCIA FAVORÁVEL À DEFESA:
${favoraveisText || '(nenhuma identificada)'}

JURISPRUDÊNCIA DESFAVORÁVEL:
${desfavoraveisText || '(nenhuma identificada)'}

PROBABILIDADE DE ÊXITO (pesquisa): ${rr.probabilidade_exito}%
FUNDAMENTAÇÃO DA PESQUISA: ${rr.fundamentacao}${feedbackSection}

Retorne APENAS um JSON válido (sem markdown, sem código extra) com a seguinte estrutura exata:
{
  "tese_principal": "descrição clara e técnica da principal tese de defesa (max 400 chars)",
  "teses_subsidiarias": ["tese subsidiária 1", "tese subsidiária 2", "tese subsidiária 3"],
  "jurisprudencia_favoravel": [
    {"tribunal": "STJ", "numero": "REsp 000/0000", "data": "DD/MM/AAAA", "ementa": "ementa", "relevancia": "relevância para o caso"}
  ],
  "jurisprudencia_desfavoravel": [
    {"tribunal": "STJ", "numero": "REsp 000/0000", "data": "DD/MM/AAAA", "ementa": "ementa", "risco": "risco que representa"}
  ],
  "probabilidade_exito": 65,
  "risco_estimado": "baixo|medio|alto",
  "valor_risco_estimado": "estimativa do valor em risco (ex: R$ 50.000,00)",
  "recomendacao": "Contestar|Propor Acordo|Exceção de Incompetência|Contestar com Acordo Secundário",
  "draft": "texto completo da minuta da contestação em formato jurídico brasileiro"
}

REQUISITOS PARA O DRAFT (campo "draft"):
- Deve ser uma contestação COMPLETA, formal e profissional
- Iniciar com: EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA [VARA] DA COMARCA DE [COMARCA]
- Incluir: qualificação do contestante, preliminares (se aplicável), mérito, jurisprudência citada com número dos acórdãos, pedido final, local e data
- Usar numeração (I, II, III para seções; 1, 2, 3 para subseções)
- Citar os precedentes jurisprudenciais encontrados
- Linguagem jurídica formal brasileira
- Tamanho: mínimo 800 palavras`
}

export async function POST(req: NextRequest) {
  try {
    const body: StrategyPayload = await req.json()
    const { project_id, firm_id, case_context, research_results, lawyer_feedback } = body

    if (!project_id || !firm_id) {
      return NextResponse.json({ error: 'project_id e firm_id são obrigatórios' }, { status: 400 })
    }

    const prompt = buildStrategyPrompt({ project_id, firm_id, case_context, research_results, lawyer_feedback })

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um advogado sênior brasileiro especializado em contestações e estratégia processual. Retorne APENAS JSON válido, sem markdown.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('OpenAI strategy error:', err)
      return NextResponse.json({ error: 'Falha na geração de estratégia' }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'

    // Clean and parse
    const cleaned = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()

    let strategy: StrategyResult
    try {
      strategy = JSON.parse(cleaned)
    } catch {
      console.error('Strategy parse error:', cleaned.slice(0, 500))
      return NextResponse.json({ error: 'Falha ao processar resposta da IA' }, { status: 500 })
    }

    // Merge research jurisprudência if strategy didn't include enough
    if (!strategy.jurisprudencia_favoravel?.length && research_results.precedentes_favoraveis?.length) {
      strategy.jurisprudencia_favoravel = research_results.precedentes_favoraveis
    }
    if (!strategy.jurisprudencia_desfavoravel?.length && research_results.precedentes_desfavoraveis?.length) {
      strategy.jurisprudencia_desfavoravel = research_results.precedentes_desfavoraveis
    }

    return NextResponse.json({
      success: true,
      strategy,
    })
  } catch (err) {
    console.error('strategy route error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
