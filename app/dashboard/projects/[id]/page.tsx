'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useDocuments } from '@/lib/hooks'
import { formatDate, formatFileSize, statusLabel, statusColor, diasUteisRestantes, prazoBadgeColor } from '@/lib/utils'
import type { Project, Document, ExtractedData, Prazo, Peca, ChatMessage } from '@/lib/types'
import { ArrowLeft, Upload, FileText, BarChart3, CalendarClock, MessageSquare, Loader2, CheckCircle2, XCircle, Clock, Plus, X } from 'lucide-react'

type Tab = 'documentos' | 'analise' | 'prazos' | 'pecas' | 'chat'

export default function ProjectHubPage() {
  const params = useParams()
  const projectId = params.id as string
  const router = useRouter()
  const { firmId } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<Tab>('documentos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('projects').select('*, clients(name)').eq('id', projectId).single()
      .then(({ data }) => {
        if (data) {
          setProject({
            ...data,
            client: data.clients as unknown as Project['client'],
          } as unknown as Project)
        }
        setLoading(false)
      })
  }, [projectId])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  if (!project) return <p style={{ color: 'var(--text-muted)' }}>Processo não encontrado.</p>

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'documentos', label: 'Documentos', icon: FileText },
    { key: 'analise', label: 'Análise', icon: BarChart3 },
    { key: 'prazos', label: 'Prazos', icon: CalendarClock },
    { key: 'pecas', label: 'Peças', icon: FileText },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
  ]

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {project.client?.name && <span>{project.client.name}</span>}
          {project.numero_processo && <span>{project.numero_processo}</span>}
          <span className="capitalize">{project.tipo}</span>
          <span className="capitalize">{project.fase}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === t.key ? 'var(--color-gold)' : 'transparent',
              color: tab === t.key ? '#000' : 'var(--text-secondary)',
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'documentos' && <DocumentosTab projectId={projectId} firmId={firmId} />}
      {tab === 'analise' && <AnaliseTab projectId={projectId} />}
      {tab === 'prazos' && <PrazosTab projectId={projectId} firmId={firmId} />}
      {tab === 'pecas' && <PecasTab projectId={projectId} firmId={firmId} />}
      {tab === 'chat' && <ChatTab projectId={projectId} />}
    </div>
  )
}

/* ─── DOCUMENTOS TAB ─── */
function DocumentosTab({ projectId, firmId }: { projectId: string; firmId: string }) {
  const { documents, loading } = useDocuments(projectId)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_id', projectId)
      formData.append('firm_id', firmId)
      await fetch('/api/upload', { method: 'POST', body: formData })
    }
    setUploading(false)
  }, [projectId, firmId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }, [uploadFiles])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-zinc-400" />
      case 'processing': return <Loader2 size={16} className="text-blue-400 animate-spin" />
      case 'completed': return <CheckCircle2 size={16} className="text-emerald-400" />
      case 'error': return <XCircle size={16} className="text-red-400" />
      default: return <Clock size={16} />
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="p-8 rounded-xl text-center cursor-pointer transition-colors"
        style={{
          background: dragOver ? 'var(--bg-tertiary)' : 'var(--bg-card)',
          border: `2px dashed ${dragOver ? 'var(--color-gold)' : 'var(--border-color)'}`,
        }}
      >
        <Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="font-medium">{uploading ? 'Enviando...' : 'Arraste arquivos aqui ou clique para selecionar'}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>PDF, DOCX, TXT — múltiplos arquivos</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="spinner" /></div>
      ) : documents.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Nenhum documento enviado.</p>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              {statusIcon(doc.processing_status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : ''} · {statusLabel(doc.processing_status)}
                  {doc.processing_error && <span className="text-red-400"> — {doc.processing_error}</span>}
                </p>
              </div>
              <span className={`text-xs font-medium ${statusColor(doc.processing_status)}`}>
                {statusLabel(doc.processing_status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── ANÁLISE TAB ─── */
function AnaliseTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('documents').select('*').eq('project_id', projectId).eq('processing_status', 'completed').order('created_at', { ascending: false })
      .then(({ data }) => {
        const completed = data || []
        setDocs(completed)
        if (completed.length > 0) setSelectedDoc(completed[0].id)
        setLoading(false)
      })
  }, [projectId])

  if (loading) return <div className="flex justify-center py-8"><div className="spinner" /></div>
  if (docs.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <BarChart3 size={48} className="mx-auto mb-3 opacity-40" />
        <p>Nenhum documento processado ainda.</p>
        <p className="text-sm mt-1">Envie documentos na aba Documentos e aguarde o processamento.</p>
      </div>
    )
  }

  const doc = docs.find(d => d.id === selectedDoc)
  const data = doc?.extracted_data as ExtractedData | null

  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Dados não disponíveis.</p>

  const riskColor = data.risco_estimado === 'alto' ? 'text-red-400' : data.risco_estimado === 'medio' ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="space-y-4">
      {docs.length > 1 && (
        <select
          value={selectedDoc}
          onChange={e => setSelectedDoc(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          <Section title="Resumo Executivo">
            <p className="text-sm leading-relaxed">{data.resumo_executivo}</p>
          </Section>

          <Section title="Partes">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Field label="Autor" value={data.partes.autor} />
              <Field label="Réu" value={data.partes.reu} />
              <Field label="Adv. Autor" value={data.partes.advogado_autor} />
              <Field label="Adv. Réu" value={data.partes.advogado_reu} />
            </div>
          </Section>

          <Section title="Causa de Pedir">
            <p className="text-sm">{data.causa_pedir}</p>
          </Section>

          <Section title="Teses Jurídicas">
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.teses_juridicas.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Section>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <Section title="Pedidos">
            <ol className="list-decimal list-inside text-sm space-y-1">
              {data.pedidos.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </Section>

          <Section title="Fatos Relevantes">
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.fatos_relevantes.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </Section>

          <Section title="Risco">
            <p className={`text-lg font-bold capitalize ${riskColor}`}>{data.risco_estimado}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{data.risco_justificativa}</p>
          </Section>

          {data.tutela_antecipada.requerida && (
            <Section title="Tutela Antecipada">
              <p className="text-sm">{data.tutela_antecipada.fundamento}</p>
            </Section>
          )}

          {data.valor_causa && (
            <Section title="Valor da Causa">
              <p className="text-sm font-semibold">{data.valor_causa}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-gold)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  )
}

/* ─── PRAZOS TAB ─── */
function PrazosTab({ projectId, firmId }: { projectId: string; firmId: string }) {
  const [prazos, setPrazos] = useState<Prazo[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ descricao: '', data_prazo: '', tipo: 'processual' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPrazos() }, [projectId])

  async function loadPrazos() {
    const { data } = await supabase.from('prazos').select('*').eq('project_id', projectId).order('data_prazo')
    setPrazos((data || []).map(p => ({ ...p, dias_uteis_restantes: diasUteisRestantes(p.data_prazo) })))
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('prazos').insert({
      firm_id: firmId,
      project_id: projectId,
      descricao: form.descricao,
      data_prazo: form.data_prazo,
      tipo: form.tipo,
    })
    setForm({ descricao: '', data_prazo: '', tipo: 'processual' })
    setShowNew(false)
    setSaving(false)
    loadPrazos()
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--color-gold)' }}>
          <Plus size={14} /> Adicionar Prazo
        </button>
      </div>

      {showNew && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <form onSubmit={handleCreate} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Descrição</label>
              <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Data</label>
              <input type="date" value={form.data_prazo} onChange={e => setForm({ ...form, data_prazo: e.target.value })} required className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="processual">Processual</option>
                <option value="contratual">Contratual</option>
                <option value="administrativo">Administrativo</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50" style={{ background: 'var(--color-gold)' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancelar</button>
          </form>
        </div>
      )}

      {prazos.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Nenhum prazo cadastrado para este processo.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                <th className="text-left py-3 px-4">Descrição</th>
                <th className="text-left py-3 px-4">Data</th>
                <th className="text-left py-3 px-4">Tipo</th>
                <th className="text-left py-3 px-4">Dias Úteis</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {prazos.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="py-3 px-4">{p.descricao}</td>
                  <td className="py-3 px-4">{formatDate(p.data_prazo)}</td>
                  <td className="py-3 px-4 capitalize">{p.tipo}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${prazoBadgeColor(p.dias_uteis_restantes ?? 0)}`}>
                      {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                    </span>
                  </td>
                  <td className="py-3 px-4 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── PEÇAS TAB ─── */
function PecasTab({ projectId, firmId }: { projectId: string; firmId: string }) {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Peca | null>(null)

  useEffect(() => { loadPecas() }, [projectId])

  async function loadPecas() {
    const { data } = await supabase.from('pecas').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    setPecas(data || [])
    setLoading(false)
  }

  async function generate(tipo: string) {
    setGenerating(tipo)
    await fetch('/api/pecas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, firm_id: firmId, tipo }),
    })
    setGenerating(null)
    loadPecas()
  }

  const tipoLabel: Record<string, string> = {
    contestacao: 'Contestação', recurso: 'Recurso', peticao: 'Petição', parecer: 'Parecer',
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['contestacao', 'recurso', 'peticao'].map(tipo => (
          <button
            key={tipo}
            onClick={() => generate(tipo)}
            disabled={generating !== null}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
            style={{ background: 'var(--color-gold)' }}
          >
            {generating === tipo ? 'Gerando...' : `Gerar ${tipoLabel[tipo]}`}
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-semibold">{tipoLabel[selected.tipo] || selected.tipo} — v{selected.versao}</h2>
              <button onClick={() => setSelected(null)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 whitespace-pre-wrap text-sm leading-relaxed">{selected.conteudo}</div>
          </div>
        </div>
      )}

      {pecas.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Nenhuma peça gerada para este processo.</p>
      ) : (
        <div className="space-y-2">
          {pecas.map(peca => (
            <button key={peca.id} onClick={() => setSelected(peca)} className="w-full text-left p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{tipoLabel[peca.tipo] || peca.tipo} — v{peca.versao}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(peca.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── CHAT TAB ─── */
function ChatTab({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('chat_messages').select('*').eq('project_id', projectId).order('created_at')
      .then(({ data }) => setMessages(data || []))
  }, [projectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)

    // Optimistic add
    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, { id: tempId, project_id: projectId, role: 'user', content: userMsg, created_at: new Date().toISOString() }])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, message: userMsg }),
    })
    const data = await res.json()

    setMessages(prev => [
      ...prev.filter(m => m.id !== tempId),
      data.userMessage,
      data.assistantMessage,
    ])
    setSending(false)
  }

  return (
    <div className="flex flex-col rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', height: '500px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Converse com a IA sobre os documentos deste processo.
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[70%] px-4 py-2.5 rounded-xl text-sm leading-relaxed"
              style={{
                background: msg.role === 'user' ? 'var(--color-gold)' : 'var(--bg-secondary)',
                color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--border-color)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte sobre o processo..."
          className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--color-gold)' }}
        >
          {sending ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
