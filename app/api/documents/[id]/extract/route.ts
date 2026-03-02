import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import { extractDocumentData } from '@/lib/openai'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: docId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { text } = await request.json()
  try {
    const extraction = await extractDocumentData(text)
    const { data: saved, error: saveErr } = await supabaseAdmin.from('document_extractions').insert({ document_id: docId, doc_type: extraction.doc_type, parties: extraction.parties, key_dates: extraction.key_dates, deadlines: extraction.deadlines, risk_flags: extraction.risk_flags, summary: extraction.summary, raw_extraction: extraction }).select().single()
    if (saveErr) throw saveErr
    await supabaseAdmin.from('documents').update({ ai_status: 'complete' }).eq('id', docId)
    const { data: doc } = await supabaseAdmin.from('documents').select('firm_id, project_id, name').eq('id', docId).single()
    if (doc) {
      const alerts: any[] = []
      for (const flag of (extraction.risk_flags || [])) {
        if (flag.severity === 'alto') alerts.push({ firm_id: doc.firm_id, project_id: doc.project_id, document_id: docId, type: 'risk', message: `⚠️ Risco alto em "${doc.name}": ${flag.description}`, is_read: false })
      }
      for (const dl of (extraction.deadlines || [])) {
        if (dl.urgency === 'alta') alerts.push({ firm_id: doc.firm_id, project_id: doc.project_id, document_id: docId, type: 'deadline', message: `📅 Prazo urgente em "${doc.name}": ${dl.description} — ${dl.date}`, is_read: false })
      }
      if (alerts.length > 0) await supabaseAdmin.from('ai_alerts').insert(alerts)
    }
    return NextResponse.json({ extraction: saved })
  } catch (error: any) {
    await supabaseAdmin.from('documents').update({ ai_status: 'failed' }).eq('id', docId)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
