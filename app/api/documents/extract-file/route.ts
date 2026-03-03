export const maxDuration = 60
export const dynamic = 'force-dynamic'

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

  let docId = ''
  let fileName = ''

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    docId = formData.get('docId') as string
    if (!file || !docId) return NextResponse.json({ error: 'Missing file or docId' }, { status: 400 })
    fileName = file.name

    // Get project_id
    const { data: docRow } = await supabaseAdmin.from('documents').select('project_id').eq('id', docId).single()
    const projectId = docRow?.project_id

    // Try to extract text from file
    let text = ''
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = (await file.text()).substring(0, 4000)
      } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        // Try pdf-parse with timeout
        const buffer = Buffer.from(await file.arrayBuffer())
        const pdfParsePromise = import('pdf-parse').then(m => m.default(buffer))
        const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
        const parsed = await Promise.race([pdfParsePromise, timeoutPromise]) as any
        text = (parsed?.text || '').substring(0, 4000)
      } else {
        text = `Documento: ${file.name}`
      }
    } catch (parseErr: any) {
      console.log('parse fallback:', parseErr?.message)
      text = `Documento juridico: ${file.name}`
    }

    if (!text.trim()) text = `Documento juridico: ${file.name}`

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analise este documento juridico brasileiro e extraia informacoes. Retorne APENAS JSON valido:
{"doc_type":"string","parties":{"autor":"string","reu":"string","advogado":"string"},"case_type":"string","summary":"string resumo em portugues ate 150 palavras","key_facts":["string"],"risk_level":"alto|medio|baixo","risk_factors":["string"],"deadlines":[{"description":"string","date":"YYYY-MM-DD","type":"processual","is_fatal":false}],"fraud_detected":false,"fraud_indicators":[]}

Documento:
${text}`
      }],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    const extraction = JSON.parse(response.choices[0].message.content || '{}')

    await supabaseAdmin.from('document_extractions').insert({
      document_id: docId,
      project_id: projectId,
      parties: extraction.parties || {},
      case_type: extraction.case_type || extraction.doc_type || '',
      summary: extraction.summary || '',
      risk_level: extraction.risk_level || 'medio',
      risk_factors: extraction.risk_factors || [],
      key_facts: extraction.key_facts || [],
      deadlines: extraction.deadlines || [],
      fraud_detected: extraction.fraud_detected || false,
      fraud_indicators: extraction.fraud_indicators || [],
      raw_extraction: extraction
    })

    await supabaseAdmin.from('documents').update({ ai_status: 'complete' }).eq('id', docId)
    return NextResponse.json({ ok: true, extraction })

  } catch (error: any) {
    console.error('extract-file error:', error?.message)
    if (docId) {
      try { await supabaseAdmin.from('documents').update({ ai_status: 'failed' }).eq('id', docId) } catch {}
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
