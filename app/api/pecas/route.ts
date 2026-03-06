import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedFirmId, isAuthError } from '@/lib/get-firm-id'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

const TIPO_PROMPTS: Record<string, string> = {
  contestacao: `Gere uma CONTESTAÇÃO completa em português jurídico brasileiro.
Inclua: qualificação das partes, preliminares (se aplicável), mérito, pedidos, requerimentos finais.
Use linguagem formal jurídica com fundamentação legal (CPC, CC, legislação específica).`,
  recurso: `Gere um RECURSO DE APELAÇÃO completo em português jurídico brasileiro.
Inclua: tempestividade, preparo, razões recursais, pedido de reforma.`,
  peticao: `Gere uma PETIÇÃO INICIAL completa em português jurídico brasileiro.
Inclua: endereçamento, qualificação, fatos, direito, pedidos, valor da causa, provas.`,
}

export async function POST(req: NextRequest) {
  const authCtx = await getAuthenticatedFirmId(req)
  if (isAuthError(authCtx)) return authCtx

  const { project_id, tipo } = await req.json()
  const firm_id = authCtx.firm_id
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get all extracted data from project documents
  const { data: docs } = await supabase
    .from('documents')
    .select('name, extracted_data')
    .eq('project_id', project_id)
    .eq('processing_status', 'completed')

  const context = (docs || [])
    .map(d => `Documento: ${d.name}\n${JSON.stringify(d.extracted_data, null, 2)}`)
    .join('\n\n---\n\n')

  // Get existing version count
  const { count } = await supabase
    .from('pecas')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project_id)
    .eq('tipo', tipo)

  const versao = (count || 0) + 1

  const prompt = TIPO_PROMPTS[tipo] || `Gere uma peça jurídica do tipo "${tipo}" em português jurídico brasileiro.`

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Com base nas informações extraídas dos documentos do processo, gere a peça:\n\n${context || 'Sem dados extraídos.'}` },
      ],
    }),
  })

  const openaiData = await openaiRes.json()
  const conteudo = openaiData.choices?.[0]?.message?.content || 'Erro ao gerar peça.'

  const { data: peca } = await supabase
    .from('pecas')
    .insert({
      firm_id,
      project_id,
      tipo,
      conteudo,
      modelo_ia: 'gpt-4o-mini',
      versao,
    })
    .select()
    .single()

  return NextResponse.json({ success: true, peca })
}
