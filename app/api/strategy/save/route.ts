import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedFirmId, isAuthError } from '@/lib/get-firm-id'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

interface JurisprudenciaItem {
  tribunal: string
  numero: string
  data: string
  ementa: string
  relevancia?: string
  risco?: string
}

interface SavePayload {
  project_id: string
  firm_id: string
  tese_principal: string
  teses_subsidiarias: string[]
  jurisprudencia_favoravel: JurisprudenciaItem[]
  jurisprudencia_desfavoravel: JurisprudenciaItem[]
  probabilidade_exito: number
  risco_estimado: string
  valor_risco_estimado: string | number | null
  recomendacao: string
  draft: string
}

/**
 * Parse a Brazilian currency string (e.g. "R$ 34.500,00") into a numeric value.
 * Returns null if the value is absent or cannot be parsed.
 */
function parseBRCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  // Strip "R$", spaces, thousand-separator dots; replace decimal comma with dot
  const cleaned = String(value)
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedFirmId(req)
    if (isAuthError(auth)) return auth

    const body: SavePayload = await req.json()
    const {
      project_id,
      tese_principal, teses_subsidiarias,
      jurisprudencia_favoravel, jurisprudencia_desfavoravel,
      probabilidade_exito, risco_estimado, valor_risco_estimado,
      recomendacao, draft,
    } = body
    const firm_id = auth.firm_id

    if (!project_id) {
      return NextResponse.json({ error: 'project_id é obrigatório' }, { status: 400 })
    }

    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Parse monetary value from AI-formatted Brazilian currency string → numeric
    const valorRiscoNumeric = parseBRCurrency(valor_risco_estimado)

    // Save to case_strategies
    const { error: stratError } = await adminSupabase
      .from('case_strategies')
      .insert({
        project_id,
        firm_id,
        tese_principal,
        teses_subsidiarias,
        jurisprudencia_favoravel,
        jurisprudencia_desfavoravel,
        risco_estimado,
        valor_risco_estimado: valorRiscoNumeric,
        recomendacao,
        draft_peca: draft,
        draft_tipo: 'contestacao',
        status: 'aprovado',
      })

    if (stratError) {
      console.error('case_strategies insert error:', stratError)
      return NextResponse.json(
        { error: `Falha ao salvar estratégia: ${stratError.message}` },
        { status: 500 }
      )
    }

    // Save draft to pecas
    const { error: pecaError } = await adminSupabase
      .from('pecas')
      .insert({
        project_id,
        firm_id,
        tipo: 'contestacao',
        conteudo: draft,
        modelo_ia: 'gpt-4o',
        versao: 1,
      })

    if (pecaError) {
      console.error('pecas insert error:', pecaError)
      // Log but don't fail — strategy was already saved
    }

    // Update project fase to 'contestacao'
    await adminSupabase
      .from('projects')
      .update({
        fase: 'contestacao',
        risk_level: risco_estimado,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    return NextResponse.json({ success: true, probabilidade_exito })
  } catch (err) {
    console.error('strategy/save error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
