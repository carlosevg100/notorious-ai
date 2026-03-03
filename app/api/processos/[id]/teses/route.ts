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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const { data: processo, error: pErr } = await supabaseAdmin
    .from('processos')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (pErr || !processo) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Você é um advogado defensor brasileiro especialista em contestações. Analise o processo abaixo e sugira as melhores TESES DE DEFESA (polo passivo).

PROCESSO: ${processo.numero_processo || 'Sem número'}
ASSUNTO: ${processo.assunto || ''}
CLASSE: ${processo.classe_processual || ''}
VALOR: R$ ${processo.valor_causa?.toLocaleString('pt-BR') || '0'}
FATOS ALEGADOS: ${processo.fatos_resumidos || ''}
FUNDAMENTOS DO AUTOR: ${(processo.fundamentos_juridicos as string[])?.join('; ') || ''}
PEDIDOS: ${(processo.pedidos as string[])?.join('; ') || ''}
TUTELA URGÊNCIA: ${processo.tutela_urgencia ? 'Sim' : 'Não'}

Sugira de 5 a 8 teses de defesa em JSON (apenas o array, sem markdown):
[
  {
    "id": "tese_1",
    "titulo": "Nome da tese",
    "descricao": "Explicação detalhada em 2-3 frases",
    "fundamento_legal": "Art. X do CC/CDC/CLT etc.",
    "probabilidade": "alta|media|baixa"
  }
]

Teses comuns: ilegitimidade passiva, prescrição/decadência, ausência de nexo causal, ausência de danos comprovados, culpa exclusiva do autor, excludente de responsabilidade, impugnação ao valor da causa, inépcia da inicial.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      messages: [
        { role: 'system', content: 'Você é um advogado defensor especialista em direito processual civil brasileiro. Responda APENAS com o JSON solicitado.' },
        { role: 'user', content: prompt },
      ],
    })

    const rawJson = completion.choices[0]?.message?.content || '[]'
    const cleaned = rawJson.replace(/```json|```/g, '').trim()
    const teses = JSON.parse(cleaned)
    return NextResponse.json({ teses })
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar teses' }, { status: 500 })
  }
}
