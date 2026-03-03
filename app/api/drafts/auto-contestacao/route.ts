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
      .from('projects')
      .select('*, clients(*)')
      .eq('id', projectId)
      .single()

    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('*, document_extractions(*)')
      .eq('project_id', projectId)

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

    for (const doc of docsWithExtractions) {
      const ext = doc.document_extractions[0]
      sections.push('=== DOCUMENTO: ' + doc.name + ' ===')
      if (ext.summary) sections.push('Resumo: ' + ext.summary)
      if (ext.parties) { sections.push('Partes:'); sections.push(...extractText(ext.parties)) }
      const facts = ext.key_facts || ext.key_dates || ext.facts || []
      if (facts?.length) { sections.push('Fatos:'); sections.push(...extractText(facts)) }
      const risks = ext.risk_factors || ext.risk_flags || []
      if (risks?.length) { sections.push('Riscos:'); sections.push(...extractText(risks)) }
      const deadlines = ext.deadlines || []
      if (deadlines?.length) { sections.push('Prazos:'); sections.push(...extractText(deadlines)) }
      if (ext.case_type) sections.push('Tipo: ' + ext.case_type)
      if (ext.risk_level) sections.push('Risco: ' + ext.risk_level)
      if (ext.raw_extraction) {
        const raw = ext.raw_extraction
        if (raw.relevant_facts?.length) { sections.push('Fatos relevantes:'); sections.push(...raw.relevant_facts) }
        if (raw.key_statements?.length) { sections.push('Declaracoes:'); sections.push(...raw.key_statements) }
      }
      sections.push('')
    }

    if (docsWithExtractions.length === 0) {
      sections.push('Documentos disponiveis: ' + docs.map((d:any) => d.name).join(', '))
    }
    if (extraContext) sections.push('INSTRUCAO DO ADVOGADO: ' + extraContext)

    const contextBlock = sections.join('\n')
    const clientName = (project as any)?.clients?.name || 'cliente'

    const openai = getOpenAI()

    // STREAMING response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        {
          role: 'system',
          content: 'Voce e um advogado brasileiro senior. Escreve pecas juridicas completas, formais, fundamentadas na legislacao e jurisprudencia brasileira. Nunca trunca. Conclui sempre com os pedidos.'
        },
        {
          role: 'user',
          content: 'Com base nos documentos abaixo, elabore uma ' + tipoPeca.toUpperCase() + ' completa para o cliente "' + clientName + '" no caso "' + (project?.name || '') + '".\n\nA peca deve ser especifica para os fatos abaixo, com fundamentacao legal pertinente a area ' + (project?.area || 'do caso') + ', do cabecalho ate a assinatura.\n\n=== CONTEXTO ===\n' + contextBlock + '\n================\n\nElabore a ' + tipoPeca.toUpperCase() + ' completa agora:'
        }
      ],
      max_tokens: 3000,
      temperature: 0.2,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = ''
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }
        controller.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Docs-Analyzed': String(docsWithExtractions.length),
        'X-Total-Docs': String(docs.length),
      }
    })

  } catch (error: any) {
    console.error('auto-contestacao error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
