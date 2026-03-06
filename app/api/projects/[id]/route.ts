import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Cascading delete: related records first, then project
  await supabase.from('pecas').delete().eq('project_id', projectId)
  await supabase.from('case_strategies').delete().eq('project_id', projectId)
  await supabase.from('research_results').delete().eq('project_id', projectId)
  await supabase.from('document_extractions').delete().eq('project_id', projectId)
  await supabase.from('documents').delete().eq('project_id', projectId)
  await supabase.from('chat_messages').delete().eq('project_id', projectId)
  await supabase.from('prazos').delete().eq('project_id', projectId)

  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
