export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string
  if (!file || !projectId) return NextResponse.json({ error: 'Missing file or project_id' }, { status: 400 })

  const filePath = `${projectId}/${Date.now()}_${file.name}`
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error: storageErr } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { data: doc, error: dbErr } = await supabaseAdmin
    .from('documents')
    .insert({ name: file.name, file_path: filePath, file_type: file.type, project_id: projectId, firm_id: profile.firm_id, upload_status: 'uploaded', ai_status: 'processing' })
    .select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ doc, filePath })
}
