export const maxDuration = 10
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const messages: Array<{ role: string; content: string }> = body.messages || []
  const context: string = body.context || ''

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `Você é um assistente jurídico especializado em direito processual civil e trabalhista brasileiro. Responda de forma clara, objetiva e em português brasileiro.${context ? `\n\nContexto do processo:\n${context}` : ''}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
    })
    const content = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.'
    return NextResponse.json({ content })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Erro ao chamar IA', content: 'Erro ao conectar com a IA.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json([])
}
