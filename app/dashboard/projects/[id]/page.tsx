'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { diasUteisRestantes } from '@/lib/utils'

const SUPABASE_URL = 'https://fbgqzouxbagmmlzibyhl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzYxNTEsImV4cCI6MjA4ODA1MjE1MX0.o4SCzzeLf2IkXIhMyGRq9DuzOZWbg4w-uxdCTTHaY_E'
const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

interface Document {
  id: string
  name: string
  file_type: string
  file_size_bytes: number
  processing_status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  processing_error?: string
  extracted_data?: any
  created_at: string
}

interface Project {
  id: string
  name: string
  numero_processo?: string
  tipo: string
  fase: string
  clients?: { name: string }
  documents?: Document[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Peca {
  id?: string
  tipo: string
  conteudo: string
  created_at?: string
  saved?: boolean
}

type Tab = 'documentos' | 'analise' | 'prazos' | 'pecas' | 'chat'

function StatusIcon({ status }: { status: string }) {
  if (status === 'pending') return <span style={{ color: 'var(--text-4)' }}>⏳</span>
  if (status === 'processing') return <span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 14, height: 14 }} />
  if (status === 'completed') return <span style={{ color: 'var(--success)' }}>✓</span>
  if (status === 'error') return <span style={{ color: 'var(--error)' }}>✗</span>
  return <span style={{ color: 'var(--text-4)' }}>○</span>
}

function StatusLabel({ status, error }: { status: string; error?: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'var(--text-4)' },
    uploading: { label: 'Enviando...', color: 'var(--info)' },
    processing: { label: 'Processando...', color: 'var(--gold)' },
    completed: { label: 'Concluído', color: 'var(--success)' },
    error: { label: `Erro: ${error || 'Falha no processamento'}`, color: 'var(--error)' },
  }
  const info = map[status] || { label: status, color: 'var(--text-4)' }
  return <span style={{ fontSize: 12, color: info.color }}>{info.label}</span>
}

function PrazoBadge({ du }: { du: number }) {
  if (du < 0) return <span className="badge" style={{ background: '#ef444420', color: 'var(--error)', border: '1px solid #ef444440' }}>VENCIDO</span>
  if (du <= 3) return <span className="badge" style={{ background: '#ef444420', color: 'var(--error)', border: '1px solid #ef444440' }}>{du} d.u.</span>
  if (du <= 7) return <span className="badge" style={{ background: '#f59e0b20', color: 'var(--warning)', border: '1px solid #f59e0b40' }}>{du} d.u.</span>
  return <span className="badge" style={{ background: '#22c55e20', color: 'var(--success)', border: '1px solid #22c55e40' }}>{du} d.u.</span>
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [tab, setTab] = useState<Tab>('documentos')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analysis state
  const [analysisData, setAnalysisData] = useState<Record<string, any>>({})
  const fetchedAnalysis = useRef<Set<string>>(new Set())

  // Prazos state
  const [prazos, setPrazos] = useState<any[]>([])

  // Peças state
  const [pecas, setPecas] = useState<Peca[]>([])
  const [generatingPeca, setGeneratingPeca] = useState<string | null>(null)
  const [selectedPeca, setSelectedPeca] = useState<Peca | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load project
  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(data => {
      setProject(data)
      setDocuments(data.documents || [])
      setLoading(false)
    })
  }, [id])

  // Fetch analysis for completed docs when on Análise tab
  useEffect(() => {
    if (tab !== 'analise') return
    documents.filter(d => d.processing_status === 'completed').forEach(doc => {
      if (fetchedAnalysis.current.has(doc.id)) return
      fetchedAnalysis.current.add(doc.id)
      fetch(`/api/documents/${doc.id}/analysis`).then(r => r.ok ? r.json() : null).then(data => {
        if (data?.extracted_data) {
          setAnalysisData(prev => ({ ...prev, [doc.id]: data.extracted_data }))
        }
      })
    })
  }, [tab, documents])

  // Load prazos & pecas when tab changes
  useEffect(() => {
    if (tab === 'prazos') {
      fetch(`/api/prazos?project_id=${id}`).then(r => r.json()).then(data => setPrazos(Array.isArray(data) ? data : []))
    }
    if (tab === 'pecas') {
      fetch(`/api/pecas?project_id=${id}`).then(r => r.json()).then(data => setPecas(Array.isArray(data) ? data : []))
    }
    if (tab === 'chat') {
      fetch(`/api/chat?project_id=${id}`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          setChatMessages(data.map((m: any) => ({ role: m.role, content: m.content })))
        }
      })
    }
  }, [tab, id])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const channel = supabase
      .channel(`documents:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `project_id=eq.${id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => [payload.new as Document, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(d =>
            d.id === payload.new.id ? payload.new as Document : d
          ))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    setUploading(true)

    for (const file of fileArr) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_id', id)
      formData.append('firm_id', FIRM_ID)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          console.error('Upload error:', err.error)
        }
      } catch (e) {
        console.error('Upload failed:', e)
      }
    }
    setUploading(false)
  }, [id])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }, [handleUpload])

  const completedDocs = documents.filter(d => d.processing_status === 'completed')
  const displayDoc = selectedDoc
    ? completedDocs.find(d => d.id === selectedDoc)
    : completedDocs[0]

  const handleGeneratePeca = async (tipo: string) => {
    setGeneratingPeca(tipo)
    const res = await fetch('/api/pecas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, tipo })
    })
    const data = await res.json()
    if (res.ok) {
      setPecas(prev => [data, ...prev])
      setSelectedPeca(data)
    }
    setGeneratingPeca(null)
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMsg = chatInput
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, message: userMsg, history: chatMessages.slice(-10) })
    })
    const data = await res.json()
    setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Erro na resposta' }])
    setChatLoading(false)
  }

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-4)' }}>Carregando processo...</span>
    </div>
  )

  if (!project) return <div style={{ padding: 32, color: 'var(--text-4)' }}>Processo não encontrado</div>

  const TABS: { key: Tab; label: string }[] = [
    { key: 'documentos', label: 'Documentos' },
    { key: 'analise', label: 'Análise' },
    { key: 'prazos', label: 'Prazos' },
    { key: 'pecas', label: 'Peças' },
    { key: 'chat', label: 'Chat' },
  ]

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => project.clients ? router.back() : router.push('/dashboard/clients')}>
            ← Voltar
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{project.name}</h1>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {project.clients?.name && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{project.clients.name}</span>}
              {project.numero_processo && <span style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'monospace' }}>{project.numero_processo}</span>}
              <span className="badge" style={{ background: 'var(--gold-light)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
                {project.fase}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--gold)' : 'var(--text-4)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--gold)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s', fontFamily: 'inherit'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab: Documentos */}
      {tab === 'documentos' && (
        <div>
          {/* Upload area */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--border-2)'}`,
              borderRadius: 10, padding: '32px 24px', textAlign: 'center',
              cursor: 'pointer', marginBottom: 24, transition: 'all 0.15s',
              background: dragOver ? 'var(--gold-light)' : 'transparent'
            }}>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt" style={{ display: 'none' }}
              onChange={e => e.target.files && handleUpload(e.target.files)} />
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
                <span style={{ color: 'var(--text-3)' }}>Enviando arquivos...</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>↑</div>
                <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>
                  Arraste arquivos ou <span style={{ color: 'var(--gold)' }}>clique para selecionar</span>
                </p>
                <p style={{ color: 'var(--text-4)', fontSize: 12 }}>PDF, DOCX ou TXT — múltiplos arquivos</p>
              </>
            )}
          </div>

          {/* Documents list */}
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-4)' }}>
              Nenhum documento enviado ainda
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documents.map(doc => (
                <div key={doc.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusIcon status={doc.processing_status} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{doc.name}</div>
                      <StatusLabel status={doc.processing_status} error={doc.processing_error} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {doc.file_size_bytes && (
                      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                        {(doc.file_size_bytes / 1024).toFixed(0)} KB
                      </span>
                    )}
                    {doc.processing_status === 'completed' && (
                      <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => { setSelectedDoc(doc.id); setTab('analise') }}>
                        Ver análise
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Análise */}
      {tab === 'analise' && (
        <div>
          {completedDocs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>◻</div>
              <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>Nenhuma análise disponível</h3>
              <p style={{ color: 'var(--text-4)', marginBottom: 20 }}>Faça upload de um documento para ver a análise extraída pela IA</p>
              <button className="btn-gold" onClick={() => setTab('documentos')}>Fazer Upload</button>
            </div>
          ) : (
            <>
              {completedDocs.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <select value={selectedDoc || completedDocs[0]?.id || ''}
                    onChange={e => setSelectedDoc(e.target.value)}
                    style={{ width: 'auto', minWidth: 240 }}>
                    {completedDocs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {displayDoc && analysisData[displayDoc.id] ? (
                <AnalysisView data={analysisData[displayDoc.id]} docName={displayDoc.name} />
              ) : displayDoc ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-4)' }}>
                  <div className="spinner" style={{ borderTopColor: 'var(--gold)', margin: '0 auto 12px' }} />
                  <p>Carregando análise...</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* Tab: Prazos */}
      {tab === 'prazos' && (
        <div>
          {prazos.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>◷</div>
              <p style={{ color: 'var(--text-4)' }}>
                Nenhum prazo identificado. Os prazos são extraídos automaticamente dos documentos processados.
              </p>
            </div>
          ) : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Descrição', 'Data', 'Tipo', 'Dias Úteis', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prazos.map(p => {
                    const du = diasUteisRestantes(p.data_prazo)
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.descricao}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{new Date(p.data_prazo).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-4)' }}>{p.tipo}</td>
                        <td style={{ padding: '10px 12px' }}><PrazoBadge du={du} /></td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-4)', border: '1px solid var(--border)' }}>{p.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Peças */}
      {tab === 'pecas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Gerar Peça</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'contestacao', label: 'Gerar Contestação' },
                  { key: 'recurso', label: 'Gerar Recurso' },
                  { key: 'peticao', label: 'Gerar Petição' },
                ].map(btn => (
                  <button key={btn.key} className="btn" style={{ justifyContent: 'center', padding: '12px' }}
                    onClick={() => handleGeneratePeca(btn.key)}
                    disabled={generatingPeca !== null}>
                    {generatingPeca === btn.key ? (
                      <><span className="spinner" style={{ borderTopColor: 'var(--text)' }} /> Gerando...</>
                    ) : btn.label}
                  </button>
                ))}
              </div>
            </div>

            {pecas.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Histórico</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pecas.map((p, i) => (
                    <button key={i} onClick={() => setSelectedPeca(p)} className="btn" style={{
                      justifyContent: 'space-between', padding: '10px 12px',
                      background: selectedPeca === p ? 'var(--gold-light)' : 'var(--bg-3)',
                      borderColor: selectedPeca === p ? 'var(--gold-border)' : 'var(--border)',
                      color: selectedPeca === p ? 'var(--gold)' : 'var(--text-3)',
                    }}>
                      <span>{p.tipo}</span>
                      {p.created_at && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            {selectedPeca ? (
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{selectedPeca.tipo}</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={() => { navigator.clipboard.writeText(selectedPeca.conteudo) }}>
                    Copiar
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
                  {selectedPeca.conteudo}
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <p style={{ color: 'var(--text-4)' }}>Selecione uma peça para visualizar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Chat */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-4)' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>◈</div>
                <p>Converse com a IA sobre este processo. Ela tem acesso a todos os documentos analisados.</p>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '70%', padding: '12px 16px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: m.role === 'user' ? 'var(--gold)' : 'var(--bg-3)',
                  color: m.role === 'user' ? '#000' : 'var(--text)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--text-3)' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 12 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="Pergunte sobre o processo..." style={{ flex: 1 }}
              disabled={chatLoading} />
            <button type="submit" className="btn-gold" disabled={!chatInput.trim() || chatLoading}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function AnalysisView({ data, docName }: { data: any; docName: string }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{title}</h4>
      {children}
    </div>
  )

  const Text = ({ value }: { value: string | null | undefined }) => (
    <p style={{ fontSize: 13, color: value ? 'var(--text-2)' : 'var(--text-4)', lineHeight: 1.6 }}>{value || '—'}</p>
  )

  const List = ({ items }: { items: string[] | null | undefined }) => (
    items?.length ? (
      <ul style={{ paddingLeft: 16 }}>
        {items.map((item, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.5 }}>{item}</li>)}
      </ul>
    ) : <Text value={null} />
  )

  const riskColor = data.risco_estimado === 'alto' ? 'var(--error)' : data.risco_estimado === 'medio' ? 'var(--warning)' : 'var(--success)'
  const riskBg = data.risco_estimado === 'alto' ? '#ef444420' : data.risco_estimado === 'medio' ? '#f59e0b20' : '#22c55e20'
  const riskBorder = data.risco_estimado === 'alto' ? '#ef444440' : data.risco_estimado === 'medio' ? '#f59e0b40' : '#22c55e40'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{docName}</h3>
        {data.risco_estimado && (
          <span className="badge" style={{ background: riskBg, color: riskColor, border: `1px solid ${riskBorder}`, fontSize: 12 }}>
            Risco {data.risco_estimado?.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <Section title="Tipo de Documento">
              <Text value={data.tipo_documento} />
            </Section>
            <Section title="Número do Processo">
              <Text value={data.numero_processo} />
            </Section>
            {(data.vara || data.comarca) && (
              <Section title="Vara / Comarca">
                <Text value={[data.vara, data.comarca].filter(Boolean).join(' — ')} />
              </Section>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <Section title="Partes">
              {data.partes?.autor && <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>AUTOR</span>
                <Text value={data.partes.autor} />
              </div>}
              {data.partes?.reu && <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>RÉU</span>
                <Text value={data.partes.reu} />
              </div>}
              {data.partes?.advogado_autor && <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>ADV. AUTOR</span>
                <Text value={data.partes.advogado_autor} />
              </div>}
              {data.partes?.advogado_reu && <div>
                <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>ADV. RÉU</span>
                <Text value={data.partes.advogado_reu} />
              </div>}
            </Section>
          </div>

          <div className="card">
            <Section title="Resumo Executivo">
              <Text value={data.resumo_executivo} />
            </Section>
            {data.causa_pedir && <Section title="Causa de Pedir">
              <Text value={data.causa_pedir} />
            </Section>}
            {data.risco_justificativa && <Section title="Análise de Risco">
              <Text value={data.risco_justificativa} />
            </Section>}
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <Section title="Pedidos">
              <List items={data.pedidos} />
            </Section>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <Section title="Fatos Relevantes">
              <List items={data.fatos_relevantes} />
            </Section>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <Section title="Teses Jurídicas">
              <List items={data.teses_juridicas} />
            </Section>
          </div>

          {data.tutela_antecipada?.requerida && (
            <div className="card" style={{ marginBottom: 16 }}>
              <Section title="Tutela Antecipada">
                <span className="badge" style={{ background: '#f59e0b20', color: 'var(--warning)', border: '1px solid #f59e0b40', marginBottom: 8 }}>
                  REQUERIDA
                </span>
                {data.tutela_antecipada.fundamento && <Text value={data.tutela_antecipada.fundamento} />}
              </Section>
            </div>
          )}

          {data.valor_causa && (
            <div className="card">
              <Section title="Valor da Causa">
                <Text value={data.valor_causa} />
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
