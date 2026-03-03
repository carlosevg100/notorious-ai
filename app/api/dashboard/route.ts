import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const firmId = profile.firm_id

  const [
    { data: clients },
    { data: projects },
    { data: contracts },
    { data: ai_alerts },
    { data: contract_alerts },
  ] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('*, projects(id, status, risk_level, area), contracts(id, status, value)')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('projects')
      .select('*, clients(id, name), documents(id)')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contracts')
      .select('id, name, status, value, end_date, start_date, contract_type, created_at, updated_at, client_id, clients(id, name)')
      .eq('firm_id', firmId)
      .order('end_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from('ai_alerts')
      .select('*')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .limit(40),
    supabaseAdmin
      .from('contract_alerts')
      .select('*, contracts(id, name, value, client_id, clients(id, name))')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const c = clients || []
  const p = projects || []
  const ct = contracts || []
  const aa = ai_alerts || []
  const ca = contract_alerts || []

  const stats = {
    clientCount: c.length,
    casosAtivos: p.filter((x: any) => x.status === 'ativo').length,
    contratosVigentes: ct.filter((x: any) => x.status === 'vigente').length,
    alertasUnread: aa.filter((x: any) => !x.is_read).length + ca.filter((x: any) => !x.is_read).length,
    valorGestao: ct
      .filter((x: any) => x.status === 'vigente' && x.value)
      .reduce((sum: number, x: any) => sum + Number(x.value || 0), 0),
  }

  return NextResponse.json({ clients: c, projects: p, contracts: ct, ai_alerts: aa, contract_alerts: ca, stats })
}
