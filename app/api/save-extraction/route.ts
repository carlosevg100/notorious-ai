import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      document_id,
      project_id,
      document_category,
      extracted,
      is_peticao,
    } = body

    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Build extraction record based on doc type
    let extractionRow: Record<string, unknown>

    if (is_peticao) {
      extractionRow = {
        document_id,
        doc_type: extracted.tipo_acao || 'Petição Inicial',
        parties: [
          { name: extracted.autor, role: 'Autor' },
          { name: extracted.reu, role: 'Réu' },
        ].filter(p => p.name),
        key_dates: extracted.prazos
          ? [{ date: null, description: extracted.prazos }]
          : [],
        deadlines: [],
        risk_flags: [],
        summary: extracted.pedidos || extracted.nome_processo || null,
        raw_extraction: extracted,
      }
    } else {
      extractionRow = {
        document_id,
        doc_type: extracted.doc_type || document_category,
        parties: extracted.parties || [],
        key_dates: extracted.key_dates || [],
        deadlines: extracted.deadlines || [],
        risk_flags: extracted.risk_flags || [],
        summary: extracted.summary || null,
        raw_extraction: extracted,
      }
    }

    // Insert extraction
    const { error: extractError } = await adminSupabase
      .from('document_extractions')
      .insert(extractionRow)

    if (extractError) {
      console.error('Extraction insert error:', extractError)
      return NextResponse.json(
        { error: `Falha ao salvar extração: ${extractError.message}` },
        { status: 500 }
      )
    }

    // Update document status to completed
    await adminSupabase
      .from('documents')
      .update({
        processing_status: 'completed',
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', document_id)

    // If petição inicial, update project metadata
    if (is_peticao && project_id) {
      const updateData: Record<string, string | null> = {}
      if (extracted.numero_processo) updateData.numero_processo = extracted.numero_processo
      if (extracted.vara) updateData.vara = extracted.vara
      if (extracted.comarca) updateData.comarca = extracted.comarca
      if (extracted.tipo) updateData.tipo = extracted.tipo
      if (extracted.area) updateData.area = extracted.area
      if (extracted.nome_processo) updateData.name = extracted.nome_processo

      if (Object.keys(updateData).length > 0) {
        await adminSupabase
          .from('projects')
          .update(updateData)
          .eq('id', project_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('save-extraction error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
