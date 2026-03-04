export const maxDuration = 10
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

const SCHEMA = `{"numero_processo":"string CNJ ex 1234567-89.2024.8.26.0100 ou null","tribunal":"string","comarca":"string","vara":"string","juiz":"string|null","classe_processual":"string","assunto_principal":"string","valor_causa":0,"polo_ativo":{"nome":"string","tipo":"PF|PJ","cpf_cnpj":"string|null","endereco":"string|null","advogados":[{"nome":"string","oab":"string"}]},"polo_passivo":{"nome":"string","tipo":"PF|PJ","cpf_cnpj":"string|null","endereco":"string|null"},"tutela_urgencia":{"possui":false,"tipo":"antecipada|cautelar|liminar|null","descricao":"string|null"},"causa_pedir":{"proxima":"string fatos concretos","remota":"string fundamento juridico"},"fatos_cronologicos":["string em ordem cronologica"],"teses_juridicas_autor":[{"tese":"string","fundamento":"string art/lei/sumula","descricao":"string"}],"pedidos":[{"tipo":"principal|acessorio|tutela","descricao":"string pedido completo","valor":0}],"valor_total_pedidos":0,"documentos_mencionados":["string"],"documentos_solicitar_cliente":["string"],"perguntas_ao_cliente":["string"],"prazo_contestacao_sugerido":"YYYY-MM-DD","risco":"alto|medio|baixo","risco_justificativa":"string","pontos_atencao":["string"],"resumo_executivo":"string max 100 palavras"}`

async function runExtraction(text: string, processoId: string, docId: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0, max_tokens: 2500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Analista juridico senior brasileiro. Extrai dados com precisao maxima. Nunca inventa — usa null quando nao constar. Retorna APENAS JSON valido.' },
      { role: 'user', content: `Analise esta peticao inicial brasileira e extraia TODOS os dados.\n\nSCHEMA OBRIGATORIO:\n${SCHEMA}\n\nDOCUMENTO:\n${text}` }
    ]
  })
  const ext = JSON.parse(r.choices[0].message.content || '{}')
  ext.extracted_at = new Date().toISOString()

  const tu = ext.tutela_urgencia as Record<string, unknown> | undefined
  const upd: Record<string, unknown> = {
    fase: 'extracao', updated_at: new Date().toISOString(),
    fundamentos_juridicos: ext,
    tutela_urgencia: tu?.possui === true,
  }
  if (ext.numero_processo && ext.numero_processo !== 'string CNJ') upd.numero_processo = ext.numero_processo
  if (ext.tribunal) upd.tribunal = ext.tribunal
  if (ext.comarca) upd.comarca = ext.comarca
  if (ext.vara) upd.vara = ext.vara
  if (ext.juiz) upd.juiz = ext.juiz
  if (ext.classe_processual) upd.classe_processual = ext.classe_processual
  if (ext.assunto_principal) upd.assunto = ext.assunto_principal
  if (ext.valor_causa) upd.valor_causa = ext.valor_causa
  if (ext.polo_ativo) upd.polo_ativo = ext.polo_ativo
  if (ext.polo_passivo) upd.polo_passivo = ext.polo_passivo
  if (ext.pedidos?.length) upd.pedidos = ext.pedidos
  if (ext.causa_pedir) { const cp = ext.causa_pedir as Record<string,string>; upd.causa_pedir = `${cp.proxima||''} ${cp.remota||''}`.trim() }
  if (ext.teses_juridicas_autor?.length) upd.teses_defesa = ext.teses_juridicas_autor
  if (ext.documentos_mencionados?.length) upd.documentos_mencionados = ext.documentos_mencionados
  if (ext.risco) upd.risco = ext.risco
  if (ext.resumo_executivo) upd.resumo_executivo = ext.resumo_executivo
  if (ext.prazo_contestacao_sugerido) upd.prazo_contestacao = ext.prazo_contestacao_sugerido

  await supabaseAdmin.from('processos').update(upd).eq('id', processoId)
  await supabaseAdmin.from('documents').update({ ai_status: 'complete' }).eq('id', docId)
  return ext
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('firm_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const firmId = profile.firm_id
  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const clientId = formData.get('client_id') as string | null
  const processoId = formData.get('processo_id') as string | null
  const folder = (formData.get('folder') as string) || 'Inicial e Anexos'
  // Text extracted client-side (browser PDF.js) — no server-side PDF parsing needed
  const extractedText = (formData.get('extracted_text') as string | null) || ''

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // ── EXISTING PROCESSO: store doc + trigger extraction ────────────────────
  if (processoId) {
    const filePath = `processos/${processoId}/${folder}/${Date.now()}_${file.name}`
    const { error: sErr } = await supabaseAdmin.storage.from('documents').upload(filePath, buffer, { contentType: file.type, upsert: false })
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

    const { data: doc, error: dbErr } = await supabaseAdmin.from('documents')
      .insert({ name: file.name, file_path: filePath, file_type: file.type, firm_id: firmId, processo_id: processoId, ai_status: extractedText ? 'processing' : 'pending' })
      .select().single()
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    return NextResponse.json({ doc, processoId, needsExtraction: !extractedText, textAvailable: !!extractedText })
  }

  // ── NEW PROCESSO FLOW ────────────────────────────────────────────────────
  if (!clientId) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

  // 1. Create processo
  const { data: processo, error: pErr } = await supabaseAdmin.from('processos')
    .insert({ firm_id: firmId, client_id: clientId, fase: 'recebido', risco: 'medio', polo_ativo: {}, polo_passivo: {}, pedidos: [], fundamentos_juridicos: [], documentos_mencionados: [] })
    .select().single()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // 2. Upload to storage
  const filePath = `processos/${processo.id}/Inicial e Anexos/${Date.now()}_${file.name}`
  const { error: sErr } = await supabaseAdmin.storage.from('documents').upload(filePath, buffer, { contentType: file.type, upsert: false })
  if (sErr) {
    await supabaseAdmin.from('processos').delete().eq('id', processo.id)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  // 3. Insert document
  const { data: doc } = await supabaseAdmin.from('documents')
    .insert({ name: file.name, file_path: filePath, file_type: file.type, firm_id: firmId, processo_id: processo.id, ai_status: extractedText ? 'processing' : 'pending' })
    .select().single()

  // 4. Run GPT extraction (text already extracted by browser, this is just a GPT call ~3s)
  let extracted = false
  if (extractedText && extractedText.length > 80) {
    try {
      await runExtraction(extractedText.substring(0, 12000), processo.id, doc!.id)
      extracted = true
    } catch (e) {
      console.error('extraction failed:', e)
      await supabaseAdmin.from('documents').update({ ai_status: 'failed' }).eq('id', doc?.id)
    }
  }

  return NextResponse.json({ processoId: processo.id, docId: doc?.id, extracted })
}
