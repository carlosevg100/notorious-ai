import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await request.json()
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  try {
    // Fetch project details
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*, clients(*)')
      .eq('id', projectId)
      .single()

    // Fetch all documents with their extractions
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('*, document_extractions(*)')
      .eq('project_id', projectId)

    const docs = documents || []
    const docsWithExtractions = docs.filter((d: any) => d.document_extractions?.length > 0)

    // Aggregate all data
    const allParties: string[] = []
    const allRiskFlags: string[] = []
    const allDates: string[] = []
    const allSummaries: string[] = []
    const allFacts: string[] = []
    const allStatements: string[] = []
    const allLegalArgs: string[] = []
    const fraudFlags: string[] = []

    for (const doc of docsWithExtractions) {
      const ext = doc.document_extractions[0]
      const raw = ext.raw_extraction || {}

      if (ext.parties) {
        const parties = Array.isArray(ext.parties) ? ext.parties : []
        allParties.push(...parties.map((p: any) =>
          typeof p === 'object' ? `${p.name}${p.role ? ` (${p.role})` : ''}` : String(p)
        ))
      }
      if (ext.risk_flags) {
        const flags = Array.isArray(ext.risk_flags) ? ext.risk_flags : []
        allRiskFlags.push(...flags.map((r: any) => `[${(r.severity || 'medio').toUpperCase()}] ${r.description}`))
      }
      if (ext.key_dates) {
        const dates = Array.isArray(ext.key_dates) ? ext.key_dates : []
        allDates.push(...dates.map((d: any) => `${d.date}: ${d.description}`))
      }
      if (ext.summary) allSummaries.push(`Documento "${doc.name}": ${ext.summary}`)

      // Audio-specific data
      if (raw.relevant_facts) allFacts.push(...(raw.relevant_facts as string[]))
      if (raw.key_statements) allStatements.push(...(raw.key_statements as string[]))
      if (raw.legal_arguments) allLegalArgs.push(...(raw.legal_arguments as string[]))
      if (raw.fraud_risk?.detected) {
        fraudFlags.push(...(raw.fraud_risk.indicators || []))
      }
    }

    const uniqueParties = [...new Set(allParties)]
    const clientName = (project as any)?.clients?.name || 'Não informado'

    const contextBlock = [
      `CASO: ${project?.name || 'Não informado'}`,
      `ÁREA DO DIREITO: ${project?.area || 'Não informado'}`,
      `CLIENTE: ${clientName}`,
      ``,
      `PARTES IDENTIFICADAS (${uniqueParties.length}):`,
      uniqueParties.join('\n') || 'Não identificadas',
      ``,
      `RESUMOS DOS DOCUMENTOS ANALISADOS (${docsWithExtractions.length} de ${docs.length} documentos):`,
      allSummaries.join('\n\n') || 'Nenhum documento com extração disponível.',
      ``,
      allRiskFlags.length > 0 ? `RISCOS IDENTIFICADOS:\n${allRiskFlags.join('\n')}` : '',
      allDates.length > 0 ? `\nDATAS E FATOS-CHAVE:\n${allDates.join('\n')}` : '',
      allFacts.length > 0 ? `\nFATOS RELEVANTES EXTRAÍDOS:\n${allFacts.map(f => `• ${f}`).join('\n')}` : '',
      allStatements.length > 0 ? `\nDECLARAÇÕES E ADMISSÕES:\n${allStatements.map(s => `• ${s}`).join('\n')}` : '',
      allLegalArgs.length > 0 ? `\nARGUMENTOS JURÍDICOS IDENTIFICADOS:\n${allLegalArgs.map(a => `• ${a}`).join('\n')}` : '',
      fraudFlags.length > 0 ? `\nINDÍCIOS DE FRAUDE/IRREGULARIDADE:\n${fraudFlags.map(f => `• ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Você é um advogado sênior brasileiro. Com base nos documentos e fatos abaixo, elabore uma CONTESTAÇÃO completa, formal e tecnicamente fundamentada. Use linguagem jurídica precisa. Estruture: I - DOS FATOS, II - DO DIREITO, III - DAS PROVAS, IV - DOS PEDIDOS. Inclua fundamentos legais relevantes (CLT, CC, CDC conforme área). A contestação deve ser personalizada aos fatos específicos do caso.

${contextBlock}

Elabore a CONTESTAÇÃO completa agora, sem truncar:`
      }],
      max_tokens: 4000
    })

    const draft = response.choices[0].message.content || ''

    return NextResponse.json({
      draft,
      stats: {
        documentsAnalyzed: docsWithExtractions.length,
        totalDocuments: docs.length,
        partiesIdentified: uniqueParties.length,
        factsExtracted: allFacts.length + allRiskFlags.length + allDates.length
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
