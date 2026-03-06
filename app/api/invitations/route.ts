import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getAdmin()
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: caller } = await supabaseAdmin
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role } = await request.json()

  if (!email || !role) {
    return NextResponse.json({ error: 'Email e cargo são obrigatórios' }, { status: 400 })
  }

  const validRoles = ['admin', 'advogado', 'estagiario', 'consulta']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Cargo inválido' }, { status: 400 })
  }

  // Create invitation record
  const { data: invitation, error: invError } = await supabaseAdmin
    .from('firm_invitations')
    .insert({ firm_id: caller.firm_id, email, role, invited_by: user.id })
    .select()
    .single()

  if (invError) {
    return NextResponse.json({ error: invError.message }, { status: 500 })
  }

  // Send invite via Supabase Auth
  const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { firm_id: caller.firm_id, role, invitation_id: invitation.id },
  })

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, invitation_id: invitation.id })
}

export async function GET(request: NextRequest) {
  const supabaseAdmin = getAdmin()
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: caller } = await supabaseAdmin
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: invitations, error } = await supabaseAdmin
    .from('firm_invitations')
    .select('id, email, role, status, created_at, expires_at')
    .eq('firm_id', caller.firm_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(invitations)
}
