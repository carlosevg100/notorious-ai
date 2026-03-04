import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const formData = await req.formData()
  const file = formData.get('file') as File
  const clientId = formData.get('client_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'docx' : 'txt'
  const tempName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

  // 1. Create processo record
  const { data: processo, error: processoError } = await supabaseAdmin
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

  // 2. Upload file to Supabase Storage
  const storagePath = `firms/${FIRM_ID}/processos/${processoId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // 3. Create document record
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .insert({
      firm_id: FIRM_ID,
      project_id: processoId,
      name: file.name,
      file_path: storagePath,
      file_type: fileType,
      upload_status: 'pending',
      ai_status: 'pending',
      document_type: 'case',
    })
    .select()
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: docError?.message || 'Failed to create document' }, { status: 500 })
  }

  // 4. Fire-and-forget: trigger process-document
  const origin = req.nextUrl.origin
  ;(async () => {
    try {
      await fetch(`${origin}/api/process-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id }),
      })
    } catch {
      // silent
    }
  })()

  // 5. Return ids
  return NextResponse.json({ processo_id: processoId, document_id: doc.id })
}
