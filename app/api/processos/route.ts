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
    .from('processos')
    .select(`
      *,
      clients(id, name, type)
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
  const {
    client_id, numero_processo, tribunal, comarca, vara, juiz,
    classe_processual, assunto, valor_causa,
    polo_ativo, polo_passivo, pedidos, tutela_urgencia,
    fatos_resumidos, causa_pedir, fundamentos_juridicos,
    documentos_mencionados, resumo_executivo,
    fase, prazo_contestacao, risco
  } = body

  const { data, error: dbErr } = await supabaseAdmin
    .from('processos')
    .insert({
      firm_id: firmId,
      client_id: client_id || null,
      numero_processo, tribunal, comarca, vara, juiz,
      classe_processual, assunto,
      valor_causa: valor_causa ? Number(valor_causa) : null,
      polo_ativo: polo_ativo || {},
      polo_passivo: polo_passivo || {},
      pedidos: pedidos || [],
      tutela_urgencia: tutela_urgencia || false,
      fatos_resumidos, causa_pedir,
      fundamentos_juridicos: fundamentos_juridicos || [],
      documentos_mencionados: documentos_mencionados || [],
      resumo_executivo,
      fase: fase || 'recebido',
      prazo_contestacao: prazo_contestacao || null,
      risco: risco || 'medio',
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}
