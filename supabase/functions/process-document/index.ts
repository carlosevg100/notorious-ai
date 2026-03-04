import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!

serve(async (req) => {
  const { document_id } = await req.json()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Buscar documento
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single()

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 2. Atualizar status → processing
  await supabase.from('documents').update({
    processing_status: 'processing',
    processing_started_at: new Date().toISOString()
  }).eq('id', document_id)

  try {
    // 3. Download arquivo do Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`)
    }

    const buffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // 4. Extrair texto baseado no tipo
    let extractedText = ''

    if (doc.file_type === 'txt') {
      extractedText = new TextDecoder().decode(bytes)
    } else if (doc.file_type === 'pdf') {
      // Usar pdfjs-dist via esm.sh (funciona em Deno)
      const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs')
      const loadingTask = pdfjsLib.getDocument({ data: bytes })
      const pdf = await loadingTask.promise
      const maxPages = Math.min(pdf.numPages, 50) // máx 50 páginas
      const textParts = []
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        textParts.push(content.items.map((item: any) => item.str).join(' '))
      }
      extractedText = textParts.join('\n\n')
    } else if (doc.file_type === 'docx') {
      extractedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
        .replace(/[^\x20-\x7E\u00C0-\u024F\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Não foi possível extrair texto do documento. Verifique se o PDF não é uma imagem escaneada.')
    }

    // 5. Extrair dados estruturados com OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [{
          role: 'system',
          content: `Você é um especialista em análise de documentos jurídicos brasileiros.
Extraia as informações do documento e retorne APENAS JSON válido, sem markdown, sem explicações.
Se uma informação não estiver presente, use null.`
        }, {
          role: 'user',
          content: `Analise este documento jurídico e extraia as informações em JSON com EXATAMENTE esta estrutura:

{
  "tipo_documento": "string (petição inicial, contestação, recurso, contrato, laudo, etc)",
  "numero_processo": "string ou null",
  "vara": "string ou null",
  "comarca": "string ou null",
  "partes": {
    "autor": "string ou null",
    "reu": "string ou null",
    "advogado_autor": "string ou null",
    "advogado_reu": "string ou null"
  },
  "causa_pedir": "string (resumo em 1-2 frases)",
  "pedidos": ["string", "string"],
  "fatos_relevantes": ["string", "string"],
  "teses_juridicas": ["string"],
  "tutela_antecipada": {
    "requerida": false,
    "fundamento": null
  },
  "valor_causa": "string ou null",
  "prazos_identificados": [
    {
      "descricao": "string",
      "data": "YYYY-MM-DD ou null",
      "tipo": "processual"
    }
  ],
  "risco_estimado": "baixo",
  "risco_justificativa": "string",
  "resumo_executivo": "string (150-200 palavras, em português, narrativa clara para o sócio)"
}

DOCUMENTO:
${extractedText.substring(0, 15000)}`
        }]
      })
    })

    const openaiData = await openaiResponse.json()
    const rawContent = openaiData.choices[0].message.content.trim()

    // Limpar JSON se vier com markdown
    const jsonContent = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const extractedData = JSON.parse(jsonContent)

    // 6. Salvar resultado
    await supabase.from('documents').update({
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      extracted_text: extractedText.substring(0, 50000),
      extracted_data: extractedData
    }).eq('id', document_id)

    // 7. Criar prazos no DB se identificados (best effort)
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
        // Best effort - table might not exist
        await supabase.from('prazos').insert(prazosInsert).catch(() => {})
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    await supabase.from('documents').update({
      processing_status: 'error',
      processing_error: error.message
    }).eq('id', document_id)

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
