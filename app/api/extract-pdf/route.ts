import { NextRequest, NextResponse } from 'next/server'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

/* ─── Prompts ───────────────────────────────────────────────── */

const PETICAO_PROMPT = (text: string) => `Você é um assistente jurídico especializado em direito brasileiro. Analise o texto abaixo extraído de uma petição inicial e extraia TODAS as informações solicitadas no formato JSON.

TEXTO DO DOCUMENTO:
${text}

INSTRUÇÕES CRÍTICAS — LEIA ANTES DE EXTRAIR:

1. QUALIFICAÇÃO DAS PARTES: Petições iniciais brasileiras SEMPRE contêm a qualificação completa das partes no início do documento — CPF, RG, nacionalidade, estado civil, profissão, data de nascimento, endereço completo e contato. Extraia TODOS esses dados sem exceção.

2. ADVOGADOS: Extraia nome completo, número OAB, seccional, escritório, endereço, email e telefone de todos os advogados mencionados.

3. VALORES — REGRAS ABSOLUTAS ANTI-ALUCINAÇÃO:
   - Extraia EXATAMENTE os valores que constam no documento. NÃO invente valores. NÃO estime. NÃO agrupe.
   - Se a petição tem uma seção "Dos Danos", "Do Valor da Causa", "Dos Pedidos" ou qualquer tabela de valores, extraia CADA linha exatamente como descrita no texto.
   - Cada item em valores_pleiteados deve ter: o nome EXATO do dano/item como está escrito no documento e o valor EXATO em R$ como está escrito.
   - NUNCA adicione itens que não estão explicitamente escritos no documento.
   - NUNCA invente valores como "multa diária", "honorários", "juros" se eles não constam expressamente nos pedidos de valor.
   - Após listar os itens, verifique se a soma bate com o valor_causa. Se não bater, revise os itens antes de responder.

Retorne APENAS um JSON válido (sem markdown, sem explicações) com a seguinte estrutura:
{
  "numero_processo": "número CNJ no formato 0000000-00.0000.0.00.0000 ou null se não encontrado",
  "nome_processo": "nome descritivo breve do processo/ação (máx 80 chars)",
  "tipo_acao": "tipo da ação (ex: Ação de Indenização por Danos, Ação de Cobrança, etc.)",
  "autor": {
    "nome": "nome completo do(a) autor(a)/requerente(s)",
    "cpf_cnpj": "CPF ou CNPJ exatamente como escrito, ou null",
    "rg": "número do RG exatamente como escrito, ou null",
    "nacionalidade": "nacionalidade se mencionada (ex: brasileiro(a)), ou null",
    "estado_civil": "estado civil se mencionado (ex: solteiro, casado, divorciado), ou null",
    "profissao": "profissão se mencionada, ou null",
    "data_nascimento": "data de nascimento DD/MM/AAAA se mencionada, ou null",
    "email": "email se mencionado, ou null",
    "endereco_completo": "endereço completo se mencionado (rua, número, bairro, cidade, estado, CEP), ou null",
    "telefone": "telefone se mencionado, ou null"
  },
  "advogado_autor": {
    "nome": "nome completo do advogado do autor, ou null",
    "oab": "número OAB (apenas o número), ou null",
    "seccional": "estado da seccional (ex: SP, RJ), ou null",
    "escritorio": "nome do escritório se mencionado, ou null",
    "endereco": "endereço do escritório se mencionado, ou null",
    "email": "email profissional se mencionado, ou null",
    "telefone": "telefone profissional se mencionado, ou null"
  },
  "reu": {
    "nome": "nome completo do(a) réu(é)/requerido(a)",
    "cpf_cnpj": "CPF ou CNPJ exatamente como escrito, ou null",
    "rg": "número do RG exatamente como escrito, ou null",
    "nacionalidade": "nacionalidade se mencionada, ou null",
    "estado_civil": "estado civil se mencionado, ou null",
    "profissao": "profissão se mencionada, ou null",
    "data_nascimento": "data de nascimento DD/MM/AAAA se mencionada, ou null",
    "email": "email se mencionado, ou null",
    "endereco_completo": "endereço completo se mencionado, ou null",
    "telefone": "telefone se mencionado, ou null",
    "representante_legal": "nome do representante legal se pessoa jurídica, ou null",
    "cargo_representante": "cargo do representante, ou null"
  },
  "advogado_reu": {
    "nome": "nome do advogado do réu se mencionado, ou null",
    "oab": "número OAB se mencionado, ou null",
    "seccional": "seccional se mencionada, ou null"
  },
  "vara": "vara judicial (ex: 3ª Vara Cível) ou null",
  "comarca": "comarca (ex: São Paulo - SP) ou null",
  "valor_causa": "valor total da causa como string exatamente como escrita (ex: R$ 34.500,00) ou null",
  "valores_pleiteados": [
    {
      "item": "nome EXATO do item de dano/pedido como escrito na petição — não renomeie, não agrupe",
      "valor": "R$ X.XXX,XX exatamente como escrito no documento"
    }
  ],
  "pedidos": "resumo dos pedidos principais (máx 300 chars)",
  "prazos": "prazos identificados no documento (máx 200 chars) ou null",
  "tipo": "trabalhista | tributario | contencioso | consultivo",
  "area": "área do direito (ex: Cível, Trabalhista, Tributário, Criminal)",
  "objeto_acao": "descrição do objeto central da disputa (ex: veículo Marca/Modelo/Ano Placa XXX, imóvel Rua X nº Y, contrato nº Z)",
  "fatos_principais": ["fato relevante 1 narrado pelo autor", "fato relevante 2"],
  "fundamentos_legais": ["Art. X do Código Y — descrição", "Lei N XXXX/XXXX"]
}`

const SUPPORTING_DOC_PROMPT = (text: string, category: string) => `Você é um assistente jurídico especializado em direito brasileiro. Analise o texto abaixo extraído de um documento de suporte jurídico (categoria: ${category}) e extraia as informações no formato JSON.

TEXTO DO DOCUMENTO:
${text}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com a seguinte estrutura:
{
  "doc_type": "tipo confirmado do documento (ex: Contrato, Procuração, Laudo Pericial, etc.)",
  "summary": "resumo do conteúdo principal do documento em até 300 caracteres",
  "resumo_executivo": "resumo executivo em 2-3 frases objetivas descrevendo o conteúdo principal, partes envolvidas e aspectos mais relevantes do documento",
  "pontos_principais": [
    "ponto principal 1 — fato, cláusula, data ou valor relevante",
    "ponto principal 2",
    "ponto principal 3"
  ],
  "parties": [
    { "name": "nome da parte", "role": "papel no documento (ex: Contratante, Contratado, Outorgante, Procurador)" }
  ],
  "key_dates": [
    { "date": "DD/MM/AAAA ou período", "description": "descrição do evento/data" }
  ],
  "deadlines": [
    { "date": "DD/MM/AAAA", "description": "descrição do prazo", "urgency": "alta | media | baixa" }
  ],
  "risk_flags": [
    { "severity": "alto | medio | baixo", "description": "descrição do risco ou irregularidade identificada" }
  ],
  "relevant_clauses": "principais cláusulas ou disposições relevantes para o caso (máx 400 chars)",
  "connection_to_case": "como este documento se conecta/sustenta o caso principal (máx 200 chars)"
}`

/* ─── Handler ───────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const documentCategory = (formData.get('document_category') as string) || 'Petição Inicial'

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

    const isPeticao = documentCategory === 'Petição Inicial'
    const prompt = isPeticao
      ? PETICAO_PROMPT(truncatedText)
      : SUPPORTING_DOC_PROMPT(truncatedText, documentCategory)

    // Call OpenAI to extract legal fields
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,          // zero temperature = zero hallucination for extraction
        max_tokens: isPeticao ? 2500 : 1200,
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
    let extracted: Record<string, unknown> = {}
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse AI response:', rawContent)
      if (isPeticao) {
        extracted = {
          numero_processo: null,
          nome_processo: 'Processo sem título',
          tipo_acao: null,
          autor: null,
          advogado_autor: null,
          reu: null,
          advogado_reu: null,
          vara: null,
          comarca: null,
          valor_causa: null,
          valores_pleiteados: [],
          pedidos: null,
          prazos: null,
          tipo: 'contencioso',
          area: 'Cível',
          objeto_acao: null,
          fatos_principais: [],
          fundamentos_legais: [],
        }
      } else {
        extracted = {
          doc_type: documentCategory,
          summary: 'Não foi possível extrair o conteúdo do documento.',
          resumo_executivo: null,
          pontos_principais: [],
          parties: [],
          key_dates: [],
          deadlines: [],
          risk_flags: [],
          relevant_clauses: null,
          connection_to_case: null,
        }
      }
    }

    // For petição, include raw text preview so analyze-case can cross-reference
    if (isPeticao) {
      extracted.raw_text_preview = truncatedText.slice(0, 8000)
    }

    return NextResponse.json({
      success: true,
      extracted,
      document_category: documentCategory,
      is_peticao: isPeticao,
    })
  } catch (err) {
    console.error('extract-pdf error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
