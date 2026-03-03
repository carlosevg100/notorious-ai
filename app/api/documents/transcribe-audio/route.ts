import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI, { toFile } from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const docId = formData.get('docId') as string
    if (!file || !docId) return NextResponse.json({ error: 'Missing file or docId' }, { status: 400 })

    const openai = getOpenAI()
    const buffer = Buffer.from(await file.arrayBuffer())

    // Step 1: Transcribe with Whisper
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: await toFile(buffer, file.name, { type: file.type || 'audio/mpeg' }),
      model: 'whisper-1',
      language: 'pt',
    })
    const transcription = transcriptionResponse.text

    // Step 2: Extract legal intelligence with GPT-4o
    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Você é um assistente jurídico analisando a transcrição de uma gravação. Extraia as seguintes informações em formato JSON:
{
  "summary": "string (resumo de 2-3 frases)",
  "parties": [{"name": "string", "role": "string"}],
  "relevant_facts": ["string (fato relevante para o processo)"],
  "key_statements": ["string (admissões ou declarações importantes)"],
  "legal_arguments": ["string (argumento jurídico identificado)"],
  "risk_level": "alto|medio|baixo",
  "behavioral_notes": "string (observações sobre tom e comportamento relevante)",
  "doc_type": "Gravação de Áudio",
  "risk_flags": [{"description": "string", "severity": "alto|medio|baixo"}],
  "key_dates": [],
  "deadlines": []
}
Retorne APENAS o JSON válido, sem texto adicional.
Transcrição: ${transcription.substring(0, 10000)}`
      }],
      max_tokens: 2000
    })

    const extractionContent = extractionResponse.choices[0].message.content
    if (!extractionContent) throw new Error('No response from OpenAI')
    const extraction = JSON.parse(extractionContent)

    // Step 3: Save to document_extractions
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('document_extractions')
      .insert({
        document_id: docId,
        doc_type: 'Gravação de Áudio',
        parties: extraction.parties || [],
        key_dates: extraction.key_dates || [],
        deadlines: extraction.deadlines || [],
        risk_flags: extraction.risk_flags || [],
        summary: extraction.summary || '',
        raw_extraction: { ...extraction, transcription }
      })
      .select()
      .single()

    if (saveErr) throw saveErr

    // Step 4: Update document status
    await supabaseAdmin.from('documents').update({
      ai_status: 'complete',
      file_type: 'audio'
    }).eq('id', docId)

    // Step 5: Create alerts for high-risk flags
    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('firm_id, project_id, name')
      .eq('id', docId)
      .single()

    if (doc) {
      const alerts: any[] = []
      for (const flag of (extraction.risk_flags || [])) {
        if (flag.severity === 'alto') {
          alerts.push({
            firm_id: doc.firm_id, project_id: doc.project_id, document_id: docId,
            type: 'risk', message: `⚠️ Risco alto em áudio "${doc.name}": ${flag.description}`, is_read: false
          })
        }
      }
      if (alerts.length > 0) await supabaseAdmin.from('ai_alerts').insert(alerts)
    }

    return NextResponse.json({ transcription, extraction: saved })
  } catch (error: any) {
    console.error('Audio transcription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
