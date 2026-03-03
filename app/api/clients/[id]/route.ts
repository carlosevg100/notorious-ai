import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'

async function getFirmId(): Promise<{ firmId: string | null; error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { firmId: null, error: 'Unauthorized' }
  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return { firmId: null, error: 'Profile not found' }
  return { firmId: profile.firm_id }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [{ data: projects }, { data: contracts }] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('*, documents(count)')
      .eq('client_id', id)
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contracts')
      .select('*, contract_extractions(*)')
      .eq('client_id', id)
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ ...client, projects: projects || [], contracts: contracts || [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()
  const { data, error: dbErr } = await supabaseAdmin
    .from('clients')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('firm_id', firmId)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const { error: dbErr } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('firm_id', firmId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
