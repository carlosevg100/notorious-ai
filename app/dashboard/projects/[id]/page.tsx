'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useDocuments } from '@/lib/hooks'
import { formatDate, formatFileSize, statusLabel, diasUteisRestantes, prazoBadgeColor } from '@/lib/utils'
import type { Project, Document, ExtractedData, Prazo, Peca, ChatMessage, Client } from '@/lib/types'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, BarChart3, CalendarClock, MessageSquare,
  Loader2, CheckCircle2, XCircle, Clock, Plus, X, Send, ChevronDown, Trash2,
} from 'lucide-react'
import DeleteModal from '@/app/dashboard/components/DeleteModal'
import Toast from '@/app/dashboard/components/Toast'

type Tab = 'documentos' | 'analise' | 'prazos' | 'pecas' | 'chat'

/* ─── Constants ──────────────────────────────────────────────── */
const FASE_LABELS: Record<string, string> = {
  analise: 'Análise', contestacao: 'Contestação', recurso: 'Recurso',
  execucao: 'Execução', encerrado: 'Encerrado',
}
const FASE_COLORS: Record<string, string> = {
  analise: '#3B82F6', contestacao: '#F59E0B', recurso: '#EF4444',
  execucao: '#22C55E', encerrado: '#71717A',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ProjectHubPage() {
  const params = useParams()
  const projectId = params.id as string
  const router = useRouter()
  const { firmId } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<Tab>('documentos')
  const [loading, setLoading] = useState(true)
  const [nextPrazoDias, setNextPrazoDias] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function handleDeleteProject() {
    if (!project) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir')
      setToast({ message: 'Processo excluído com sucesso', type: 'success' })
      setShowDeleteModal(false)
      // Redirect after a brief delay to show the toast
      setTimeout(() => router.push('/dashboard/clients'), 1000)
    } catch {
      setToast({ message: 'Erro ao excluir processo', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    async function load() {
      const [projRes, prazoRes] = await Promise.all([
        supabase.from('projects').select('*, clients(name, cnpj)').eq('id', projectId).single(),
        supabase.from('prazos').select('data_prazo').eq('project_id', projectId).eq('status', 'pendente').order('data_prazo').limit(1),
      ])
      if (projRes.data) {
        setProject({
          ...projRes.data,
          client: projRes.data.clients as unknown as Client,
        } as unknown as Project)
      }
      if (prazoRes.data && prazoRes.data.length > 0) {
        setNextPrazoDias(diasUteisRestantes(prazoRes.data[0].data_prazo))
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
      <div className="spinner" />
    </div>
  )
  if (!project) return <p style={{ color: 'var(--text-muted)' }}>Processo não encontrado.</p>

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'documentos', label: 'Documentos', icon: FileText },
    { key: 'analise',    label: 'Análise',    icon: BarChart3 },
    { key: 'prazos',     label: 'Prazos',     icon: CalendarClock },
    { key: 'pecas',      label: 'Peças',      icon: FileText },
    { key: 'chat',       label: 'Chat',       icon: MessageSquare },
  ]

  const faseColor = FASE_COLORS[project.fase] || '#71717A'

  function diasBadgeStyle(dias: number): React.CSSProperties {
    if (dias < 0) return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
    if (dias < 3) return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
    if (dias < 7) return { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
    return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '16px' }}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* ── Sticky Header ────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-primary)',
        paddingBottom: '0',
        marginBottom: '24px',
      }}>
        {/* Project info */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '8px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          marginBottom: '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{project.name}</h1>
                <span className="font-mono" style={{
                  padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                  background: `${faseColor}18`, color: faseColor, border: `1px solid ${faseColor}30`,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {FASE_LABELS[project.fase] || project.fase}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                {project.client?.name && (
                  <Link href={`/dashboard/clients/${project.client_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                    {project.client.name}
                  </Link>
                )}
                {project.numero_processo && (
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    CNJ: {project.numero_processo}
                  </span>
                )}
                {project.vara && <span>{project.vara}</span>}
                {project.comarca && <span>{project.comarca}</span>}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              title="Excluir processo"
              style={{
                width: '34px', height: '34px', borderRadius: '6px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease', flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                e.currentTarget.style.color = '#EF4444'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <Trash2 size={15} />
            </button>

            {/* Dias úteis countdown */}
            {nextPrazoDias !== null && (
              <div style={{
                padding: '10px 16px',
                borderRadius: '8px',
                textAlign: 'center',
                flexShrink: 0,
                ...diasBadgeStyle(nextPrazoDias),
              }}>
                <p className="font-mono" style={{ fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1 }}>
                  {nextPrazoDias < 0 ? 'VENC.' : nextPrazoDias}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0', opacity: 0.8 }}>
                  {nextPrazoDias < 0 ? 'vencido' : 'dias úteis'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0', marginTop: '16px' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px',
                fontSize: '14px', fontWeight: 500,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
                marginBottom: '-1px',
                transition: 'color 150ms ease',
              }}
            >
              <t.icon size={15} strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: '0' }}>
        {tab === 'documentos' && <DocumentosTab projectId={projectId} firmId={firmId} />}
        {tab === 'analise' && <AnaliseTab projectId={projectId} />}
        {tab === 'prazos' && <PrazosTab projectId={projectId} firmId={firmId} />}
        {tab === 'pecas' && <PecasTab projectId={projectId} firmId={firmId} />}
        {tab === 'chat' && <ChatTab projectId={projectId} />}
      </div>

      {/* Delete confirmation modal */}
      <DeleteModal
        open={showDeleteModal}
        title="Excluir Processo"
        message={project
          ? `Tem certeza que deseja excluir o processo "${project.name}"? Esta ação não pode ser desfeita. Todos os documentos, extrações e estratégias associados serão removidos.`
          : ''}
        confirmLabel="Excluir Processo"
        loading={deleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DOCUMENTOS TAB
   ═══════════════════════════════════════════════════════════════ */
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
      case 'pending': return <Clock size={16} style={{ color: 'var(--text-muted)' }} />
      case 'processing': return <Loader2 size={16} style={{ color: 'var(--info)', animation: 'spin 1s linear infinite' }} />
      case 'completed': return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
      case 'error': return <XCircle size={16} style={{ color: 'var(--error)' }} />
      default: return <Clock size={16} style={{ color: 'var(--text-muted)' }} />
    }
  }

  const statusBadgeStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'pending': return { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
      case 'processing': return { background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }
      case 'completed': return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
      case 'error': return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }
      default: return { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '32px',
          borderRadius: '8px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 200ms ease, background 200ms ease',
          background: dragOver ? 'var(--accent-subtle)' : 'var(--bg-card)',
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        <Upload size={28} style={{ margin: '0 auto 10px', color: dragOver ? 'var(--accent)' : 'var(--text-muted)', display: 'block' }} />
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          {uploading ? 'Enviando...' : 'Arraste arquivos aqui ou clique para selecionar'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          PDF, DOCX, TXT — múltiplos arquivos
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="spinner" /></div>
      ) : documents.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Nenhum documento enviado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '8px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              {statusIcon(doc.processing_status)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : ''}
                  {doc.processing_error && <span style={{ color: 'var(--error)' }}> — {doc.processing_error}</span>}
                </p>
              </div>
              <span className="font-mono" style={{
                padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                flexShrink: 0, ...statusBadgeStyle(doc.processing_status),
              }}>
                {statusLabel(doc.processing_status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISE TAB
   ═══════════════════════════════════════════════════════════════ */
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="spinner" /></div>
  if (docs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
        <BarChart3 size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <p style={{ fontSize: '14px' }}>Nenhum documento processado ainda.</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Envie documentos na aba Documentos e aguarde o processamento.</p>
      </div>
    )
  }

  const doc = docs.find(d => d.id === selectedDoc)
  const data = doc?.extracted_data as ExtractedData | null

  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Dados não disponíveis.</p>

  const riskColor = data.risco_estimado === 'alto' ? 'var(--error)' : data.risco_estimado === 'medio' ? 'var(--warning)' : 'var(--success)'
  const riskBg = data.risco_estimado === 'alto' ? 'rgba(239,68,68,0.08)' : data.risco_estimado === 'medio' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {docs.length > 1 && (
        <select
          value={selectedDoc}
          onChange={e => setSelectedDoc(e.target.value)}
          style={{
            ...inputStyle,
            width: 'auto',
            maxWidth: '400px',
            cursor: 'pointer',
          }}
        >
          {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}

      {/* Risk banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '16px 20px', borderRadius: '8px',
        background: riskBg, border: `1px solid ${riskColor}30`,
      }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            Risco Estimado
          </p>
          <p className="font-mono" style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 0', color: riskColor, textTransform: 'uppercase' }}>
            {data.risco_estimado}
          </p>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${riskColor}30`, paddingLeft: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {data.risco_justificativa}
          </p>
        </div>
        {data.valor_causa && (
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
              Valor da Causa
            </p>
            <p className="font-mono" style={{ fontSize: '16px', fontWeight: 600, margin: '4px 0 0', color: 'var(--text-primary)' }}>
              {data.valor_causa}
            </p>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Section title="Resumo Executivo">
            <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{data.resumo_executivo}</p>
          </Section>

          <Section title="Partes">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Autor" value={data.partes.autor} />
              <Field label="Réu" value={data.partes.reu} />
              <Field label="Adv. Autor" value={data.partes.advogado_autor} />
              <Field label="Adv. Réu" value={data.partes.advogado_reu} />
            </div>
          </Section>

          <Section title="Causa de Pedir">
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{data.causa_pedir}</p>
          </Section>

          <Section title="Teses Jurídicas">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.teses_juridicas.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Section title="Pedidos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.pedidos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span className="font-mono" style={{ color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Fatos Relevantes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.fatos_relevantes.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </Section>

          {data.tutela_antecipada.requerida && (
            <Section title="Tutela Antecipada">
              <div style={{
                padding: '10px 14px', borderRadius: '6px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--warning)', margin: '0 0 4px' }}>
                  Requerida
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{data.tutela_antecipada.fundamento}</p>
              </div>
            </Section>
          )}

          {data.prazos_identificados && data.prazos_identificados.length > 0 && (
            <Section title="Prazos Identificados">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.prazos_identificados.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.descricao}</span>
                    {p.data && <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(p.data)}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRAZOS TAB
   ═══════════════════════════════════════════════════════════════ */
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

  function diasBStyle(dias: number): React.CSSProperties {
    if (dias < 0) return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
    if (dias < 3) return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
    if (dias < 7) return { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
    return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
  }

  function statusBStyle(status: string): React.CSSProperties {
    if (status === 'cumprido') return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
    if (status === 'vencido') return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }
    return { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="spinner" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '6px',
            background: 'var(--accent)', color: '#000',
            fontWeight: 600, fontSize: '13px', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Adicionar Prazo
        </button>
      </div>

      {showNew && (
        <div style={{ padding: '16px 20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Descrição</label>
              <input
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                required
                placeholder="Contestação — art. 335 CPC"
                style={{ ...inputStyle, height: '36px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Data</label>
              <input
                type="date"
                value={form.data_prazo}
                onChange={e => setForm({ ...form, data_prazo: e.target.value })}
                required
                style={{ ...inputStyle, height: '36px', width: '160px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
                style={{ ...inputStyle, height: '36px', width: '150px', cursor: 'pointer' }}
              >
                <option value="processual">Processual</option>
                <option value="contratual">Contratual</option>
                <option value="administrativo">Administrativo</option>
              </select>
            </div>
            <button type="submit" disabled={saving} style={{
              height: '36px', padding: '0 16px', borderRadius: '6px',
              background: 'var(--accent)', color: '#000',
              fontWeight: 600, fontSize: '13px', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} style={{
              height: '36px', padding: '0 12px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {prazos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
          Nenhum prazo cadastrado para este processo.
        </p>
      ) : (
        <div style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Descrição', 'Data', 'Tipo', 'Dias Úteis', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prazos.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{p.descricao}</td>
                  <td className="font-mono" style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(p.data_prazo)}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.tipo}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="font-mono" style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      ...diasBStyle(p.dias_uteis_restantes ?? 0),
                    }}>
                      {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="font-mono" style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      textTransform: 'uppercase',
                      ...statusBStyle(p.status),
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PEÇAS TAB
   ═══════════════════════════════════════════════════════════════ */
function PecasTab({ projectId, firmId }: { projectId: string; firmId: string }) {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Peca | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)

  useEffect(() => { loadPecas() }, [projectId])

  async function loadPecas() {
    const { data } = await supabase.from('pecas').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    setPecas(data || [])
    setLoading(false)
  }

  async function generate(tipo: string) {
    setGenerating(tipo)
    setShowGenerate(false)
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="spinner" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Generate buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['contestacao', 'recurso', 'peticao'].map(tipo => (
          <button
            key={tipo}
            onClick={() => generate(tipo)}
            disabled={generating !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '6px',
              background: generating === tipo ? 'var(--accent-hover)' : 'var(--accent)',
              color: '#000', fontWeight: 600, fontSize: '13px',
              border: 'none', cursor: generating !== null ? 'not-allowed' : 'pointer',
              opacity: generating !== null && generating !== tipo ? 0.5 : 1,
            }}
          >
            {generating === tipo && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {generating === tipo ? 'Gerando...' : `Gerar ${tipoLabel[tipo]}`}
          </button>
        ))}
      </div>

      {/* View modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            width: '100%', maxWidth: '720px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: '12px', overflow: 'hidden',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {tipoLabel[selected.tipo] || selected.tipo}
                </h2>
                <p className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  v{selected.versao} · {selected.modelo_ia} · {formatDate(selected.created_at)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: '24px',
              whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7,
              color: 'var(--text-primary)',
            }}>
              {selected.conteudo}
            </div>
          </div>
        </div>
      )}

      {/* Peças list */}
      {pecas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
          Nenhuma peça gerada para este processo.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {pecas.map(peca => (
            <button
              key={peca.id}
              onClick={() => setSelected(peca)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left',
                padding: '12px 16px', borderRadius: '8px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'border-color 150ms ease',
                color: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  {tipoLabel[peca.tipo] || peca.tipo}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{peca.versao}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(peca.created_at)}</span>
                </div>
              </div>
              <span className="font-mono" style={{
                padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
                background: 'var(--bg-input)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
              }}>
                {peca.modelo_ia}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════════════════════════════ */
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
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: '8px', overflow: 'hidden',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      height: '520px',
    }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <MessageSquare size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ fontSize: '14px' }}>Converse com a IA sobre os documentos deste processo.</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Pergunte sobre prazos, teses jurídicas, estratégias, etc.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '70%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              fontSize: '14px', lineHeight: 1.6,
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '12px 12px 12px 4px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            }}>
              <div className="pulse-amber" style={{ display: 'flex', gap: '4px' }}>
                <span>●</span><span>●</span><span>●</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: '8px', padding: '12px 16px',
        borderTop: '1px solid var(--border)', background: 'var(--bg-primary)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte sobre o processo..."
          style={{
            flex: 1, height: '40px', padding: '0 14px', borderRadius: '6px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            height: '40px', width: '40px', borderRadius: '6px',
            background: 'var(--accent)', border: 'none',
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={16} style={{ color: '#000' }} />
        </button>
      </form>
    </div>
  )
}
