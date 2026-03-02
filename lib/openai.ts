import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })
}

export async function extractDocumentData(text: string) {
  const openai = getOpenAI()
  const prompt = `Você é um analista jurídico sênior brasileiro. Analise este documento e extraia em formato JSON:
{
  "doc_type": "string (tipo do documento jurídico em português)",
  "parties": ["string (todas as partes mencionadas)"],
  "key_dates": [{"date": "string", "description": "string"}],
  "deadlines": [{"date": "string", "description": "string", "urgency": "alta|media|baixa"}],
  "risk_flags": [{"description": "string", "severity": "alto|medio|baixo"}],
  "summary": "string (resumo de 200 palavras em português)"
}
Retorne APENAS o JSON válido, sem texto adicional.
Conteúdo do documento: ${text.substring(0, 8000)}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2000
  })
  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content)
}

export async function chatWithContext(message: string, projectName: string, projectArea: string, documents: Array<{ name: string; extraction: any }>) {
  const openai = getOpenAI()
  const docsContext = documents.map(d => {
    const ext = d.extraction
    return `Documento: ${d.name}\nTipo: ${ext?.doc_type || 'N/A'}\nPartes: ${(ext?.parties || []).join(', ')}\nResumo: ${ext?.summary || 'N/A'}\nPrazos: ${(ext?.deadlines || []).map((dl: any) => `${dl.date}: ${dl.description}`).join('; ')}\nRiscos: ${(ext?.risk_flags || []).map((r: any) => `${r.severity}: ${r.description}`).join('; ')}`
  }).join('\n\n---\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `Você é um assistente jurídico de IA especializado em direito brasileiro. Caso: "${projectName}" (área: ${projectArea}). Responda SEMPRE em português brasileiro.\n\nDOCUMENTOS:\n${docsContext || 'Nenhum documento carregado.'}` },
      { role: 'user', content: message }
    ],
    max_tokens: 2000
  })
  return response.choices[0].message.content || ''
}

export async function generateLegalDraft(params: { docType: string; area: string; clientPosition: string; facts: string }) {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: `Você é um advogado sênior brasileiro especialista em ${params.area}. Elabore um ${params.docType} completo e profissional em português brasileiro.\n\nPosição do cliente: ${params.clientPosition}\nFatos relevantes: ${params.facts}\n\nO documento deve seguir as normas processuais brasileiras, ter estrutura formal adequada e linguagem técnico-jurídica. Elabore agora:` }],
    max_tokens: 4000
  })
  return response.choices[0].message.content || ''
}
