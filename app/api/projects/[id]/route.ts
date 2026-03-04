import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name, document, email), documents(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Map documents to V4 shape with processing_status
  const docs = (data.documents || []).map((d: any) => ({
    ...d,
    storage_path: d.file_path,
    processing_status: mapStatus(d.upload_status, d.ai_status),
    processing_error: null,
    extracted_data: null // fetched separately via /api/documents/[id]/analysis
  }))

  return NextResponse.json({
    ...data,
    tipo: data.area || 'contencioso',
    fase: data.status === 'encerrado' ? 'encerrado' : 'analise',
    numero_processo: null,
    vara: null,
    comarca: null,
    documents: docs,
    clients: data.clients ? {
      ...data.clients,
      cnpj: data.clients.document,
      name: data.clients.name
    } : null
  })
}

function mapStatus(uploadStatus: string, aiStatus: string): string {
  if (aiStatus === 'complete' || uploadStatus === 'complete' || uploadStatus === 'uploaded' && aiStatus === 'complete') return 'completed'
  if (aiStatus === 'error' || uploadStatus === 'error') return 'error'
  if (aiStatus === 'processing' || uploadStatus === 'processing') return 'processing'
  return 'pending'
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()

  const { data, error } = await supabase
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
