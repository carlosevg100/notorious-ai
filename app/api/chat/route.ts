import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { chatWithContext } from '@/lib/openai'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, project_id } = await request.json()

  // Get project details
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('name, area')
    .eq('id', project_id)
    .single()
  
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Get all documents with extractions for this project
  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('name, document_extractions(*)')
    .eq('project_id', project_id)
    .eq('ai_status', 'complete')

  const docsWithExtraction = (docs || []).map(d => ({
    name: d.name,
    extraction: (d.document_extractions as any[])?.[0] || null
  }))

  // Save user message
  await supabaseAdmin.from('chat_messages').insert({
    project_id,
    user_id: user.id,
    role: 'user',
    content: message
  })

  // Generate AI response
  const aiResponse = await chatWithContext(
    message,
    project.name,
    project.area,
    docsWithExtraction
  )

  // Save AI message
  await supabaseAdmin.from('chat_messages').insert({
    project_id,
    user_id: user.id,
    role: 'assistant',
    content: aiResponse
  })

  return NextResponse.json({ response: aiResponse })
}

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const projectId = url.searchParams.get('project_id')
  
  const { data: messages, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(messages)
}
