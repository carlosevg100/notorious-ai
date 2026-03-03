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

export async function GET() {
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('clients')
    .select(`
      *,
      projects(id, name, status, area),
      contracts(id, name, status, value)
    `)
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const { firmId, error } = await getFirmId()
  if (!firmId) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()
  const { name, type, document, email, phone, address, notes } = body

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('clients')
    .insert({ name, type: type || 'pessoa_juridica', document, email, phone, address, notes, firm_id: firmId })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}
