import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('clients')
    .select('*, projects(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const projects = (data.projects || []).map((p: any) => ({
    ...p,
    tipo: p.area || 'contencioso',
    fase: p.status === 'encerrado' ? 'encerrado' : 'analise',
    numero_processo: null
  }))

  return NextResponse.json({ ...data, cnpj: data.document, projects })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const body = await req.json()

  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, cnpj: data.document })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
