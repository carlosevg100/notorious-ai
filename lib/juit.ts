// JUIT API client — jurisprudência (case law research)
// Docs: https://juit.com.br/produtos/api-de-jurisprudencia
// API key: set JUIT_API_KEY in .env.local
// Status: PENDING (Cadu contacting JUIT for trial access)

const JUIT_KEY = process.env.JUIT_API_KEY || ''
const JUIT_BASE = process.env.JUIT_BASE_URL || 'https://api.juit.com/v1'

export interface JuitDecision {
  id: string
  tribunal: string
  date: string
  ementa: string
  relator: string
  fullText?: string
}

// Search jurisprudência by natural language query
export async function searchJurisprudencia(query: string, limit = 5): Promise<JuitDecision[]> {
  if (!JUIT_KEY) {
    console.warn('JUIT_API_KEY not configured — jurisprudência search unavailable')
    return []
  }
  // TODO: implement after receiving API key from JUIT
  // endpoint TBD based on their documentation
  return []
}
