import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'
const EDGE_FUNCTION_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co/functions/v1/process-document'

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const formData = await req.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string
  const firmId = (formData.get('firm_id') as string) || FIRM_ID

  if (!file || !projectId) {
    return NextResponse.json({ error: 'Missing file or project_id' }, { status: 400 })
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'docx' : 'txt'
  const storagePath = `firms/${firmId}/projects/${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Insert into documents table using existing column names
  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      firm_id: firmId,
      project_id: projectId,
      name: file.name,
      file_path: storagePath,      // existing column
      file_type: fileType,
      upload_status: 'pending',    // existing column
      ai_status: 'pending',        // existing column
      document_type: 'case'
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const docId = doc.id
  const origin = req.nextUrl.origin

  // Try Edge Function, fall back to inline processor
  ;(async () => {
    try {
      const efRes = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: docId })
      })
      if (!efRes.ok) {
        await fetch(`${origin}/api/process-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: docId })
        })
      }
    } catch {
      // silent
    }
  })()

  return NextResponse.json({
    success: true,
    document_id: doc.id,
    project_id: projectId
  })
}
