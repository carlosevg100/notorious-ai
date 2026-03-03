import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  if (!query.trim()) return NextResponse.json({ results: [], source: 'empty' })

  // Try STF API first
  try {
    const stfUrl = `https://jurisprudencia.stf.jus.br/api/search?query=${encodeURIComponent(query)}&pageSize=5`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const stfRes = await fetch(stfUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (stfRes.ok) {
      const data = await stfRes.json()
      const hits = data?.result?.hits?.hits || data?.hits?.hits || data?.results || []
      if (hits.length > 0) {
        const results = hits.map((hit: any) => {
          const src = hit._source || hit
          return {
            tribunal: src.tribunal || src.orgaoJulgador || 'STF',
            numero_processo: src.numeroProcesso || src.numero || hit._id || '',
            data: src.dataJulgamento || src.dataPublicacao || src.data || '',
            relator: src.relator || src.nomeRelator || '',
            ementa: src.ementa || src.texto || src.docEmentaHtml || '',
            source: 'STF'
          }
        })
        return NextResponse.json({ results, source: 'STF' })
      }
    }
  } catch (_) {
    // fallthrough to AI
  }

  // Fallback: OpenAI generates realistic results
  const openai = getOpenAI()
  const prompt = `Você é um especialista em jurisprudência brasileira. Para a pesquisa jurídica sobre: "${query}"

Gere 5 resultados de jurisprudência brasileira realistas e relevantes em formato JSON:
{
  "results": [
    {
      "tribunal": "string (STF, STJ, TST, TRF1, TRF2, TRF3, TRF4, TRF5, TJSP, TJRJ, etc.)",
      "numero_processo": "string (número processual no formato correto do tribunal)",
      "data": "string (data de julgamento no formato DD/MM/AAAA)",
      "relator": "string (nome do Min. ou Des. Relator)",
      "ementa": "string (ementa completa e detalhada de pelo menos 200 palavras, em linguagem técnico-jurídica)"
    }
  ]
}

Os resultados devem ser juridicamente precisos, com ementas detalhadas, datas verossímeis (entre 2018-2025), e tribunais apropriados para o tema pesquisado. Retorne APENAS o JSON válido.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 3000
  })

  const content = response.choices[0].message.content
  if (!content) return NextResponse.json({ results: [], source: 'ai' })

  const parsed = JSON.parse(content)
  const results = (parsed.results || []).map((r: any) => ({ ...r, source: 'IA' }))
  return NextResponse.json({ results, source: 'IA' })
}
