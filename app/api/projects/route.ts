import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

export async function GET(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('projects')
    .select('*, clients(name), documents(id, upload_status, ai_status)')
    .eq('firm_id', FIRM_ID)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map to V4-compatible shape
  const mapped = (data || []).map(p => ({
    ...p,
    tipo: p.area || 'contencioso',
    fase: p.status === 'encerrado' ? 'encerrado' : 'analise',
    numero_processo: null,
    vara: null,
    comarca: null
  }))

  return NextResponse.json(mapped)
}

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      firm_id: FIRM_ID,
      client_id: body.client_id,
      name: body.name,
      area: body.tipo || body.area || 'contencioso',
      status: 'ativo',
      risk_level: 'medio'
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ...data,
    tipo: data.area,
    fase: 'analise',
    numero_processo: null,
    vara: null,
    comarca: null
  })
}
