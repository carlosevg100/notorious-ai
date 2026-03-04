import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('clients')
    .select('*, projects(id, status)')
    .eq('firm_id', FIRM_ID)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map document → cnpj
  const mapped = (data || []).map(c => ({ ...c, cnpj: c.document }))
  return NextResponse.json(mapped)
}

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      firm_id: FIRM_ID,
      name: body.name,
      document: body.cnpj || body.document || null,
      email: body.email || null,
      type: body.type || 'empresa'
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, cnpj: data.document })
}
