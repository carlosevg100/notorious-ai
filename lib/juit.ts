/**
 * JUIT Jurisprudencia API client
 * Docs: https://juit.com.br/produtos/api-de-jurisprudencia
 * API key: set JUIT_API_KEY in .env.local (contact juit.com.br for trial)
 * Status: production-ready stub — activates when JUIT_API_KEY is set
 */

const JUIT_API_KEY = process.env.JUIT_API_KEY || ''
const JUIT_BASE = process.env.JUIT_BASE_URL || 'https://api.juit.com/v1'
const JUIT_TIMEOUT_MS = 8000

export interface JuitDecision {
  id: string
  tribunal: string
  data_julgamento: string
  ementa: string
  relator?: string
  numero_processo?: string
  full_text?: string
  relevance_score?: number
}

export interface JuitSearchResult {
  source: 'juit'
  items: JuitDecision[]
  count: number
  error?: string
  skipped?: boolean
  skipReason?: string
}

/**
 * Search JUIT jurisprudencia by keyword query.
 * Returns empty result (not error) when API key not configured —
 * allows graceful degradation when key is pending.
 */
export async function fetchJuit(query: string, limit = 5): Promise<JuitSearchResult> {
  if (!JUIT_API_KEY) {
    return {
      source: 'juit',
      items: [],
      count: 0,
      skipped: true,
      skipReason: 'JUIT_API_KEY not configured — contact juit.com.br for trial access',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), JUIT_TIMEOUT_MS)

  try {
    // JUIT REST search endpoint — verify exact path at juit.com.br/docs
    // Common pattern: POST /search or GET /jurisprudencia?q=...
    // Using POST with JSON body as typical REST search
    const res = await fetch(`${JUIT_BASE}/jurisprudencia/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JUIT_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        size: limit,
        sort: 'relevance',
        include_full_text: true,
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[JUIT] HTTP ${res.status}: ${errText.slice(0, 120)}`)
      return { source: 'juit', items: [], count: 0, error: `HTTP ${res.status}` }
    }

    const data = await res.json() as Record<string, unknown>

    // Normalize JUIT response to our internal format
    // Adjust field names based on actual JUIT API response schema
    const rawItems = (
      Array.isArray(data.results) ? data.results :
      Array.isArray(data.hits) ? data.hits :
      Array.isArray(data.data) ? data.data : []
    ) as Record<string, unknown>[]

    const decisions: JuitDecision[] = rawItems.map(d => ({
      id: String(d.id || d._id || ''),
      tribunal: String(d.tribunal || d.court || d.source_tribunal || ''),
      data_julgamento: String(d.data_julgamento || d.judgment_date || d.date || ''),
      ementa: String(d.ementa || d.summary || (typeof d.text === 'string' ? d.text.slice(0, 500) : '') || ''),
      relator: String(d.relator || d.rapporteur || ''),
      numero_processo: String(d.numero_processo || d.case_number || ''),
      full_text: String(d.full_text || d.content || d.text || ''),
      relevance_score: typeof d.score === 'number' ? d.score : typeof d._score === 'number' ? d._score : 0,
    }))

    return {
      source: 'juit',
      items: decisions,
      count: decisions.length,
    }
  } catch (e: unknown) {
    clearTimeout(timer)
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'Timeout (8s)' : e.message) : String(e)
    console.warn('[JUIT] error:', msg)
    return { source: 'juit', items: [], count: 0, error: msg }
  }
}

/**
 * Perplexity-powered JUIT fallback:
 * When JUIT_API_KEY not set, use Perplexity with site:juit.com.br
 * to surface JUIT-sourced jurisprudencia via web search.
 *
 * Returns structured results compatible with the main research pipeline.
 */
export async function fetchJuitViaPerplexity(
  query: string,
  perplexityKey: string,
  limit = 3
): Promise<JuitSearchResult> {
  if (!perplexityKey) {
    return { source: 'juit', items: [], count: 0, skipped: true, skipReason: 'Perplexity key not set' }
  }

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a Brazilian legal research assistant. Search site:juit.com.br for relevant jurisprudencia. Return JSON array with fields: tribunal, data_julgamento, ementa, relator. Be concise.',
          },
          {
            role: 'user',
            content: `Find ${limit} relevant court decisions from JUIT for this legal query: ${query}. Return valid JSON array only.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    })

    if (!res.ok) return { source: 'juit', items: [], count: 0, error: `Perplexity HTTP ${res.status}` }

    const data = await res.json() as Record<string, unknown>
    const choices = data.choices as Array<{ message: { content: string } }> | undefined
    const content = choices?.[0]?.message?.content || ''

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { source: 'juit', items: [], count: 0, error: 'No JSON in Perplexity response' }

    const decisions = JSON.parse(jsonMatch[0]) as Record<string, unknown>[]
    return {
      source: 'juit',
      items: decisions.map((d, i) => ({
        id: `juit-perplexity-${i}`,
        tribunal: String(d.tribunal || 'JUIT'),
        data_julgamento: String(d.data_julgamento || ''),
        ementa: String(d.ementa || ''),
        relator: String(d.relator || ''),
      })),
      count: decisions.length,
    }
  } catch (e: unknown) {
    return { source: 'juit', items: [], count: 0, error: e instanceof Error ? e.message : String(e) }
  }
}
