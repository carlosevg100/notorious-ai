// JUDIT API client — process consultation and monitoring
// Docs: https://docs.judit.io
// API key: set JUDIT_API_KEY in .env.local

const JUDIT_BASE = process.env.JUDIT_BASE_URL || 'https://prod.judit.io/v1'
const JUDIT_KEY = process.env.JUDIT_API_KEY || ''

export interface JuditProcess {
  cnj: string
  court: string
  parties: { name: string; role: string }[]
  lastMovement: { date: string; description: string }
  movements: { date: string; description: string; type: string }[]
  status: string
  distribution: string
  value?: number
  instance: string
}

export interface JuditSearchResult {
  total: number
  processes: JuditProcess[]
}

// Fetch process by CNJ number
export async function fetchProcessByCNJ(cnj: string): Promise<JuditProcess | null> {
  if (!JUDIT_KEY) {
    console.warn('JUDIT_API_KEY not set — returning mock data')
    return getMockProcess(cnj)
  }

  try {
    const res = await fetch(
      `${JUDIT_BASE}/lawsuits/search?query_type=lawsuit_cnj&query=${encodeURIComponent(cnj)}`,
      {
        headers: { 'api_key': JUDIT_KEY, 'Content-Type': 'application/json' },
        next: { revalidate: 3600 }, // cache 1h
      }
    )
    if (!res.ok) throw new Error(`JUDIT API ${res.status}`)
    const data = await res.json()
    return data?.results?.[0] ?? null
  } catch (e) {
    console.error('JUDIT fetchProcessByCNJ error:', e)
    return null
  }
}

// Get recent movements for a CNJ
export async function fetchProcessMovements(cnj: string): Promise<{ date: string; description: string }[]> {
  if (!JUDIT_KEY) return getMockMovements()

  try {
    const res = await fetch(
      `${JUDIT_BASE}/lawsuits/search?query_type=lawsuit_cnj&query=${encodeURIComponent(cnj)}&response_type=lawsuit_updates`,
      {
        headers: { 'api_key': JUDIT_KEY },
        next: { revalidate: 1800 },
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data?.results?.[0]?.movements ?? []
  } catch {
    return []
  }
}

// Mock data for development (when no API key)
function getMockProcess(cnj: string): JuditProcess {
  return {
    cnj,
    court: 'TJSP — 1ª Vara Cível',
    parties: [
      { name: 'Autor Exemplo', role: 'Autor' },
      { name: 'Réu Exemplo', role: 'Réu' },
    ],
    lastMovement: { date: new Date().toISOString(), description: 'Conclusos ao juiz para sentença' },
    movements: [
      { date: new Date(Date.now() - 86400000).toISOString(), description: 'Contestação juntada', type: 'document' },
      { date: new Date(Date.now() - 172800000).toISOString(), description: 'Citação realizada', type: 'decision' },
    ],
    status: 'Em andamento',
    distribution: '2023-01-15',
    value: 25000,
    instance: '1ª Instância',
  }
}

function getMockMovements() {
  return [
    { date: new Date().toISOString(), description: 'Conclusos ao juiz [MOCK]' },
    { date: new Date(Date.now() - 86400000).toISOString(), description: 'Contestação juntada [MOCK]' },
  ]
}
