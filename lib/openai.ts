import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function extractDocumentData(text: string) {
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

export async function chatWithContext(
  message: string,
  projectName: string,
  projectArea: string,
  documents: Array<{ name: string; extraction: any }>
) {
  const docsContext = documents.map(d => {
    const ext = d.extraction
    return `Documento: ${d.name}
Tipo: ${ext?.doc_type || 'N/A'}
Partes: ${(ext?.parties || []).join(', ')}
Resumo: ${ext?.summary || 'N/A'}
Prazos: ${(ext?.deadlines || []).map((dl: any) => `${dl.date}: ${dl.description}`).join('; ')}
Riscos: ${(ext?.risk_flags || []).map((r: any) => `${r.severity}: ${r.description}`).join('; ')}`
  }).join('\n\n---\n\n')

  const systemPrompt = `Você é um assistente jurídico de IA especializado em direito brasileiro. 
Você está trabalhando no caso: "${projectName}" (área: ${projectArea}).
Responda SEMPRE em português brasileiro. Seja preciso, objetivo e profissional.
Base seu raciocínio nos documentos disponíveis quando relevante.

DOCUMENTOS DO CASO:
${docsContext || 'Nenhum documento carregado ainda.'}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_tokens: 2000
  })
  
  return response.choices[0].message.content || ''
}

export async function generateLegalDraft(params: {
  docType: string
  area: string
  clientPosition: string
  facts: string
}) {
  const prompt = `Você é um advogado sênior brasileiro especialista em ${params.area}.
Elabore um ${params.docType} completo e profissional em português brasileiro.

Posição do cliente: ${params.clientPosition}
Fatos relevantes: ${params.facts}

O documento deve:
- Seguir as normas processuais brasileiras vigentes
- Ter estrutura formal adequada (cabeçalho, qualificação das partes, fatos, fundamentos, pedidos)
- Citar legislação e jurisprudência relevante quando aplicável
- Ter linguagem técnico-jurídica adequada
- Ser completo e profissional

Elabore o documento agora:`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000
  })
  
  return response.choices[0].message.content || ''
}
