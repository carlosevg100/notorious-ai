import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { email, password, name, firmName } = await request.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  if (!authData.user) return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
  const { data: firm, error: firmErr } = await supabaseAdmin.from('firms').insert({ name: firmName }).select().single()
  if (firmErr) return NextResponse.json({ error: firmErr.message }, { status: 500 })
  const { error: userErr } = await supabaseAdmin.from('users').insert({ id: authData.user.id, firm_id: firm.id, email, name, role: 'admin' })
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })
  return NextResponse.json({ user: authData.user, firm })
}
