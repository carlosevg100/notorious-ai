import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { document_id } = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Use existing column names
  await supabase.from('documents').update({
    upload_status: 'processing',
    ai_status: 'processing'
  }).eq('id', document_id)

  try {
    // file_path is the storage path (existing column)
    const storagePath = doc.file_path

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()

    let extractedText = ''

    if (doc.file_type === 'txt') {
      extractedText = new TextDecoder().decode(new Uint8Array(arrayBuffer))
    } else if (doc.file_type === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(Buffer.from(arrayBuffer))
      extractedText = result.text
    } else if (doc.file_type === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
      extractedText = result.value
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Texto insuficiente. O arquivo pode ser uma imagem escaneada ou estar corrompido.')
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [{
          role: 'system',
          content: 'Você é um especialista em análise de documentos jurídicos brasileiros. Extraia as informações do documento e retorne APENAS JSON válido, sem markdown, sem explicações. Se uma informação não estiver presente, use null.'
        }, {
          role: 'user',
          content: `Analise este documento jurídico e extraia as informações em JSON com EXATAMENTE esta estrutura:
{
  "tipo_documento": "string",
  "numero_processo": "string ou null",
  "vara": "string ou null",
  "comarca": "string ou null",
  "partes": {"autor": "string ou null","reu": "string ou null","advogado_autor": "string ou null","advogado_reu": "string ou null"},
  "causa_pedir": "string",
  "pedidos": ["string"],
  "fatos_relevantes": ["string"],
  "teses_juridicas": ["string"],
  "tutela_antecipada": {"requerida": false, "fundamento": null},
  "valor_causa": "string ou null",
  "prazos_identificados": [{"descricao": "string","data": "YYYY-MM-DD ou null","tipo": "processual"}],
  "risco_estimado": "baixo",
  "risco_justificativa": "string",
  "resumo_executivo": "string (150-200 palavras)"
}
DOCUMENTO:\n${extractedText.substring(0, 15000)}`
        }]
      })
    })

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content?.trim() || ''
    const jsonContent = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const extractedData = JSON.parse(jsonContent)

    // Store analysis as JSON in storage (since no extracted_data column)
    const analysisJson = JSON.stringify({
      extracted_data: extractedData,
      extracted_text: extractedText.substring(0, 10000)
    })
    await supabase.storage
      .from('documents')
      .upload(`analysis/${document_id}.json`, Buffer.from(analysisJson), {
        contentType: 'application/json',
        upsert: true
      })

    // Update document status using existing columns
    await supabase.from('documents').update({
      upload_status: 'complete',
      ai_status: 'complete'
    }).eq('id', document_id)

    // Insert prazos if table exists (best effort)
    if (extractedData.prazos_identificados?.length > 0) {
      const prazosInsert = extractedData.prazos_identificados
        .filter((p: any) => p.data)
        .map((p: any) => ({
          firm_id: doc.firm_id,
          project_id: doc.project_id,
          document_id: doc.id,
          descricao: p.descricao,
          data_prazo: p.data,
          tipo: p.tipo || 'processual'
        }))
      if (prazosInsert.length > 0) {
        await supabase.from('prazos').insert(prazosInsert)
          .then(() => {}, () => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    await supabase.from('documents').update({
      upload_status: 'error',
      ai_status: 'error'
    }).eq('id', document_id)

    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
