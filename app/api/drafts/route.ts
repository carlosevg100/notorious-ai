import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateLegalDraft } from '@/lib/openai'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { docType, area, clientPosition, facts } = body

  try {
    const draft = await generateLegalDraft({ docType, area, clientPosition, facts })
    return NextResponse.json({ draft })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
