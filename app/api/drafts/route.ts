import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateLegalDraft } from '@/lib/openai'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docType, area, clientPosition, facts } = await request.json()
  try {
    const draft = await generateLegalDraft({ docType, area, clientPosition, facts })
    return NextResponse.json({ draft })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
