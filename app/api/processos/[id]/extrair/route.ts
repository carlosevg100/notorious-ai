export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

const EXTRACTION_SCHEMA = `{
  "numero_processo": "string formato CNJ ex 1234567-89.2024.8.26.0100",
  "tribunal": "string ex TJSP / TRT2 / STJ",
  "comarca": "string",
  "foro": "string se diferente da comarca",
  "vara": "string ex 15ª Vara Cível",
  "juizo": "string nome completo do juízo",
  "juiz": "string nome do juiz se constar",
  "data_distribuicao": "YYYY-MM-DD se constar",
  "classe_processual": "string ex Procedimento Comum Cível",
  "assunto_principal": "string assunto CNJ",
  "valor_causa": 0,
  "polo_ativo": {
    "nome": "string nome completo",
    "tipo": "PF|PJ",
    "cpf_cnpj": "string",
    "endereco": "string se constar",
    "advogados": [{"nome": "string", "oab": "string", "email": "string se constar"}]
  },
  "polo_passivo": {
    "nome": "string nome completo",
    "tipo": "PF|PJ",
    "cpf_cnpj": "string",
    "endereco": "string se constar",
    "advogados": []
  },
  "litisconsortes": [],
  "tutela_urgencia": {
    "possui": false,
    "tipo": "antecipada|cautelar|liminar|null",
    "descricao": "string o que foi pedido",
    "urgencia": "imediata|alta|media"
  },
  "causa_pedir": {
    "proxima": "string fatos concretos que geraram o pedido em 2-3 frases",
    "remota": "string fundamento jurídico abstrato ex responsabilidade civil contratual"
  },
  "fatos_cronologicos": ["string cada fato relevante em ordem cronológica com datas se houver"],
  "teses_juridicas_autor": [
    {"tese": "string nome da tese", "fundamento": "string artigo/lei/sumula citada", "descricao": "string como aplica ao caso"}
  ],
  "pedidos": [
    {"tipo": "principal|acessorio|tutela", "descricao": "string pedido completo", "valor": 0, "base_calculo": "string como chegou no valor se constar"}
  ],
  "valor_total_pedidos": 0,
  "documentos_mencionados": ["string cada documento citado como prova"],
  "lacunas_documentais": ["string documentos que deveriam existir mas não foram juntados"],
  "perguntas_ao_cliente": ["string pergunta objetiva ex Existe contrato escrito com o autor?"],
  "documentos_solicitar_cliente": ["string documento a solicitar ex Extratos bancários do período"],
  "prazo_contestacao_dias": 15,
  "prazo_contestacao_sugerido": "YYYY-MM-DD",
  "risco": "alto|medio|baixo",
  "risco_justificativa": "string por que esse risco em 1-2 frases",
  "pontos_atencao": ["string alerta importante para o advogado"],
  "resumo_executivo": "string máx 120 palavras em linguagem clara para enviar ao cliente empresarial"
}`

function extractRawTextFromPDF(buf: Buffer): string {
  const str = buf.toString('binary')
  const chunks: string[] = []
  const btEt = /BT([\s\S]*?)ET/g
  let m: RegExpExecArray | null
  while ((m = btEt.exec(str)) !== null) {
    const tj = /\(([^)]{2,100})\)\s*(?:Tj|TJ|'|")/g
    let t: RegExpExecArray | null
    while ((t = tj.exec(m[1])) !== null) {
      const clean = t[1].replace(/\\[nrt\\()]/g, ' ').replace(/[^\x20-\x7E]/g, '').trim()
      if (clean.length > 2) chunks.push(clean)
    }
  }
  const result = chunks.join(' ').replace(/\s+/g, ' ')
  if (result.length > 200) return result.substring(0, 5000)
  // fallback: try latin1 readable text
  return buf.toString('utf-8').replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ').replace(/\s+/g, ' ').substring(0, 5000)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: processoId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let docId = ''
  try {
    const body = await request.json().catch(() => ({}))
    docId = body.docId || ''

    const { data: processo } = await supabaseAdmin
      .from('processos').select('*').eq('id', processoId).single()
    if (!processo) return NextResponse.json({ error: 'Processo not found' }, { status: 404 })

    // Get document
    let filePath = body.filePath || ''
    let documentId = docId
    if (!docId || !filePath) {
      const { data: docs } = await supabaseAdmin
        .from('documents')
        .select('id, file_path, name')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (docs?.length) { documentId = docs[0].id; filePath = docs[0].file_path }
    }

    // Download and extract text
    let text = ''
    if (filePath) {
      try {
        const { data: fileData } = await supabaseAdmin.storage.from('documents').download(filePath)
        if (fileData) {
          const buf = Buffer.from(await fileData.arrayBuffer())
          if (filePath.endsWith('.txt') || filePath.includes('text')) {
            text = buf.toString('utf-8').substring(0, 5000)
          } else if (filePath.endsWith('.pdf')) {
            text = extractRawTextFromPDF(buf)
          } else {
            text = buf.toString('utf-8').replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ').replace(/\s+/g, ' ').substring(0, 5000)
          }
        }
      } catch (e) { console.log('storage err:', e) }
    }

    if (!text || text.length < 30) {
      text = `Processo: ${processo.numero_processo || 'não informado'}. Documento jurídico para análise contenciosa.`
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'Você é um analista jurídico sênior especializado em contencioso cível e trabalhista brasileiro. Extrai dados com precisão máxima, nunca inventa dados ausentes — usa null quando não constar. Retorna APENAS JSON válido.'
      }, {
        role: 'user',
        content: `Analise esta petição inicial / documento jurídico brasileiro e extraia TODOS os dados no schema abaixo. Seja exaustivo e preciso. Nunca invente dados — se não constar, use null ou array vazio.

SCHEMA OBRIGATÓRIO:
${EXTRACTION_SCHEMA}

DOCUMENTO:
${text}`
      }]
    })

    const raw = completion.choices[0].message.content || '{}'
    const ext = JSON.parse(raw)

    // Calculate total pedidos value
    const valorTotal = ext.valor_total_pedidos || (ext.pedidos || []).reduce((s: number, p: any) => s + (p.valor || 0), 0) || ext.valor_causa

    // Prazo
    const prazoDate = ext.prazo_contestacao_sugerido || null

    // Tutela
    const tutelaUrgencia = ext.tutela_urgencia?.possui ?? (typeof ext.tutela_urgencia === 'boolean' ? ext.tutela_urgencia : false)

    // Build full update payload
    const update: any = {
      fase: 'extracao',
      updated_at: new Date().toISOString(),
    }

    const fields = ['numero_processo','tribunal','comarca','vara','juiz','classe_processual','assunto_principal',
      'polo_ativo','polo_passivo','pedidos','fatos_resumidos','causa_pedir','fundamentos_juridicos',
      'documentos_mencionados','resumo_executivo','risco']

    if (ext.numero_processo) update.numero_processo = ext.numero_processo
    if (ext.tribunal) update.tribunal = ext.tribunal
    if (ext.comarca) update.comarca = ext.comarca
    if (ext.foro) update.foro = ext.foro || ext.comarca
    if (ext.vara) update.vara = ext.vara
    if (ext.juiz) update.juiz = ext.juiz
    if (ext.classe_processual) update.classe_processual = ext.classe_processual
    if (ext.assunto_principal) update.assunto = ext.assunto_principal
    if (ext.valor_causa) update.valor_causa = ext.valor_causa
    if (ext.polo_ativo) update.polo_ativo = ext.polo_ativo
    if (ext.polo_passivo) update.polo_passivo = ext.polo_passivo
    if (ext.pedidos?.length) update.pedidos = ext.pedidos
    if (ext.causa_pedir) update.causa_pedir = typeof ext.causa_pedir === 'object'
      ? `${ext.causa_pedir.proxima || ''} ${ext.causa_pedir.remota || ''}`.trim()
      : ext.causa_pedir
    if (ext.teses_juridicas_autor?.length) update.fundamentos_juridicos = ext.teses_juridicas_autor
    if (ext.documentos_mencionados?.length) update.documentos_mencionados = ext.documentos_mencionados
    if (ext.risco) update.risco = ext.risco
    if (ext.resumo_executivo) update.resumo_executivo = ext.resumo_executivo
    if (prazoDate) update.prazo_contestacao = prazoDate
    update.tutela_urgencia = tutelaUrgencia

    // Store full extraction as raw in a dedicated field (using existing jsonb column)
    update.teses_defesa = ext.teses_juridicas_autor || []

    // Store complete extraction data for display
    const fullExtraction = {
      ...ext,
      valor_total_pedidos: valorTotal,
      extracted_at: new Date().toISOString(),
    }

    // We'll store the full extraction in documentos_mencionados-adjacent field via raw
    // Since we don't have a dedicated column, store in fundamentos_juridicos as structured data
    update.fundamentos_juridicos = fullExtraction

    await supabaseAdmin.from('processos').update(update).eq('id', processoId)

    if (documentId) {
      await supabaseAdmin.from('documents').update({ ai_status: 'complete' }).eq('id', documentId)
    }

    return NextResponse.json({ ok: true, extracted: ext, processoId })

  } catch (err: any) {
    console.error('extrair error:', err?.message)
    if (docId) {
      try { await supabaseAdmin.from('documents').update({ ai_status: 'failed' }).eq('id', docId) } catch {}
    }
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
