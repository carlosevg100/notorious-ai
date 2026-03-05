import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'

export interface DocumentoNecessario {
  documento: string
  motivo: string
  prioridade: 'alta' | 'media' | 'baixa'
}

export interface AdvogadoDetalhado {
  nome: string
  oab: string
  seccional: string
  escritorio: string
  endereco: string
  email: string
  telefone: string
}

export interface ParteDetalhada {
  nome: string
  cpf_cnpj: string
  rg: string
  nacionalidade: string
  estado_civil: string
  profissao: string
  data_nascimento: string
  email: string
  endereco: {
    rua: string
    numero: string
    bairro: string
    cidade: string
    estado: string
    cep: string
  }
  telefone: string
  outras_info: string
  advogados: AdvogadoDetalhado[]
}

export interface ObjetoDetalhe {
  campo: string
  valor: string
}

export interface ValorItem {
  descricao: string
  valor: string
  fundamento: string
}

export interface ProvaFornecida {
  documento: string
  tipo: string
  resumo: string
  conteudo_principal: string
  como_autor_usa: string
  tese_que_embasa: string
  pontos_de_atencao: string
}

export interface CaseAnalysis {
  dados_processo: {
    numero_cnj: string
    juiz: string
    comarca: string
    vara: string
    localizacao: string
    data_distribuicao: string
  }
  partes: {
    autor: ParteDetalhada
    reu: ParteDetalhada
  }
  objeto_da_acao: {
    tipo: string
    descricao: string
    detalhes: ObjetoDetalhe[]
  }
  valores: {
    itens: ValorItem[]
    total: string
  }
  alegacao_principal: string
  fatos_narrados: string[]
  fundamento_juridico: {
    base_legal: string[]
    teses: string[]
    pedidos: string[]
  }
  provas_fornecidas: ProvaFornecida[]
  datas_importantes: Array<{ data: string; evento: string }>
  prazo_contestacao: string
  documentos_necessarios_cliente: DocumentoNecessario[]
  risco_preliminar: 'baixo' | 'medio' | 'alto'
}

interface SupportingDoc {
  fileName: string
  category: string
  extracted: Record<string, unknown>
}

interface AnalyzeCasePayload {
  project_id: string
  firm_id: string
  peticao_extracted: Record<string, unknown>
  supporting_docs: SupportingDoc[]
}

function buildPrompt(peticao: Record<string, unknown>, docs: SupportingDoc[]): string {
  const docsSection = docs.length > 0
    ? docs.map(d => `\n[${d.category} — ${d.fileName}]\n${JSON.stringify(d.extracted, null, 2)}`).join('\n')
    : '(nenhum documento de suporte)'

  return `Você é um advogado sênior brasileiro especializado em direito processual civil. Analise os documentos da parte autora abaixo e produza uma extração completa e estruturada para orientar a defesa do réu.

Extraia TODAS as informações pessoais e de qualificação das partes que constarem na petição inicial e documentos anexos. Petições iniciais brasileiras geralmente contêm a qualificação completa das partes no início do documento — nome, CPF/CNPJ, RG, nacionalidade, estado civil, profissão, data de nascimento, email, endereço completo e telefone.

Extraia TODOS os detalhes sobre o objeto central da ação — se for veículo: marca, modelo, ano, placa, chassi, valor. Se for imóvel: endereço, matrícula, metragem. Se for contrato: número, data, partes, valor, cláusulas principais. Se for relação de trabalho: cargo, salário, período. Inclua TUDO que estiver nos documentos no campo objeto_da_acao.

Liste CADA valor individual pleiteado pelo autor com sua descrição, valor exato e fundamento jurídico. Inclua: danos materiais, danos morais, lucros cessantes, multas, honorários, custas, correção monetária, juros — TUDO que constar nos pedidos.

Para CADA prova/documento fornecido pelo autor, explique: (1) o que o documento contém, (2) como o autor utiliza essa prova no caso, (3) qual tese jurídica ele embasa, (4) pontos de atenção ou possíveis fragilidades dessa prova.

PETIÇÃO INICIAL EXTRAÍDA:
${JSON.stringify(peticao, null, 2)}

DOCUMENTOS DE SUPORTE DA PARTE AUTORA:
${docsSection}

Com base em TODOS os documentos acima, retorne APENAS um JSON válido (sem markdown, sem comentários) com a seguinte estrutura EXATA:
{
  "dados_processo": {
    "numero_cnj": "número CNJ no formato NNNNNNN-NN.NNNN.N.NN.NNNN ou vazio",
    "juiz": "nome do juiz se mencionado, ou vazio",
    "comarca": "comarca do processo",
    "vara": "vara (ex: 3ª Vara Cível)",
    "localizacao": "cidade/estado (ex: São Paulo/SP)",
    "data_distribuicao": "data de distribuição DD/MM/AAAA ou vazio"
  },
  "partes": {
    "autor": {
      "nome": "nome completo da parte autora",
      "cpf_cnpj": "CPF ou CNPJ se mencionado, ou vazio",
      "rg": "número do RG se mencionado, ou vazio",
      "nacionalidade": "nacionalidade se mencionada (ex: brasileiro(a)), ou vazio",
      "estado_civil": "estado civil se mencionado (ex: solteiro, casado, divorciado), ou vazio",
      "profissao": "profissão se mencionada, ou vazio",
      "data_nascimento": "data de nascimento no formato DD/MM/AAAA se mencionada, ou vazio",
      "email": "endereço de email se mencionado, ou vazio",
      "endereco": {
        "rua": "nome da rua ou avenida, ou vazio",
        "numero": "número do imóvel, ou vazio",
        "bairro": "bairro, ou vazio",
        "cidade": "cidade, ou vazio",
        "estado": "estado (UF de 2 letras), ou vazio",
        "cep": "CEP no formato NNNNN-NNN, ou vazio"
      },
      "telefone": "telefone se mencionado, ou vazio",
      "outras_info": "quaisquer outras informações de qualificação encontradas nos documentos, ou vazio",
      "advogados": [
        {
          "nome": "nome completo do advogado",
          "oab": "número da OAB (apenas o número)",
          "seccional": "estado da seccional da OAB (ex: SP, RJ), ou vazio",
          "escritorio": "nome do escritório de advocacia se mencionado, ou vazio",
          "endereco": "endereço completo do escritório se mencionado, ou vazio",
          "email": "email profissional do advogado se mencionado, ou vazio",
          "telefone": "telefone profissional do advogado se mencionado, ou vazio"
        }
      ]
    },
    "reu": {
      "nome": "nome completo do réu",
      "cpf_cnpj": "CPF ou CNPJ se mencionado, ou vazio",
      "rg": "número do RG se mencionado, ou vazio",
      "nacionalidade": "nacionalidade se mencionada, ou vazio",
      "estado_civil": "estado civil se mencionado, ou vazio",
      "profissao": "profissão se mencionada, ou vazio",
      "data_nascimento": "data de nascimento no formato DD/MM/AAAA se mencionada, ou vazio",
      "email": "endereço de email se mencionado, ou vazio",
      "endereco": {
        "rua": "nome da rua ou avenida, ou vazio",
        "numero": "número do imóvel, ou vazio",
        "bairro": "bairro, ou vazio",
        "cidade": "cidade, ou vazio",
        "estado": "estado (UF), ou vazio",
        "cep": "CEP, ou vazio"
      },
      "telefone": "telefone se mencionado, ou vazio",
      "outras_info": "outras informações de qualificação do réu encontradas nos documentos, ou vazio",
      "advogados": []
    }
  },
  "objeto_da_acao": {
    "tipo": "Seguro de Veículo / Imóvel / Contrato / Relação de Trabalho / Responsabilidade Civil / etc",
    "descricao": "Descrição detalhada do bem, relação jurídica ou objeto central da disputa",
    "detalhes": [
      {"campo": "nome do atributo", "valor": "valor encontrado nos documentos"}
    ]
  },
  "valores": {
    "itens": [
      {"descricao": "nome do item pleiteado", "valor": "R$ X.XXX,XX", "fundamento": "fundamento jurídico ou contratual do pedido"}
    ],
    "total": "R$ X.XXX,XX ou 'Não identificado'"
  },
  "alegacao_principal": "Resumo objetivo em 2-3 parágrafos da alegação central do autor. O que aconteceu, qual é o prejuízo alegado, o que o autor quer.",
  "fatos_narrados": [
    "Fato relevante 1 narrado pelo autor",
    "Fato relevante 2 narrado pelo autor"
  ],
  "fundamento_juridico": {
    "base_legal": ["Art. X do Código Y — descrição breve", "Lei N XXXX/XXXX — descrição"],
    "teses": ["Tese jurídica 1 do autor", "Tese jurídica 2 do autor"],
    "pedidos": ["Pedido 1 ao juiz", "Pedido 2 ao juiz", "Pedido 3 ao juiz"]
  },
  "provas_fornecidas": [
    {
      "documento": "nome do arquivo ou documento",
      "tipo": "Contrato / Nota Fiscal / Laudo / Foto / Outro",
      "resumo": "resumo em 1-2 linhas do que é o documento",
      "conteudo_principal": "descrição do conteúdo principal: cláusulas relevantes, valores, datas, obrigações",
      "como_autor_usa": "como o autor utiliza especificamente este documento para embasar seus pedidos",
      "tese_que_embasa": "qual tese jurídica ou pedido específico este documento fundamenta",
      "pontos_de_atencao": "possíveis fragilidades, inconsistências ou pontos críticos que a defesa deve verificar"
    }
  ],
  "datas_importantes": [
    {"data": "DD/MM/AAAA ou período descritivo", "evento": "descrição do evento que ocorreu nessa data"}
  ],
  "prazo_contestacao": "prazo em dias ou data limite se identificado, ou 'A verificar'",
  "documentos_necessarios_cliente": [
    {
      "documento": "nome claro do documento a solicitar ao cliente",
      "motivo": "por que precisamos desse documento para a defesa",
      "prioridade": "alta"
    }
  ],
  "risco_preliminar": "baixo"
}

REGRAS OBRIGATÓRIAS:
- risco_preliminar deve ser exatamente: "baixo", "medio" ou "alto"
- prioridade deve ser exatamente: "alta", "media" ou "baixa"
- documentos_necessarios_cliente: liste entre 3 e 8 documentos específicos e relevantes
- fatos_narrados: mínimo 4 fatos concretos narrados pelo autor
- fundamento_juridico.pedidos: liste TODOS os pedidos específicos feitos ao juiz
- objeto_da_acao.detalhes: liste TODOS os atributos identificáveis do objeto (mínimo 3 quando identificável)
- valores.itens: liste CADA item de valor individualmente com fundamento — não agrupe
- provas_fornecidas: inclua CADA documento com análise completa de todos os 7 campos
- datas_importantes: inclua TODAS as datas relevantes mencionadas na cronologia dos fatos
- Seja técnico, objetivo e orientado à defesa do réu
- Se algum campo não puder ser identificado nos documentos, use string vazia "" ou "Não identificado"
`
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeCasePayload = await req.json()
    const { project_id, firm_id, peticao_extracted, supporting_docs } = body

    if (!project_id || !firm_id) {
      return NextResponse.json({ error: 'project_id e firm_id são obrigatórios' }, { status: 400 })
    }

    const prompt = buildPrompt(peticao_extracted, supporting_docs || [])

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Você é um advogado sênior brasileiro especializado em análise processual. Extraia TODOS os dados estruturados solicitados. Retorne APENAS JSON válido, sem markdown, sem comentários.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('[analyze-case] OpenAI error:', err)
      return NextResponse.json({ error: 'Falha na análise AI' }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'
    const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let analysis: CaseAnalysis
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('[analyze-case] JSON parse error:', cleaned.slice(0, 400))
      return NextResponse.json({ error: 'Falha ao processar resposta da IA' }, { status: 500 })
    }

    // Persist to case_strategies with status='analise_inicial'
    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    await adminSupabase.from('case_strategies').insert({
      project_id,
      firm_id,
      tese_principal: analysis.alegacao_principal || 'Análise inicial pendente',
      teses_subsidiarias: analysis.fundamento_juridico?.teses || [],
      jurisprudencia_favoravel: [],
      jurisprudencia_desfavoravel: [],
      risco_estimado: analysis.risco_preliminar || 'medio',
      valor_risco_estimado: null,
      recomendacao: 'Análise inicial — aguardando documentos do cliente',
      draft_peca: JSON.stringify(analysis),
      draft_tipo: 'analise_inicial',
      status: 'analise_inicial',
    })

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    console.error('[analyze-case] error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
