import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { project_id, message, history } = await req.json()

  // Get all processed documents for this project
  const { data: docs } = await supabase
    .from('documents')
    .select('name, extracted_data, extracted_text')
    .eq('project_id', project_id)
    .eq('processing_status', 'completed')

  const docContext = docs?.map(d =>
    `=== ${d.name} ===\n${JSON.stringify(d.extracted_data, null, 2)}`
  ).join('\n\n') || 'Nenhum documento processado ainda.'

  const systemPrompt = `Você é um assistente jurídico especializado em direito brasileiro, auxiliando advogados da B/Luz Advogados.

DOCUMENTOS DO PROCESSO:
${docContext}

Responda perguntas sobre o processo com base nos documentos acima. Use linguagem técnica jurídica quando apropriado.
Se não houver informação suficiente nos documentos, diga isso claramente.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []),
    { role: 'user', content: message }
  ]

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages })
  })

  const openaiData = await openaiRes.json()
  const reply = openaiData.choices?.[0]?.message?.content || 'Erro ao processar resposta'

  // Save messages (best effort)
  try {
    await supabase.from('chat_messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: reply }
    ])
  } catch {}

  return NextResponse.json({ reply })
}

export async function GET(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) return NextResponse.json([])

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  return NextResponse.json(data || [])
}
