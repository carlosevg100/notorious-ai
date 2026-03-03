import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateLegalDraft } from '@/lib/openai'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  // Support both old params (docType, area, clientPosition, facts) and new params (type, parties, facts, legal_basis, project_id)
  const docType = body.type || body.docType || 'Petição Inicial'
  const area = body.area
  const clientPosition = body.clientPosition
  const facts = body.facts || ''
  const parties = body.parties
  const legalBasis = body.legal_basis
  try {
    const draft = await generateLegalDraft({ docType, area, clientPosition, facts, parties, legalBasis })
    const title = `${docType}${area ? ` — ${area}` : ''}`
    return NextResponse.json({ draft, title })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
