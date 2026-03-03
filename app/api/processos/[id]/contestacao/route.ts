import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

async function getFirmId(): Promise<{ firmId: string | null; error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { firmId: null, error: 'Unauthorized' }
  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return { firmId: null, error: 'Profile not found' }
  return { firmId: profile.firm_id }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()
  const { teses, jurisprudencias } = body as {
    teses: Array<{ id: string; titulo: string; descricao: string; selecionada: boolean }>
    jurisprudencias: Array<{ tese_id: string; tribunal: string; numero_processo: string; ementa: string; aprovada: boolean }>
  }

  // Load processo
  const { data: processo, error: pErr } = await supabaseAdmin
    .from('processos')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (pErr || !processo) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const tesesSelecionadas = teses.filter(t => t.selecionada)
  const jurisAprovadas = jurisprudencias.filter(j => j.aprovada)

  const tesesText = tesesSelecionadas.map(t => `- ${t.titulo}: ${t.descricao}`).join('\n')
  const jurisText = jurisAprovadas.map(j =>
    `• ${j.tribunal} — ${j.numero_processo}\n  ${j.ementa.slice(0, 200)}`
  ).join('\n')

  const prompt = `Você é um advogado especialista em defesa judicial (polo passivo) no direito brasileiro.
Redija uma CONTESTAÇÃO completa e fundamentada para o seguinte processo:

PROCESSO: ${processo.numero_processo || 'Não identificado'}
TRIBUNAL: ${processo.tribunal || ''} — ${processo.comarca || ''} — ${processo.vara || ''}
AUTOR (Polo Ativo): ${(processo.polo_ativo as any)?.nome || ''}
RÉU (Polo Passivo): ${(processo.polo_passivo as any)?.nome || ''}
VALOR DA CAUSA: R$ ${processo.valor_causa?.toLocaleString('pt-BR') || '0'}
PEDIDOS DO AUTOR: ${(processo.pedidos as string[])?.join('; ') || ''}
FATOS ALEGADOS: ${processo.fatos_resumidos || ''}
FUNDAMENTOS JURÍDICOS DO AUTOR: ${(processo.fundamentos_juridicos as string[])?.join('; ') || ''}

TESES DE DEFESA SELECIONADAS:
${tesesText}

JURISPRUDÊNCIA APROVADA:
${jurisText}

Redija a contestação completa com:
1. Preâmbulo (endereçamento ao juízo)
2. DOS FATOS (narrativa da defesa)
3. DO DIREITO (cada tese numerada com embasamento legal)
4. DA JURISPRUDÊNCIA (citando as decisões aprovadas)
5. DOS PEDIDOS (pedido de improcedência total, honorários, etc.)
6. ENCERRAMENTO

Use linguagem técnica jurídica formal. O réu é representado pelo escritório B/Luz Advogados.`

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let contestacao = ''
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 3000,
      messages: [
        { role: 'system', content: 'Você é um advogado brasileiro especialista em contestações judiciais. Escreva em português formal jurídico.' },
        { role: 'user', content: prompt },
      ],
    })
    contestacao = completion.choices[0]?.message?.content || ''
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar contestação' }, { status: 500 })
  }

  // Save contestação and update fase
  await supabaseAdmin
    .from('processos')
    .update({
      contestacao_gerada: contestacao,
      teses_defesa: teses,
      fase: 'contestacao_revisao',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('firm_id', firmId)

  return NextResponse.json({ contestacao })
}
