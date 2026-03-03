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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('processos')
    .select(`*, clients(id, name, type)`)
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()

  // Remove immutable fields
  const { id: _id, firm_id: _firm_id, created_at: _ca, ...updateData } = body

  const { data, error: dbErr } = await supabaseAdmin
    .from('processos')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('firm_id', firmId)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}
