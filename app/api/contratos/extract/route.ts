import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

async function extractText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await pdfParse(buffer)
    return parsed.text
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    return await file.text()
  } else {
    const mammoth = await import('mammoth')
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
}

async function analyzeContract(text: string) {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Você é um analista jurídico sênior especialista em contratos brasileiros e perito em detecção de fraudes. Analise este contrato e retorne um JSON com:
{
  "summary": "string (resumo de 150 palavras em português)",
  "parties": [{"name": "string", "role": "string"}],
  "contract_type": "string (Prestacao de Servicos|Locacao|Compra e Venda|Trabalhista|Societario|NDA|Financiamento|Franquia|Outros)",
  "start_date": "string (YYYY-MM-DD ou null)",
  "end_date": "string (YYYY-MM-DD ou null)",
  "value": "number ou null",
  "auto_renew": "boolean",
  "key_obligations": ["string"],
  "penalties": ["string"],
  "termination_clauses": ["string"],
  "confidentiality": "boolean",
  "non_compete": "boolean",
  "governing_law": "string",
  "dispute_resolution": "string",
  "risk_level": "alto|medio|baixo",
  "risk_flags": [{"description": "string", "severity": "alto|medio|baixo"}],
  "fraud_risk": {
    "detected": "boolean",
    "confidence": "alto|medio|baixo",
    "indicators": ["string"]
  }
}
Analise especificamente para fraude: inconsistências de datas, cláusulas contraditórias, alterações suspeitas, signatários inválidos, assinaturas divergentes, valores inconsistentes.
Retorne APENAS JSON válido.
Contrato: ${text.substring(0, 8000)}`
    }],
    response_format: { type: 'json_object' },
    max_tokens: 2000
  })
  return JSON.parse(response.choices[0].message.content || '{}')
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000)
  })
  return response.data[0].embedding
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const contractId = formData.get('contractId') as string

    if (!file || !contractId) {
      return NextResponse.json({ error: 'Missing file or contractId' }, { status: 400 })
    }

    // Extract text
    let text = ''
    try {
      text = await extractText(file)
    } catch (e) {
      text = `Documento: ${file.name}`
    }
    if (!text.trim()) text = `Documento: ${file.name}`

    // AI analysis
    const extraction = await analyzeContract(text)

    // Generate embedding
    let embedding: number[] = []
    try {
      embedding = await generateEmbedding(extraction.summary || text)
    } catch (e) {}

    // Get contract's firm_id
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('firm_id')
      .eq('id', contractId)
      .single()

    // Save extraction
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('contract_extractions')
      .insert({
        contract_id: contractId,
        summary: extraction.summary,
        key_obligations: extraction.key_obligations || [],
        penalties: extraction.penalties || [],
        termination_clauses: extraction.termination_clauses || [],
        confidentiality: extraction.confidentiality || false,
        non_compete: extraction.non_compete || false,
        governing_law: extraction.governing_law || null,
        dispute_resolution: extraction.dispute_resolution || null,
        risk_level: extraction.risk_level || 'baixo',
        risk_flags: extraction.risk_flags || [],
        fraud_risk: extraction.fraud_risk || null,
        raw_extraction: { ...extraction, embedding }
      })
      .select()
      .single()

    if (saveErr) throw saveErr

    // Update contract with extracted data
    const updatePayload: any = { updated_at: new Date().toISOString() }
    if (extraction.parties?.length) updatePayload.parties = extraction.parties
    if (extraction.start_date) updatePayload.start_date = extraction.start_date
    if (extraction.end_date) updatePayload.end_date = extraction.end_date
    if (extraction.value) updatePayload.value = extraction.value
    if (extraction.auto_renew !== undefined) updatePayload.auto_renew = extraction.auto_renew
    if (extraction.contract_type) updatePayload.contract_type = extraction.contract_type

    await supabaseAdmin.from('contracts').update(updatePayload).eq('id', contractId)

    // Create alerts
    if (contract) {
      const alerts: any[] = []

      // Vencimento alert if end_date within 90 days
      if (extraction.end_date) {
        const end = new Date(extraction.end_date)
        const today = new Date()
        const diff = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diff >= 0 && diff <= 90) {
          alerts.push({
            firm_id: contract.firm_id,
            contract_id: contractId,
            type: 'vencimento',
            message: `⏰ Contrato vence em ${diff} dias (${extraction.end_date})`,
            alert_date: extraction.end_date,
            is_read: false
          })
        }
      }

      // Fraud alert
      if (extraction.fraud_risk?.detected === true) {
        const indicators = (extraction.fraud_risk.indicators || []).join('; ')
        alerts.push({
          firm_id: contract.firm_id,
          contract_id: contractId,
          type: 'fraude',
          message: `🚨 Risco de fraude detectado (confiança: ${extraction.fraud_risk.confidence}): ${indicators}`,
          alert_date: new Date().toISOString().split('T')[0],
          is_read: false
        })
      }

      if (alerts.length > 0) {
        await supabaseAdmin.from('contract_alerts').insert(alerts)
      }
    }

    return NextResponse.json({ extraction: saved })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
