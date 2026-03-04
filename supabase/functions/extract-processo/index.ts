import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const SCHEMA = `{"numero_processo":"string CNJ","tribunal":"string","comarca":"string","vara":"string","juiz":"string|null","classe_processual":"string","assunto_principal":"string","valor_causa":0,"polo_ativo":{"nome":"string","tipo":"PF|PJ","cpf_cnpj":"string|null","endereco":"string|null","advogados":[{"nome":"string","oab":"string"}]},"polo_passivo":{"nome":"string","tipo":"PF|PJ","cpf_cnpj":"string|null","endereco":"string|null"},"tutela_urgencia":{"possui":false,"tipo":"antecipada|cautelar|null","descricao":"string|null"},"causa_pedir":{"proxima":"string","remota":"string"},"fatos_cronologicos":["string"],"teses_juridicas_autor":[{"tese":"string","fundamento":"string","descricao":"string"}],"pedidos":[{"tipo":"principal|acessorio|tutela","descricao":"string","valor":0}],"valor_total_pedidos":0,"documentos_mencionados":["string"],"documentos_solicitar_cliente":["string"],"perguntas_ao_cliente":["string"],"prazo_contestacao_sugerido":"YYYY-MM-DD","risco":"alto|medio|baixo","risco_justificativa":"string","pontos_atencao":["string"],"resumo_executivo":"string max 100 palavras"}`

Deno.serve(async (req) => {
  const { processoId, docId, filePath, text: preExtractedText } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })

  let text = preExtractedText || ''

  // Download and extract text if not provided
  if (!text && filePath) {
    const { data, error } = await supabase.storage.from('documents').download(filePath)
    if (error || !data) {
      await supabase.from('documents').update({ ai_status: 'failed' }).eq('id', docId)
      return new Response(JSON.stringify({ error: 'download failed' }), { status: 500 })
    }
    const buf = await data.arrayBuffer()
    text = new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/\s+/g, ' ').trim().substring(0, 6000)
  }

  if (!text || text.length < 50) {
    await supabase.from('documents').update({ ai_status: 'failed' }).eq('id', docId)
    return new Response(JSON.stringify({ error: 'no text' }), { status: 400 })
  }

  // GPT extraction
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0, max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Analista juridico senior brasileiro. Extrai dados com precisao. Nunca inventa. Retorna APENAS JSON valido.' },
      { role: 'user', content: `Analise esta peticao inicial brasileira. Schema:\n${SCHEMA}\n\nDocumento:\n${text}` }
    ]
  })

  const ext = JSON.parse(r.choices[0].message.content || '{}')
  ext.extracted_at = new Date().toISOString()

  const tu = ext.tutela_urgencia
  const upd: Record<string, unknown> = {
    fase: 'extracao', updated_at: new Date().toISOString(),
    fundamentos_juridicos: ext,
    tutela_urgencia: tu?.possui === true,
  }
  if (ext.numero_processo) upd.numero_processo = ext.numero_processo
  if (ext.tribunal) upd.tribunal = ext.tribunal
  if (ext.comarca) upd.comarca = ext.comarca
  if (ext.vara) upd.vara = ext.vara
  if (ext.juiz) upd.juiz = ext.juiz
  if (ext.classe_processual) upd.classe_processual = ext.classe_processual
  if (ext.assunto_principal) upd.assunto = ext.assunto_principal
  if (ext.valor_causa) upd.valor_causa = ext.valor_causa
  if (ext.polo_ativo) upd.polo_ativo = ext.polo_ativo
  if (ext.polo_passivo) upd.polo_passivo = ext.polo_passivo
  if (ext.pedidos) upd.pedidos = ext.pedidos
  if (ext.causa_pedir) upd.causa_pedir = `${ext.causa_pedir.proxima || ''} ${ext.causa_pedir.remota || ''}`.trim()
  if (ext.teses_juridicas_autor) upd.teses_defesa = ext.teses_juridicas_autor
  if (ext.documentos_mencionados) upd.documentos_mencionados = ext.documentos_mencionados
  if (ext.risco) upd.risco = ext.risco
  if (ext.resumo_executivo) upd.resumo_executivo = ext.resumo_executivo
  if (ext.prazo_contestacao_sugerido) upd.prazo_contestacao = ext.prazo_contestacao_sugerido

  await supabase.from('processos').update(upd).eq('id', processoId)
  await supabase.from('documents').update({ ai_status: 'complete' }).eq('id', docId)

  return new Response(JSON.stringify({ ok: true, processoId }), { headers: { 'Content-Type': 'application/json' } })
})
