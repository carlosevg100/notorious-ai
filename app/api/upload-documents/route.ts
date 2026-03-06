import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const projectId = formData.get('project_id') as string
    const firmId = formData.get('firm_id') as string

    if (!projectId || !firmId) {
      return NextResponse.json({ error: 'project_id e firm_id são obrigatórios' }, { status: 400 })
    }

    // Collect all files from formData
    const uploadResults: {
      field: string
      name: string
      storage_path: string
      document_category: string
      file_size_bytes: number
      document_id: string
    }[] = []

    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const entries = Array.from(formData.entries())
    const fileEntries = entries.filter(([key]) => key.startsWith('file_'))

    for (const [key, value] of fileEntries) {
      if (!(value instanceof File)) continue

      const file = value as File
      // key format: file_0, file_1, etc.
      const idx = key.replace('file_', '')
      const category = (formData.get(`category_${idx}`) as string) || 'Outro'
      const docSource = (formData.get(`doc_source_${idx}`) as string) || (formData.get('doc_source') as string) || 'parte_autora'

      // Upload to Supabase Storage
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${firmId}/${projectId}/${Date.now()}_${safeName}`

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const { error: storageError } = await adminSupabase.storage
        .from('documents')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (storageError) {
        console.error('Storage upload error:', storageError)
        return NextResponse.json(
          { error: `Falha ao fazer upload de ${file.name}: ${storageError.message}` },
          { status: 500 }
        )
      }

      // Insert document record — try with doc_source first, fall back if column missing
      let docRow: { id: string } | null = null
      let docError: { message: string } | null = null

      const baseInsert = {
        firm_id: firmId,
        project_id: projectId,
        name: file.name,
        storage_path: storagePath,
        file_type: 'pdf',
        file_size_bytes: file.size,
        document_category: category,
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
      }

      // Try with doc_source column
      const { data: docRowWithSource, error: docErrorWithSource } = await adminSupabase
        .from('documents')
        .insert({ ...baseInsert, doc_source: docSource })
        .select('id')
        .single()

      if (docErrorWithSource && docErrorWithSource.message.includes('doc_source')) {
        // Column doesn't exist yet — insert without it
        const { data: docRowFallback, error: docErrorFallback } = await adminSupabase
          .from('documents')
          .insert(baseInsert)
          .select('id')
          .single()
        docRow = docRowFallback
        docError = docErrorFallback
      } else {
        docRow = docRowWithSource
        docError = docErrorWithSource
      }

      if (docError || !docRow) {
        console.error('Document insert error:', docError)
        return NextResponse.json(
          { error: `Falha ao registrar documento ${file.name}: ${docError?.message}` },
          { status: 500 }
        )
      }

      uploadResults.push({
        field: key,
        name: file.name,
        storage_path: storagePath,
        document_category: category,
        file_size_bytes: file.size,
        document_id: docRow.id,
      })
    }

    return NextResponse.json({ success: true, documents: uploadResults })
  } catch (err) {
    console.error('upload-documents error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
