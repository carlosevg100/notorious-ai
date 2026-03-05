import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  const { project_id, message } = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get project context
  const { data: docs } = await supabase
    .from('documents')
    .select('name, extracted_data')
    .eq('project_id', project_id)
    .eq('processing_status', 'completed')

  const context = (docs || [])
    .map(d => `Documento: ${d.name}\n${JSON.stringify(d.extracted_data, null, 2)}`)
    .join('\n\n---\n\n')

  // Get chat history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('project_id', project_id)
    .order('created_at')
    .limit(20)

  // Save user message
  const { data: userMessage } = await supabase
    .from('chat_messages')
    .insert({ project_id, role: 'user', content: message })
    .select()
    .single()

  // Call OpenAI
  const openaiMessages = [
    {
      role: 'system' as const,
      content: `Você é um assistente jurídico especializado em direito brasileiro. Responda sempre em português do Brasil.
Você tem acesso aos seguintes documentos e suas análises do processo:

${context || 'Nenhum documento processado ainda.'}

Responda de forma clara, objetiva e fundamentada.`,
    },
    ...(history || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ]

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: openaiMessages, temperature: 0.3 }),
  })

  const openaiData = await openaiRes.json()
  const reply = openaiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta.'

  // Save assistant message
  const { data: assistantMessage } = await supabase
    .from('chat_messages')
    .insert({ project_id, role: 'assistant', content: reply })
    .select()
    .single()

  return NextResponse.json({ userMessage, assistantMessage })
}
