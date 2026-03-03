export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

function extractText(val: any): string[] {
  if (!val) return []
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) return val.map((v: any) => typeof v === 'string' ? v : JSON.stringify(v))
  if (typeof val === 'object') return Object.entries(val).map(([k, v]) => `${k}: ${v}`)
  return [String(val)]
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, draftType: pieceType, extraContext, selectedDocIds } = await request.json()
  const tipoPeca = pieceType || 'Contestacao'
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  try {
    const { data: project } = await supabaseAdmin
      .from('projects').select('*, clients(*)').eq('id', projectId).single()

    const { data: documents } = await supabaseAdmin
      .from('documents').select('*, document_extractions(*)').eq('project_id', projectId)

    const docs = (documents || []).filter((d: any) =>
      !selectedDocIds?.length || selectedDocIds.includes(d.id)
    )
    const docsWithExtractions = docs.filter((d: any) => d.document_extractions?.length > 0)

    const sections: string[] = []
    sections.push('CASO: ' + (project?.name || ''))
    sections.push('AREA: ' + (project?.area || ''))
    sections.push('CLIENTE: ' + ((project as any)?.clients?.name || ''))
    sections.push('DOCUMENTOS: ' + docs.map((d:any) => d.name).join(', '))
    sections.push('')

    let totalFacts = 0
    for (const doc of docsWithExtractions) {
      const ext = doc.document_extractions[0]
      sections.push('=== ' + doc.name + ' ===')
      if (ext.summary) sections.push('Resumo: ' + ext.summary)
      if (ext.parties) { sections.push('Partes:'); sections.push(...extractText(ext.parties)) }
      const facts = ext.key_facts || ext.key_dates || ext.facts || []
      if (facts?.length) { sections.push('Fatos:'); sections.push(...extractText(facts)); totalFacts += facts.length }
      const risks = ext.risk_factors || ext.risk_flags || []
      if (risks?.length) { sections.push('Riscos:'); sections.push(...extractText(risks)) }
      const deadlines = ext.deadlines || []
      if (deadlines?.length) { sections.push('Prazos:'); sections.push(...extractText(deadlines)) }
      if (ext.case_type) sections.push('Tipo: ' + ext.case_type)
      sections.push('')
    }

    if (docsWithExtractions.length === 0) {
      sections.push('Documentos: ' + docs.map((d:any) => d.name).join(', '))
    }
    if (extraContext) sections.push('Instrucao: ' + extraContext)

    const contextBlock = sections.join('\n')
    const clientName = (project as any)?.clients?.name || 'cliente'
    const area = (project as any)?.area || 'civel'

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Voce e um advogado brasileiro senior. Elabore pecas juridicas completas, formais e tecnicamente fundamentadas. Use linguagem juridica precisa em portugues. Nunca trunca a peca.'
        },
        {
          role: 'user',
          content: 'Elabore uma ' + tipoPeca.toUpperCase() + ' completa para o cliente "' + clientName + '" no caso "' + (project?.name || '') + '" (area: ' + area + ').\n\nA peca deve ser especifica para os fatos abaixo, com estrutura formal brasileira completa do cabecalho ate os pedidos.\n\n' + contextBlock + '\n\nElabore a ' + tipoPeca.toUpperCase() + ' completa:'
        }
      ],
      max_tokens: 2000,
      temperature: 0.2,
    })

    const draft = response.choices[0].message.content || ''

    return NextResponse.json({
      draft,
      stats: {
        documentsAnalyzed: docsWithExtractions.length,
        totalDocuments: docs.length,
        partiesIdentified: 0,
        factsExtracted: totalFacts,
      }
    })
  } catch (error: any) {
    console.error('draft error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
