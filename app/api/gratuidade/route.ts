import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nome, cpf, observacoes } = await request.json()
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  const cpfStr = cpf ? ` CPF ${cpf}` : ''

  // Step 1: Try Receita Federal (usually blocked — handled gracefully)
  let externalData = ''
  if (cpf) {
    try {
      const rf = await fetch(
        `https://www.receita.fazenda.gov.br/ServicosOnline/ConsultarSituacaoCPF?CPF=${cpf.replace(/\D/g, '')}`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (rf.ok) externalData += 'Receita Federal consultada. '
    } catch {
      // RF blocked — expected
    }
  }

  // Step 2: GPT-4o analysis
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Analise o pedido de gratuidade de justiça para "${nome}"${cpfStr} no contexto do sistema judiciário brasileiro.

${observacoes ? `Observações sobre o caso: ${observacoes}` : ''}
${externalData ? `Dados externos: ${externalData}` : ''}

Com base em padrões de litigância predatória no Brasil onde beneficiários de gratuidade frequentemente possuem patrimônio não declarado, indicadores de irregularidade em pedidos de gratuidade (nome social vs razão social, litígios em massa pelo mesmo CPF, outros processos com mesma parte), e critérios da jurisprudência do STJ e TRTs sobre gratuidade, retorne JSON:
{
  "irregular": boolean,
  "confidence": "alto|medio|baixo",
  "indicators": ["string (indicador específico de irregularidade ou legitimidade)"],
  "recommendation": "string (recomendação — contestar ou aceitar o benefício)",
  "suggested_argument": "string (argumento jurídico completo para contestar o benefício, se aplicável, com referência ao art. 5º, LXXIV, CF, e art. 98 do CPC)",
  "risk_assessment": "string (avaliação geral do risco de irregularidade)"
}
Retorne APENAS JSON válido.`
    }],
    max_tokens: 1000
  })

  const content = response.choices[0].message.content
  if (!content) return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 500 })

  const analysis = JSON.parse(content)

  // Save to database
  try {
    await supabaseAdmin.from('gratuidade_analyses').insert({
      firm_id: profile?.firm_id,
      nome,
      cpf: cpf || null,
      result: analysis
    })
  } catch {
    // Table may not exist yet — continue without saving
  }

  return NextResponse.json({ pessoa: { nome, cpf }, analysis })
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile?.firm_id) return NextResponse.json([])

  try {
    const { data } = await supabaseAdmin
      .from('gratuidade_analyses')
      .select('*')
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}
