import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Fetch analysis from storage
  const { data, error } = await supabase.storage
    .from('documents')
    .download(`analysis/${id}.json`)

  if (error || !data) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const text = await data.text()
  const analysis = JSON.parse(text)
  return NextResponse.json(analysis)
}
