import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

export const maxDuration = 60

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const formData = await req.formData()
  const file = formData.get('file') as File
  const clientId = formData.get('client_id') as string | null

  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'docx' : 'txt'
  const tempName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

  // 1. Create processo
  const { data: processo, error: processoError } = await supabase
    .from('processos')
    .insert({
      firm_id: FIRM_ID,
      client_id: clientId || null,
      fase: 'recebido',
      risco: 'medio',
      polo_ativo: { nome: tempName },
      polo_passivo: {},
      pedidos: [],
      fundamentos_juridicos: [],
      documentos_mencionados: [],
    })
    .select()
    .single()

  if (processoError || !processo) {
    return NextResponse.json({ error: processoError?.message || 'Failed to create processo' }, { status: 500 })
  }

  const processoId = processo.id

  // 2. Upload to Storage
  const bytes = await file.arrayBuffer()
  const storagePath = `firms/${FIRM_ID}/processos/${processoId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // 3. Create document record
  const { data: doc } = await supabase
    .from('documents')
    .insert({
      firm_id: FIRM_ID,
      project_id: processoId,
      name: file.name,
      file_path: storagePath,
      file_type: fileType,
      upload_status: 'uploaded',
      ai_status: 'processing',
      document_type: 'case',
    })
    .select()
    .single()

  // 4. Extract text synchronously (no fire-and-forget)
  try {
    const buffer = Buffer.from(bytes)
    let extractedText = ''

    if (fileType === 'txt') {
      extractedText = buffer.toString('utf-8')
    } else if (fileType === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      extractedText = result.text
    } else if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Não foi possível extrair texto. Verifique se o PDF não é uma imagem escaneada.')
    }

    // 5. Call OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de documentos jurídicos brasileiros. Retorne APENAS JSON válido, sem markdown, sem explicações.'
          },
          {
            role: 'user',
            content: `Analise este documento jurídico e extraia em JSON com EXATAMENTE esta estrutura:
{
  "tipo_documento": "string",
  "numero_processo": "string ou null",
  "vara": "string ou null",
  "comarca": "string ou null",
  "tribunal": "string ou null",
  "partes": {
    "autor": "string ou null",
    "reu": "string ou null",
    "advogado_autor": "string ou null",
    "advogado_reu": "string ou null"
  },
  "causa_pedir": "string",
  "pedidos": ["string"],
  "fatos_relevantes": ["string"],
  "teses_juridicas": ["string"],
  "tutela_antecipada": {"requerida": false, "fundamento": null},
  "valor_causa": "string ou null",
  "prazos_identificados": [{"descricao": "string", "data": "YYYY-MM-DD ou null", "tipo": "processual"}],
  "risco_estimado": "baixo|medio|alto",
  "risco_justificativa": "string",
  "resumo_executivo": "string com 150-200 palavras em português"
}
DOCUMENTO:\n${extractedText.substring(0, 15000)}`
          }
        ]
      })
    })

    const openaiData = await openaiRes.json()
    const raw = openaiData.choices?.[0]?.message?.content?.trim() || ''
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const ext = JSON.parse(cleaned)

    // 6. Update processo with extracted data
    await supabase.from('processos').update({
      numero_processo: ext.numero_processo || null,
      vara: ext.vara || null,
      comarca: ext.comarca || null,
      tribunal: ext.tribunal || null,
      polo_ativo: { nome: ext.partes?.autor || tempName },
      polo_passivo: { nome: ext.partes?.reu || null },
      pedidos: (ext.pedidos || []).map((p: string) => ({ descricao: p })),
      causa_pedir: ext.causa_pedir || null,
      resumo_executivo: ext.resumo_executivo || null,
      fatos_resumidos: (ext.fatos_relevantes || []).join('\n'),
      risco: ext.risco_estimado || 'medio',
      tutela_urgencia: ext.tutela_antecipada?.requerida || false,
      fase: 'extracao',
      valor_causa: ext.valor_causa ? parseFloat(ext.valor_causa.replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null,
      assunto: ext.tipo_documento || null,
    }).eq('id', processoId)

    // 7. Update document status
    if (doc) {
      await supabase.from('documents').update({
        upload_status: 'complete',
        ai_status: 'complete',
      }).eq('id', doc.id)
    }

    return NextResponse.json({ processo_id: processoId, extracted: true })

  } catch (err: any) {
    // Extraction failed but processo and file exist — redirect anyway
    if (doc) {
      await supabase.from('documents').update({
        ai_status: 'error',
        upload_status: 'error',
      }).eq('id', doc.id)
    }
    await supabase.from('processos').update({ fase: 'recebido' }).eq('id', processoId)
    // Still return processo_id so user can see the hub and retry
    return NextResponse.json({ processo_id: processoId, extracted: false, error: err.message })
  }
}
