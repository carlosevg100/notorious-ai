import { NextRequest, NextResponse } from 'next/server'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo PDF não fornecido' }, { status: 400 })
    }

    // Convert file to buffer and extract text via pdf-parse
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let pdfText = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      pdfText = parsed.text || ''
    } catch (err) {
      console.error('pdf-parse error:', err)
      pdfText = '[Não foi possível extrair texto do PDF]'
    }

    // Truncate to ~12000 chars to stay within token limits
    const truncatedText = pdfText.slice(0, 12000)

    // Call OpenAI to extract legal fields
    const prompt = `Você é um assistente jurídico especializado em direito brasileiro. Analise o texto abaixo extraído de uma petição inicial ou documento jurídico e extraia as informações solicitadas no formato JSON.

TEXTO DO DOCUMENTO:
${truncatedText}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com a seguinte estrutura:
{
  "numero_processo": "número CNJ no formato 0000000-00.0000.0.00.0000 ou null se não encontrado",
  "nome_processo": "nome descritivo breve do processo/ação (máx 80 chars)",
  "tipo_acao": "tipo da ação (ex: Ação de Indenização, Ação Trabalhista, etc.)",
  "autor": "nome do(s) autor(es)/requerente(s)",
  "reu": "nome do(s) réu(s)/requerido(s)",
  "vara": "vara judicial (ex: 3ª Vara Cível)",
  "comarca": "comarca (ex: São Paulo - SP)",
  "valor_causa": "valor da causa como string (ex: R$ 50.000,00 ou null)",
  "pedidos": "resumo dos pedidos principais (máx 300 chars)",
  "prazos": "prazos identificados no documento (máx 200 chars) ou null",
  "tipo": "trabalhista | tributario | contencioso | consultivo",
  "area": "área do direito (ex: Cível, Trabalhista, Tributário, Criminal)"
}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('OpenAI error:', err)
      return NextResponse.json({ error: 'Falha na extração AI' }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'

    // Parse JSON response
    let extracted: Record<string, string | null> = {}
    try {
      // Strip markdown code blocks if present
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse AI response:', rawContent)
      extracted = {
        numero_processo: null,
        nome_processo: 'Processo sem título',
        tipo_acao: null,
        autor: null,
        reu: null,
        vara: null,
        comarca: null,
        valor_causa: null,
        pedidos: null,
        prazos: null,
        tipo: 'contencioso',
        area: 'Cível',
      }
    }

    return NextResponse.json({ success: true, extracted })
  } catch (err) {
    console.error('extract-pdf error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
