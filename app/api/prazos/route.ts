import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

export async function GET(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  try {
    let query = supabase
      .from('prazos')
      .select('*, projects(name)')
      .eq('firm_id', FIRM_ID)
      .order('data_prazo', { ascending: true })

    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query
    if (error) return NextResponse.json([])
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()

  try {
    const { data, error } = await supabase
      .from('prazos')
      .insert({ ...body, firm_id: FIRM_ID })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
