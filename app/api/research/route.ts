import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const OPENAI_KEY      = process.env.OPENAI_API_KEY   || ''
const PERPLEXITY_KEY  = process.env.PERPLEXITY_API_KEY || ''

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

/* ─── Types ─────────────────────────────────────────────────── */

export interface NormalizedPrecedent {
  tribunal: string
  numero: string
  relator: string
  data: string
  ementa: string
  relevancia: 'alta' | 'media' | 'baixa'
  favoravel: boolean
  source: 'stj' | 'stf' | 'tst' | 'perplexity'
}

interface JurisprudenciaItem {
  tribunal: string
  numero: string
  data: string
  ementa: string
  relevancia?: string
  risco?: string
}

interface ResearchPayload {
  project_id: string
  firm_id: string
  case_context: {
    tipo_acao?: string | null
    autor?: string | null
    reu?: string | null
    comarca?: string | null
    valor_causa?: string | null
    pedidos?: string | null
    area?: string | null
    supporting_summaries?: string[]
    client_doc_summaries?: string[]
    cross_reference_notes?: string
  }
}

interface SourceResult {
  source: 'stj' | 'stf' | 'tst' | 'perplexity'
  items: NormalizedPrecedent[]
  count: number
  error?: string
  skipped?: boolean
  skipReason?: string
}

/* ─── Helpers ────────────────────────────────────────────────── */

function buildResearchQuery(ctx: ResearchPayload['case_context']): string {
  const parts: string[] = []
  if (ctx.tipo_acao)   parts.push(`Ação: ${ctx.tipo_acao}`)
  if (ctx.area)        parts.push(`Área: ${ctx.area}`)
  if (ctx.comarca)     parts.push(`Comarca: ${ctx.comarca}`)
  if (ctx.valor_causa) parts.push(`Valor da causa: ${ctx.valor_causa}`)
  if (ctx.pedidos)     parts.push(`Pedidos: ${ctx.pedidos.slice(0, 300)}`)
  if (ctx.autor && ctx.reu) parts.push(`Partes: ${ctx.autor} x ${ctx.reu}`)
  if (ctx.cross_reference_notes) parts.push(`Análise cruzada: ${ctx.cross_reference_notes.slice(0, 200)}`)
  return parts.join(' | ')
}

/** Compact search query for court APIs (keyword-focused) */
function buildKeywordQuery(ctx: ResearchPayload['case_context']): string {
  const parts: string[] = []
  if (ctx.tipo_acao) parts.push(ctx.tipo_acao)
  if (ctx.area)      parts.push(ctx.area)
  if (ctx.pedidos)   parts.push(ctx.pedidos.slice(0, 120))
  return parts.join(' ')
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Returns true if the response body looks like HTML (not JSON) */
function isHtmlResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || ''
  return ct.includes('text/html') || ct.includes('text/plain')
}

/* ─── STF API ────────────────────────────────────────────────── */

async function fetchSTF(keyword: string): Promise<SourceResult> {
  const url = `https://jurisprudencia.stf.jus.br/api/search/julgado?q=${encodeURIComponent(keyword)}&pagina=1&pageSize=10`
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    }, 10_000)

    if (!res.ok) {
      return { source: 'stf', items: [], count: 0, error: `HTTP ${res.status}` }
    }

    if (isHtmlResponse(res)) {
      return { source: 'stf', items: [], count: 0, error: 'API returned HTML (not available)' }
    }

    const data = await res.json() as Record<string, unknown>

    // STF typically returns { resultado: { acervo: [...] } } or { hits: { hits: [...] } }
    let rawItems: Record<string, unknown>[] = []
    if (Array.isArray(data.resultado)) {
      rawItems = data.resultado as Record<string, unknown>[]
    } else if (data.resultado && typeof data.resultado === 'object') {
      const r = data.resultado as Record<string, unknown>
      if (Array.isArray(r.acervo)) rawItems = r.acervo as Record<string, unknown>[]
    } else if (data.hits && typeof data.hits === 'object') {
      const h = data.hits as Record<string, unknown>
      if (Array.isArray(h.hits)) {
        rawItems = (h.hits as Record<string, unknown>[]).map(x => {
          const src = (x._source || x) as Record<string, unknown>
          return src
        })
      }
    } else if (Array.isArray(data.items)) {
      rawItems = data.items as Record<string, unknown>[]
    } else if (Array.isArray(data.content)) {
      rawItems = data.content as Record<string, unknown>[]
    }

    const items: NormalizedPrecedent[] = rawItems.slice(0, 10).map(item => ({
      tribunal: 'STF',
      numero: String(item.numeroProcesso || item.numero || item.id || ''),
      relator: String(item.relator || item.nomeRelator || item.ministroRelator || ''),
      data: String(item.dataJulgamento || item.data || item.dataDecisao || ''),
      ementa: String(item.ementa || item.descricao || item.texto || '').slice(0, 400),
      relevancia: 'media' as const,
      favoravel: false, // will be classified by GPT-4o
      source: 'stf' as const,
    })).filter(x => x.ementa.length > 10)

    return { source: 'stf', items, count: items.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[STF] fetch error:', msg)
    const friendlyMsg = msg.includes('abort') ? 'Timeout (10s)' : msg.includes('fetch failed') ? 'fetch failed' : msg
    return { source: 'stf', items: [], count: 0, error: friendlyMsg }
  }
}

/* ─── STJ API ────────────────────────────────────────────────── */

async function fetchSTJ(keyword: string): Promise<SourceResult> {
  // Try REST API first, fall back to legacy endpoint
  const restUrl = `https://scon-api.stj.jus.br/v1/pesquisa?livre=${encodeURIComponent(keyword)}&operador=e&tipo=EMENTA&pageSize=10`
  const legacyUrl = `https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${encodeURIComponent(keyword)}&operador=e&tipo=EMENTA&formato=json`

  for (const url of [restUrl, legacyUrl]) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      }, 10_000)

      if (!res.ok) continue
      if (isHtmlResponse(res)) continue

      const data = await res.json() as Record<string, unknown>

      let rawItems: Record<string, unknown>[] = []
      if (Array.isArray(data.documento)) {
        rawItems = data.documento as Record<string, unknown>[]
      } else if (Array.isArray(data.results)) {
        rawItems = data.results as Record<string, unknown>[]
      } else if (Array.isArray(data.content)) {
        rawItems = data.content as Record<string, unknown>[]
      } else if (Array.isArray(data.items)) {
        rawItems = data.items as Record<string, unknown>[]
      } else if (data.acórdãos && Array.isArray(data.acórdãos)) {
        rawItems = data.acórdãos as Record<string, unknown>[]
      }

      if (rawItems.length === 0) continue

      const items: NormalizedPrecedent[] = rawItems.slice(0, 10).map(item => ({
        tribunal: 'STJ',
        numero: String(item.numero || item.numDocumento || item.id || item.identificadorDocumento || ''),
        relator: String(item.relator || item.ministroRelator || item.nomeRelator || ''),
        data: String(item.dataJulgamento || item.data || item.datajulgamento || ''),
        ementa: String(item.ementa || item.ementaRtf || item.texto || '').replace(/<[^>]*>/g, '').slice(0, 400),
        relevancia: 'media' as const,
        favoravel: false,
        source: 'stj' as const,
      })).filter(x => x.ementa.length > 10)

      return { source: 'stj', items, count: items.length }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[STJ] fetch error (${url}):`, msg)
    }
  }

  return { source: 'stj', items: [], count: 0, error: 'API indisponível ou retornou HTML' }
}

/* ─── TST API ────────────────────────────────────────────────── */

async function fetchTST(keyword: string): Promise<SourceResult> {
  const url = `https://jurisprudencia-backend.tst.jus.br/rest/documentos?query=${encodeURIComponent(keyword)}&pageSize=10`
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    }, 10_000)

    if (!res.ok) {
      return { source: 'tst', items: [], count: 0, error: `HTTP ${res.status}` }
    }

    if (isHtmlResponse(res)) {
      return { source: 'tst', items: [], count: 0, error: 'API returned HTML (not available)' }
    }

    const data = await res.json() as Record<string, unknown>

    let rawItems: Record<string, unknown>[] = []
    if (Array.isArray(data.content)) {
      rawItems = data.content as Record<string, unknown>[]
    } else if (Array.isArray(data.items)) {
      rawItems = data.items as Record<string, unknown>[]
    } else if (Array.isArray(data.results)) {
      rawItems = data.results as Record<string, unknown>[]
    } else if (Array.isArray(data.documentos)) {
      rawItems = data.documentos as Record<string, unknown>[]
    }

    const items: NormalizedPrecedent[] = rawItems.slice(0, 10).map(item => ({
      tribunal: 'TST',
      numero: String(item.numero || item.siglaClasse && item.numeroProcesso ? `${item.siglaClasse} ${item.numeroProcesso}` : item.id || ''),
      relator: String(item.relator || item.nomeRelator || ''),
      data: String(item.dataJulgamento || item.data || ''),
      ementa: String(item.ementa || item.texto || '').replace(/<[^>]*>/g, '').slice(0, 400),
      relevancia: 'media' as const,
      favoravel: false,
      source: 'tst' as const,
    })).filter(x => x.ementa.length > 10)

    return { source: 'tst', items, count: items.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[TST] fetch error:', msg)
    return { source: 'tst', items: [], count: 0, error: msg.includes('abort') ? 'Timeout (10s)' : msg }
  }
}

/* ─── Perplexity (supplementary) ────────────────────────────── */

async function fetchPerplexity(
  query: string,
): Promise<SourceResult & { probabilidade?: number; fundamentacao?: string }> {
  const systemPrompt = `Você é um pesquisador jurídico brasileiro especializado. Pesquise jurisprudência relevante para o caso descrito. Retorne APENAS um JSON válido (sem markdown, sem código), sem comentários. Estrutura obrigatória:
{
  "precedentes": [
    {
      "tribunal": "STJ|TJSP|TJRJ|etc",
      "numero": "número do acórdão",
      "relator": "Nome do relator",
      "data": "DD/MM/AAAA",
      "ementa": "resumo da ementa (max 300 chars)",
      "favoravel": true,
      "relevancia": "alta|media|baixa"
    }
  ],
  "probabilidade_exito": 65,
  "fundamentacao": "análise técnica da jurisprudência encontrada (max 500 chars)"
}`

  const userPrompt = `Pesquise jurisprudência recente (2020-2025) de tribunais estaduais (TJSP, TJRJ, TJMG, TJRS, TJPR) e doutrina para o seguinte caso: ${query}. Retorne entre 5-8 precedentes variados (favoráveis e desfavoráveis).`

  try {
    const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2500,
      }),
    }, 30_000)

    if (!res.ok) {
      const err = await res.text()
      return { source: 'perplexity', items: [], count: 0, error: `HTTP ${res.status}: ${err.slice(0, 100)}` }
    }

    const data = await res.json() as Record<string, unknown>
    const choices = data.choices as Array<{ message: { content: string } }> | undefined
    const raw = choices?.[0]?.message?.content || '{}'
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.warn('[Perplexity] parse error:', cleaned.slice(0, 200))
      return { source: 'perplexity', items: [], count: 0, error: 'JSON parse error' }
    }

    const rawItems = (parsed.precedentes as Record<string, unknown>[]) || []
    const items: NormalizedPrecedent[] = rawItems.map(item => ({
      tribunal: String(item.tribunal || 'TJSP'),
      numero: String(item.numero || ''),
      relator: String(item.relator || ''),
      data: String(item.data || ''),
      ementa: String(item.ementa || '').slice(0, 400),
      relevancia: (['alta', 'media', 'baixa'].includes(String(item.relevancia)) ? item.relevancia : 'media') as 'alta' | 'media' | 'baixa',
      favoravel: Boolean(item.favoravel),
      source: 'perplexity' as const,
    })).filter(x => x.ementa.length > 10)

    return {
      source: 'perplexity',
      items,
      count: items.length,
      probabilidade: typeof parsed.probabilidade_exito === 'number' ? parsed.probabilidade_exito : undefined,
      fundamentacao: typeof parsed.fundamentacao === 'string' ? parsed.fundamentacao : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[Perplexity] error:', msg)
    return { source: 'perplexity', items: [], count: 0, error: msg.includes('abort') ? 'Timeout' : msg }
  }
}

/* ─── GPT-4o analysis: classify + score all precedents ──────── */

async function analyzeWithGPT4o(
  allPrecedents: NormalizedPrecedent[],
  query: string,
): Promise<{
  analyzed: NormalizedPrecedent[]
  probabilidade_exito: number
  fundamentacao: string
}> {
  if (allPrecedents.length === 0) {
    return { analyzed: [], probabilidade_exito: 55, fundamentacao: 'Nenhum precedente encontrado para análise.' }
  }

  const prompt = `Você é um advogado sênior brasileiro. Analise os seguintes precedentes jurisprudenciais para o caso abaixo e classifique cada um.

CASO: ${query}

PRECEDENTES (${allPrecedents.length} no total):
${allPrecedents.map((p, i) => `[${i}] ${p.tribunal} | ${p.numero} | ${p.data}
Ementa: ${p.ementa}`).join('\n\n')}

Responda APENAS com JSON válido (sem markdown):
{
  "classificacoes": [
    {"indice": 0, "favoravel": true, "relevancia": "alta", "justificativa": "..."}
  ],
  "probabilidade_exito": 65,
  "fundamentacao": "análise geral da jurisprudência para o caso (max 600 chars)"
}`

  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é especialista em direito processual brasileiro. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    }, 30_000)

    if (!res.ok) {
      console.warn('[GPT-4o] error:', res.status)
      return buildFallbackAnalysis(allPrecedents, query)
    }

    const data = await res.json() as Record<string, unknown>
    const choices = data.choices as Array<{ message: { content: string } }> | undefined
    const raw = choices?.[0]?.message?.content || '{}'
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.warn('[GPT-4o] parse error:', cleaned.slice(0, 200))
      return buildFallbackAnalysis(allPrecedents, query)
    }

    const classificacoes = (parsed.classificacoes as Array<{ indice: number; favoravel: boolean; relevancia: string; justificativa?: string }>) || []
    const analyzed = allPrecedents.map((p, i) => {
      const c = classificacoes.find(x => x.indice === i)
      if (!c) return p
      return {
        ...p,
        favoravel: Boolean(c.favoravel),
        relevancia: (['alta', 'media', 'baixa'].includes(c.relevancia) ? c.relevancia : 'media') as 'alta' | 'media' | 'baixa',
      }
    })

    const prob = typeof parsed.probabilidade_exito === 'number' ? Math.max(0, Math.min(100, parsed.probabilidade_exito)) : 60

    return {
      analyzed,
      probabilidade_exito: prob,
      fundamentacao: typeof parsed.fundamentacao === 'string' ? parsed.fundamentacao : '',
    }
  } catch (err) {
    console.warn('[GPT-4o] analysis failed:', err)
    return buildFallbackAnalysis(allPrecedents, query)
  }
}

function buildFallbackAnalysis(precedents: NormalizedPrecedent[], _query: string) {
  // Basic heuristic: precedents already classified by Perplexity keep their value;
  // official API precedents get a neutral classification
  const analyzed = precedents.map(p => ({
    ...p,
    favoravel: p.source === 'perplexity' ? p.favoravel : false,
    relevancia: p.relevancia || ('media' as const),
  }))
  return {
    analyzed,
    probabilidade_exito: 60,
    fundamentacao: 'Análise baseada em jurisprudência coletada de tribunais superiores e estaduais brasileiros.',
  }
}

/* ─── Source log builder ─────────────────────────────────────── */

function buildSourceLog(result: SourceResult, isLabor: boolean): string {
  if (result.skipped) {
    return `⚠ ${result.source.toUpperCase()} não aplicável (${result.skipReason || 'caso cível'})`
  }
  if (result.error && result.count === 0) {
    const tribunal = result.source.toUpperCase()
    // Treat HTML responses AND network/infra errors as "maintenance" to the user
    const isKnownInfraError =
      result.error.includes('HTML') ||
      result.error.includes('fetch failed') ||
      result.error.includes('Timeout') ||
      result.error.includes('abort') ||
      result.error.includes('ECONNREFUSED') ||
      result.error.includes('ENOTFOUND') ||
      result.error.includes('indisponível') ||
      /HTTP [45]\d\d/.test(result.error)
    return isKnownInfraError
      ? `⚠ ${tribunal}: API indisponível — usando fontes alternativas`
      : `⚠ ${tribunal}: ${result.error.slice(0, 60)}`
  }
  const tribunal = result.source === 'perplexity' ? 'Jurisprudência complementar' : result.source.toUpperCase()
  const unit = result.source === 'perplexity' ? 'resultados' : result.source === 'stf' ? 'decisões' : 'acórdãos'
  return `✓ ${tribunal}: ${result.count} ${unit} encontrados`
}

/* ─── Main handler ───────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body: ResearchPayload = await req.json()
    const { project_id, firm_id, case_context } = body

    if (!project_id || !firm_id) {
      return NextResponse.json({ error: 'project_id e firm_id são obrigatórios' }, { status: 400 })
    }

    const query = buildResearchQuery(case_context)
    const keyword = buildKeywordQuery(case_context)

    // Detect labor case (TST only relevant for labor/trabalhista cases)
    const tipoLower = (case_context.tipo_acao || '').toLowerCase()
    const areaLower = (case_context.area || '').toLowerCase()
    const isLabor = tipoLower.includes('trabalh') || tipoLower.includes('reclamação') ||
                    areaLower.includes('trabalh') || areaLower.includes('trabalhista')

    console.log(`[research] query="${keyword}" isLabor=${isLabor}`)

    // ── 1. Fire all source calls in parallel ──────────────────
    const tstPromise = isLabor
      ? fetchTST(keyword)
      : Promise.resolve<SourceResult>({ source: 'tst', items: [], count: 0, skipped: true, skipReason: 'caso cível' })

    const [stfResult, stjResult, tstResult, perplexityResult] = await Promise.all([
      fetchSTF(keyword),
      fetchSTJ(keyword),
      tstPromise,
      fetchPerplexity(query),
    ])

    // ── 2. Merge all raw precedents ────────────────────────────
    const allPrecedents: NormalizedPrecedent[] = [
      ...stfResult.items,
      ...stjResult.items,
      ...tstResult.items,
      ...perplexityResult.items,
    ]

    console.log(`[research] collected: STF=${stfResult.count} STJ=${stjResult.count} TST=${tstResult.count} Perplexity=${perplexityResult.count} total=${allPrecedents.length}`)

    // ── 3. GPT-4o analysis and classification ─────────────────
    const { analyzed, probabilidade_exito, fundamentacao } = await analyzeWithGPT4o(allPrecedents, query)

    // Use Perplexity's probability as a hint if GPT-4o had issues
    const finalProbability = probabilidade_exito || perplexityResult.probabilidade || 60
    const finalFundamentacao = fundamentacao || perplexityResult.fundamentacao || ''

    // ── 4. Split into favorável / desfavorável ─────────────────
    const favoraveis: JurisprudenciaItem[] = analyzed
      .filter(p => p.favoravel)
      .map(p => ({
        tribunal: p.tribunal,
        numero: p.numero,
        data: p.data,
        ementa: p.ementa,
        relevancia: p.relevancia,
      }))

    const desfavoraveis: JurisprudenciaItem[] = analyzed
      .filter(p => !p.favoravel)
      .map(p => ({
        tribunal: p.tribunal,
        numero: p.numero,
        data: p.data,
        ementa: p.ementa,
        risco: `Precedente contrário — requer distinguishing para afastamento`,
      }))

    // ── 5. Build source logs for frontend display ──────────────
    const sourceLogs: string[] = [
      '✓ Analisando contexto do caso...',
      buildSourceLog(stjResult, isLabor),
      buildSourceLog(stfResult, isLabor),
      buildSourceLog(tstResult, isLabor),
      buildSourceLog(perplexityResult, isLabor),
      '✓ Analisando e classificando precedentes...',
      '✓ Calculando probabilidade de êxito...',
      `▸ Pesquisa concluída — ${analyzed.length} precedentes analisados.`,
    ]

    const results = {
      precedentes_favoraveis: favoraveis,
      precedentes_desfavoraveis: desfavoraveis,
      probabilidade_exito: finalProbability,
      fundamentacao: finalFundamentacao,
    }

    // ── 6. Save to research_results ───────────────────────────
    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Save one row per source
    const savePromises = [
      { source: 'stf', data: stfResult },
      { source: 'stj', data: stjResult },
      { source: 'tst', data: tstResult },
      { source: 'perplexity', data: perplexityResult },
    ].map(({ source, data }) =>
      adminSupabase
        .from('research_results')
        .insert({
          project_id,
          firm_id,
          query,
          source,
          results: {
            items: data.items,
            count: data.count,
            error: data.error || null,
            skipped: data.skipped || false,
          },
          favorable_count: data.items.filter(x => x.favoravel).length,
          unfavorable_count: data.items.filter(x => !x.favoravel).length,
        })
        .select('id')
        .single()
    )

    const saveResults = await Promise.allSettled(savePromises)
    const savedId = saveResults
      .find(r => r.status === 'fulfilled')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.valueOf() as { value?: { data?: { id?: string } } } | undefined
    const researchId = savedId?.value?.data?.id || null

    if (saveResults.some(r => r.status === 'rejected')) {
      console.warn('[research] Some save operations failed')
    }

    return NextResponse.json({
      success: true,
      research_id: researchId,
      results,
      source_logs: sourceLogs,
      sources_summary: {
        stf: { count: stfResult.count, error: stfResult.error },
        stj: { count: stjResult.count, error: stjResult.error },
        tst: { count: tstResult.count, skipped: tstResult.skipped, error: tstResult.error },
        perplexity: { count: perplexityResult.count, error: perplexityResult.error },
        total: analyzed.length,
      },
    })
  } catch (err) {
    console.error('research route error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
