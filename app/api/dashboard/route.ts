import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '@/lib/supabase-server'

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const [projectsRes, docsRes] = await Promise.all([
    supabase.from('projects').select('id, fase, status').eq('firm_id', FIRM_ID),
    supabase.from('documents').select('id, processing_status').eq('firm_id', FIRM_ID),
  ])
  const prazosRes = await supabase.from('prazos').select('id, data_prazo, status, descricao, project_id, projects(name)').eq('firm_id', FIRM_ID).order('data_prazo')
    .then(r => r, () => ({ data: null }))

  const projects = projectsRes.data || []
  const docs = docsRes.data || []
  const prazos = (prazosRes as any).data || []

  const pipeline = {
    analise: projects.filter(p => p.fase === 'analise').length,
    contestacao: projects.filter(p => p.fase === 'contestacao').length,
    recurso: projects.filter(p => p.fase === 'recurso').length,
    execucao: projects.filter(p => p.fase === 'execucao').length,
    encerrado: projects.filter(p => p.fase === 'encerrado').length,
  }

  const today = new Date()
  const in7days = new Date(today)
  in7days.setDate(in7days.getDate() + 10)

  const proximosPrazos = prazos.filter((p: any) => {
    const d = new Date(p.data_prazo)
    return d >= today && d <= in7days && p.status !== 'cumprido'
  })

  return NextResponse.json({
    stats: {
      totalProcessos: projects.filter(p => p.status === 'ativo').length,
      documentosPendentes: docs.filter(d => d.processing_status === 'pending' || d.processing_status === 'processing').length,
      prazosEstaSemana: proximosPrazos.length,
      prazosVencidos: prazos.filter((p: any) => new Date(p.data_prazo) < today && p.status !== 'cumprido').length,
    },
    pipeline,
    proximosPrazos: proximosPrazos.slice(0, 10)
  })
}
