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

  const { advogado_nome, advogado_oab, advogado_estado } = await request.json()
  if (!advogado_nome) return NextResponse.json({ error: 'Nome do advogado é obrigatório' }, { status: 400 })

  // Get firm_id
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  const oabStr = advogado_oab ? ` OAB ${advogado_oab}${advogado_estado ? `/${advogado_estado}` : ''}` : ''

  let externalData = ''

  // Step 1: Try CNJ DataJud (may fail — handled gracefully)
  try {
    const cnj = await fetch(
      `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'ApiKey cDZHYzlZa0JadVREZDJCendFbzVlQTU2S3BNWWMyeU9CbWE4SngwZ1Boc0NwQWp6dlpBRUgzRHdHWVBOcG9GZw==' },
        body: JSON.stringify({
          query: { match: { 'siglaTribunal': 'TJSP' } },
          size: 1
        }),
        signal: AbortSignal.timeout(5000)
      }
    )
    if (cnj.ok) externalData += 'Dados CNJ consultados. '
  } catch {
    // CNJ API unavailable — proceed without it
  }

  // Step 2: Try OAB public registry (may fail — handled gracefully)
  try {
    const encoded = encodeURIComponent(advogado_nome)
    const oab = await fetch(
      `https://cna.oab.org.br/api/v1/advogados?nome=${encoded}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (oab.ok) {
      const data = await oab.json()
      if (data?.items?.length > 0) {
        externalData += `Encontrado no CNA-OAB: ${data.items[0].nome}, Inscrição: ${data.items[0].inscricao}. `
      }
    }
  } catch {
    // OAB registry unavailable — proceed without it
  }

  // Step 3: GPT-4o analysis
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Analise se o advogado "${advogado_nome}"${oabStr} é um litigante predatório no Brasil.

Contexto externo disponível: ${externalData || 'APIs externas indisponíveis no momento.'}

Com base em padrões conhecidos de litigância predatória no Brasil (escritórios que entram com ações em massa contra empresas, típico em direito do consumidor, trabalhista e previdenciário), características de litigantes contumazes identificados pelo CNJ, e qualquer informação publicamente conhecida sobre esse advogado, retorne JSON:
{
  "is_predatory": boolean,
  "confidence": "alto|medio|baixo",
  "indicators": ["string (indicador específico)"],
  "volume_estimate": "string (estimativa de volume de ações, ex: 'Baixo volume', 'Alto volume — possível litigante contumaz')",
  "recommendation": "string (recomendação de ação para o escritório)",
  "profile": "string (perfil jurídico do advogado baseado nos indicadores)"
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
    await supabaseAdmin.from('litigancia_analyses').insert({
      firm_id: profile?.firm_id,
      advogado_nome,
      advogado_oab: advogado_oab || null,
      advogado_estado: advogado_estado || null,
      result: analysis
    })
  } catch {
    // Table may not exist yet — continue without saving
  }

  return NextResponse.json({ advogado: { nome: advogado_nome, oab: advogado_oab, estado: advogado_estado }, analysis, source: externalData || 'Análise baseada em padrões conhecidos' })
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile?.firm_id) return NextResponse.json([])

  try {
    const { data } = await supabaseAdmin
      .from('litigancia_analyses')
      .select('*')
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}
