import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Get file_path before deleting
  const { data: doc } = await supabaseAdmin.from('documents').select('file_path, firm_id').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from storage
  if (doc.file_path) {
    await supabaseAdmin.storage.from('documents').remove([doc.file_path])
  }

  // Delete extractions + document
  await supabaseAdmin.from('document_extractions').delete().eq('document_id', id)
  await supabaseAdmin.from('documents').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
