import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function GET(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  try {
    let query = supabase
      .from('pecas')
      .select('*')
      .eq('firm_id', FIRM_ID)
      .order('created_at', { ascending: false })

    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query
    if (error) return NextResponse.json([])
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()
  const { project_id, tipo, context } = body

  // Get project documents for context
  const { data: docs } = await supabase
    .from('documents')
    .select('extracted_data, name')
    .eq('project_id', project_id)
    .eq('processing_status', 'completed')

  const contextText = docs?.map(d =>
    `Documento: ${d.name}\n${JSON.stringify(d.extracted_data, null, 2)}`
  ).join('\n\n---\n\n') || ''

  const promptMap: Record<string, string> = {
    contestacao: 'Elabore uma contestação completa e bem fundamentada com base nos documentos do processo. Use linguagem jurídica formal, cite artigos do CPC e jurisprudência relevante.',
    recurso: 'Elabore um recurso de apelação fundamentado com base nos documentos do processo. Identifique os pontos de reforma e fundamente juridicamente.',
    peticao: 'Elabore uma petição processual adequada com base no contexto do processo. Use linguagem jurídica formal.'
  }

  const prompt = promptMap[tipo] || 'Elabore a peça jurídica solicitada com base nos documentos do processo.'

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um advogado experiente especializado em direito brasileiro. Elabore peças jurídicas completas e bem fundamentadas.' },
        { role: 'user', content: `${prompt}\n\nCONTEXTO DO PROCESSO:\n${contextText}\n\n${context || ''}` }
      ]
    })
  })

  const openaiData = await openaiRes.json()
  const conteudo = openaiData.choices?.[0]?.message?.content || 'Erro ao gerar peça'

  try {
    const { data: peca, error } = await supabase
      .from('pecas')
      .insert({ firm_id: FIRM_ID, project_id, tipo, conteudo, modelo_ia: 'gpt-4o-mini' })
      .select()
      .single()

    if (error) {
      // Table might not exist - return the content anyway
      return NextResponse.json({ conteudo, saved: false })
    }
    return NextResponse.json({ ...peca, saved: true })
  } catch {
    return NextResponse.json({ conteudo, saved: false })
  }
}
