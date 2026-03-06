import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedFirmId, isAuthError } from '@/lib/get-firm-id'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedFirmId(req)
  if (isAuthError(auth)) return auth

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const formData = await req.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string
  const firmId = auth.firm_id // always from JWT — never from formData

  if (!file || !projectId) {
    return NextResponse.json({ error: 'Campos obrigatórios: file, project_id' }, { status: 400 })
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'docx' : 'txt'
  const storagePath = `${firmId}/${projectId}/${Date.now()}-${file.name}`

  // Upload to Storage
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Create document record
  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      firm_id: firmId,
      project_id: projectId,
      name: file.name,
      storage_path: storagePath,
      file_type: fileType,
      file_size_bytes: file.size,
      processing_status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Fire Edge Function asynchronously
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/process-document`
  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_id: doc.id }),
  }).catch(console.error)

  return NextResponse.json({ success: true, document_id: doc.id, project_id: projectId })
}
