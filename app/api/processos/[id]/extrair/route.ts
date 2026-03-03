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

  let textContent = ''

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    if (file.name.endsWith('.pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const parsed = await pdfParse(buffer)
        textContent = parsed.text
      } catch {
        return NextResponse.json({ error: 'Erro ao processar PDF' }, { status: 400 })
      }
    } else if (file.name.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        textContent = result.value
      } catch {
        return NextResponse.json({ error: 'Erro ao processar DOCX' }, { status: 400 })
      }
    } else {
      textContent = buffer.toString('utf-8')
    }
  } else {
    const body = await request.json()
    textContent = body.text || ''
  }

  if (!textContent.trim()) {
    return NextResponse.json({ error: 'Nenhum texto extraído do documento' }, { status: 400 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Extraia do documento jurídico abaixo todos os dados do processo em JSON puro (sem markdown):
{
  "numero_processo": "string (formato CNJ ex: 1234567-89.2024.8.26.0100)",
  "tribunal": "string",
  "comarca": "string",
  "vara": "string",
  "juiz": "string",
  "classe_processual": "string",
  "assunto": "string",
  "valor_causa": "number (apenas número, sem R$)",
  "polo_ativo": { "nome": "string", "cpf_cnpj": "string", "advogado": "string", "oab": "string" },
  "polo_passivo": { "nome": "string", "cpf_cnpj": "string" },
  "pedidos": ["string"],
  "tutela_urgencia": "boolean",
  "fatos_resumidos": "string (max 200 palavras)",
  "causa_pedir": "string",
  "fundamentos_juridicos": ["string"],
  "documentos_mencionados": ["string"],
  "prazo_contestacao_dias": "number (padrão 15 se não especificado)",
  "resumo_executivo": "string (max 150 palavras, linguagem clara para o cliente)"
}

DOCUMENTO:
${textContent.slice(0, 8000)}`

  let extracted: Record<string, unknown> = {}
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: 'Você é um assistente jurídico especializado em direito processual civil brasileiro. Responda APENAS com o JSON solicitado, sem markdown.' },
        { role: 'user', content: prompt },
      ],
    })

    const rawJson = completion.choices[0]?.message?.content || '{}'
    const cleaned = rawJson.replace(/```json|```/g, '').trim()
    extracted = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Erro ao processar com IA' }, { status: 500 })
  }

  // Calculate prazo_contestacao date from days
  const prazoDias = Number(extracted.prazo_contestacao_dias || 15)
  const prazoDate = new Date()
  prazoDate.setDate(prazoDate.getDate() + prazoDias)
  const prazoIso = prazoDate.toISOString().split('T')[0]

  // Update processo if id != 'temp'
  if (id !== 'temp') {
    await supabaseAdmin
      .from('processos')
      .update({
        numero_processo: extracted.numero_processo,
        tribunal: extracted.tribunal,
        comarca: extracted.comarca,
        vara: extracted.vara,
        juiz: extracted.juiz,
        classe_processual: extracted.classe_processual,
        assunto: extracted.assunto,
        valor_causa: extracted.valor_causa ? Number(extracted.valor_causa) : null,
        polo_ativo: extracted.polo_ativo || {},
        polo_passivo: extracted.polo_passivo || {},
        pedidos: extracted.pedidos || [],
        tutela_urgencia: extracted.tutela_urgencia || false,
        fatos_resumidos: extracted.fatos_resumidos,
        causa_pedir: extracted.causa_pedir,
        fundamentos_juridicos: extracted.fundamentos_juridicos || [],
        documentos_mencionados: extracted.documentos_mencionados || [],
        resumo_executivo: extracted.resumo_executivo,
        prazo_contestacao: prazoIso,
        fase: 'extracao',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('firm_id', firmId)
  }

  return NextResponse.json({ ...extracted, prazo_contestacao: prazoIso })
}
