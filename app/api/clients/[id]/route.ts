import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get all projects for this client
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', clientId)

  // Cascading delete for each project
  for (const project of (projects || [])) {
    await supabase.from('pecas').delete().eq('project_id', project.id)
    await supabase.from('case_strategies').delete().eq('project_id', project.id)
    await supabase.from('research_results').delete().eq('project_id', project.id)
    await supabase.from('document_extractions').delete().eq('project_id', project.id)
    await supabase.from('documents').delete().eq('project_id', project.id)
    await supabase.from('chat_messages').delete().eq('project_id', project.id)
    await supabase.from('prazos').delete().eq('project_id', project.id)
  }

  // Delete all projects for this client
  if (projects && projects.length > 0) {
    const projectIds = projects.map((p: { id: string }) => p.id)
    await supabase.from('projects').delete().in('id', projectIds)
  }

  // Delete client contacts
  await supabase.from('client_contacts').delete().eq('client_id', clientId)

  // Delete the client
  const { error } = await supabase.from('clients').delete().eq('id', clientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
