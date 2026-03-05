'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate, diasUteisRestantes } from '@/lib/utils'
import type { Client, Project, Prazo } from '@/lib/types'
import Link from 'next/link'
import {
  ArrowLeft, Plus, X, Folder, TrendingUp, FileText, CalendarClock,
  AlertTriangle, Search, Clock, Shield, DollarSign, MapPin, Activity,
  Download, ChevronRight, Trash2
} from 'lucide-react'
import NovoProcessoModal from '@/app/dashboard/components/NovoProcessoModal'
import DeleteModal from '@/app/dashboard/components/DeleteModal'
import Toast from '@/app/dashboard/components/Toast'

/* ─── Constants ──────────────────────────────────────────────── */
const FASE_LABELS: Record<string, string> = {
  analise: 'Análise', contestacao: 'Contestação', recurso: 'Recurso',
  execucao: 'Execução', encerrado: 'Encerrado',
}
const FASE_COLORS: Record<string, string> = {
  analise: '#3B82F6', contestacao: '#F59E0B', recurso: '#EF4444',
  execucao: '#22C55E', encerrado: '#71717A',
}
const TIPO_LABELS: Record<string, string> = {
  contencioso: 'Contencioso', trabalhista: 'Trabalhista',
  tributario: 'Tributário', consultivo: 'Consultivo',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

const cardStyle: React.CSSProperties = {
  padding: '20px',
  borderRadius: '10px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

interface ProjectWithMeta extends Project {
  _doc_count: number
  _pending_docs: number
  _next_prazo: string | null
  _risk: string | null
}

/* ─── Component ──────────────────────────────────────────────── */
export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const { firmId } = useAuth()
  const router = useRouter()

  const [client,   setClient]   = useState<Client | null>(null)
  const [projects, setProjects] = useState<ProjectWithMeta[]>([])
  const [prazos,   setPrazos]   = useState<Prazo[]>([])
  const [pecas,    setPecas]    = useState<{id:string;tipo:string;created_at:string;project_id:string}[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showNew,  setShowNew]  = useState(false)
  const [novoProcessoOpen, setNovoProcessoOpen] = useState(false)
  const [form,     setForm]     = useState({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [faseFilter, setFaseFilter] = useState<string>('all')
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview'|'processos'|'alertas'|'atividade'>('overview')
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectWithMeta | null>(null)
  const [deletingProject, setDeletingProject] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => { loadData() }, [clientId, firmId])

  async function handleDeleteProject() {
    if (!deleteProjectTarget) return
    setDeletingProject(true)
    try {
      const res = await fetch(`/api/projects/${deleteProjectTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir')
      setToast({ message: 'Processo excluído com sucesso', type: 'success' })
      setDeleteProjectTarget(null)
      loadData()
    } catch {
      setToast({ message: 'Erro ao excluir processo', type: 'error' })
    } finally {
      setDeletingProject(false)
    }
  }

  async function loadData() {
    const [clientRes, projRes, prazoRes, pecaRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('projects').select('*, documents(id, processing_status, extracted_data)')
        .eq('client_id', clientId).eq('firm_id', firmId).order('created_at', { ascending: false }),
      supabase.from('prazos').select('*').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
      supabase.from('pecas').select('id, tipo, created_at, project_id').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(20),
    ])
    setClient(clientRes.data)

    const projData = projRes.data || []
    const prazoData = prazoRes.data || []
    setPrazos(prazoData)
    setPecas((pecaRes.data || []).filter((p: {project_id:string}) => projData.some((pr: {id:string}) => pr.id === p.project_id)))

    const projectsMeta: ProjectWithMeta[] = projData.map((p: Record<string, unknown>) => {
      const docs = Array.isArray(p.documents) ? p.documents as Record<string, unknown>[] : []
      const projPrazos = prazoData.filter((pr: Prazo) => pr.project_id === p.id && pr.status === 'pendente')
      const nextPrazo = projPrazos.length > 0 ? projPrazos[0].data_prazo : null

      let highestRisk: string | null = null
      docs.forEach((d: Record<string, unknown>) => {
        const ed = d.extracted_data as { risco_estimado?: string } | null
        if (ed?.risco_estimado) {
          if (!highestRisk || riskPriority(ed.risco_estimado) > riskPriority(highestRisk)) {
            highestRisk = ed.risco_estimado
          }
        }
      })

      return {
        ...p as unknown as Project,
        _doc_count: docs.length,
        _pending_docs: docs.filter((d: Record<string, unknown>) =>
          d.processing_status === 'pending' || d.processing_status === 'processing'
        ).length,
        _next_prazo: nextPrazo,
        _risk: highestRisk,
      }
    })

    setProjects(projectsMeta)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase.from('projects').insert({
      firm_id: firmId,
      client_id: clientId,
      name: form.name,
      numero_processo: form.numero_processo || null,
      area: form.tipo === 'contencioso' ? 'Contencioso' : form.tipo === 'trabalhista' ? 'Trabalhista' : 'Cível',
      tipo: form.tipo,
      fase: 'analise',
      status: 'ativo',
      vara: form.vara || null,
      comarca: form.comarca || null,
    }).select().single()
    setSaving(false)
    setShowNew(false)
    setForm({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
    if (data) router.push(`/dashboard/projects/${data.id}`)
  }

  /* ─── Computed ─────────────────────────────────────────────── */
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (faseFilter !== 'all' && p.fase !== faseFilter) return false
      if (tipoFilter !== 'all' && p.tipo !== tipoFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!p.name.toLowerCase().includes(s) && !(p.numero_processo || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [projects, faseFilter, tipoFilter, search])

  const activeProjects = projects.filter(p => p.status === 'ativo')
  const totalDocs = projects.reduce((s, p) => s + p._doc_count, 0)
  const pendingDocs = projects.reduce((s, p) => s + p._pending_docs, 0)

  const clientPrazos = prazos.filter(p => projects.some(pr => pr.id === p.project_id))
  const prazosVencidos = clientPrazos.filter(p => p.status === 'pendente' && diasUteisRestantes(p.data_prazo) < 0).length
  const prazosHoje = clientPrazos.filter(p => {
    if (p.status !== 'pendente') return false
    const d = diasUteisRestantes(p.data_prazo)
    return d === 0
  }).length
  const prazosSemana = clientPrazos.filter(p => {
    if (p.status !== 'pendente') return false
    const d = diasUteisRestantes(p.data_prazo)
    return d >= 0 && d <= 5
  }).length
  const urgencias = prazosVencidos + prazosHoje

  // Risk distribution
  const riskDist = { alto: 0, medio: 0, baixo: 0 }
  projects.forEach(p => {
    if (p._risk === 'alto') riskDist.alto++
    else if (p._risk === 'medio') riskDist.medio++
    else if (p._risk === 'baixo') riskDist.baixo++
  })
  const totalRisk = riskDist.alto + riskDist.medio + riskDist.baixo

  // Pipeline
  const pipeline: Record<string, number> = { analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 }
  projects.forEach(p => { if (p.fase in pipeline) pipeline[p.fase]++ })
  const totalPipeline = Object.values(pipeline).reduce((a, b) => a + b, 0) || 1

  // Comarcas
  const comarcaMap = new Map<string, number>()
  projects.forEach(p => {
    const c = p.comarca || 'Não informada'
    comarcaMap.set(c, (comarcaMap.get(c) || 0) + 1)
  })
  const comarcas = [...comarcaMap.entries()].sort((a, b) => b[1] - a[1])

  // Taxa de êxito (placeholder — needs encerrado data with outcome)
  const encerrados = projects.filter(p => p.fase === 'encerrado')

  // Activity items
  const activityItems: { id: string; desc: string; time: string; color: string }[] = []
  pecas.forEach(p => {
    activityItems.push({
      id: p.id,
      desc: `Peça gerada: ${p.tipo}`,
      time: timeAgo(p.created_at),
      color: '#F0A500',
    })
  })
  clientPrazos.filter(p => p.status === 'pendente').slice(0, 5).forEach(p => {
    const dias = diasUteisRestantes(p.data_prazo)
    activityItems.push({
      id: p.id,
      desc: `Prazo: ${p.descricao}`,
      time: dias < 0 ? 'Vencido' : dias === 0 ? 'Hoje' : `${dias} d.u.`,
      color: dias < 0 ? '#EF4444' : dias <= 3 ? '#F59E0B' : '#22C55E',
    })
  })

  // Initials
  const initials = client ? client.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : '?'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
      <div className="spinner" />
    </div>
  )

  if (!client) return <p style={{ color: 'var(--text-muted)' }}>Cliente não encontrado.</p>

  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'processos', label: 'Processos' },
    { key: 'alertas', label: 'Alertas', count: urgencias },
    { key: 'atividade', label: 'Atividade' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Breadcrumb + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <button onClick={() => router.push('/dashboard/clients')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontSize: '13px' }}>
            Clientes
          </button>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--text-primary)' }}>{client.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {urgencias > 0 && (
            <span style={{
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
              background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              {urgencias} urgência{urgencias > 1 ? 's' : ''}
            </span>
          )}
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '6px',
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            fontSize: '13px', cursor: 'pointer',
          }}>
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => setNovoProcessoOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '6px',
            background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '13px', border: 'none', cursor: 'pointer',
          }}>
            <Plus size={14} strokeWidth={2.5} /> Novo Processo
          </button>
        </div>
      </div>

      {/* Client Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Avatar */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'var(--accent)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{client.name}</h1>
            <span style={{
              padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)',
            }}>
              Ativo
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {client.cnpj && <span className="font-mono">{client.cnpj}</span>}
            {client.cnpj && client.email && <span>·</span>}
            {client.email && <span>{client.email}</span>}
            <span>·</span>
            <span>desde {formatDate(client.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                background: 'rgba(239,68,68,0.15)', color: '#EF4444',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════ OVERVIEW TAB ══════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Row 1: Main KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {[
              { label: 'Processos Ativos', value: activeProjects.length.toString(), color: 'var(--text-primary)' },
              { label: 'Prazos Hoje', value: prazosHoje.toString(), color: prazosHoje > 0 ? '#22C55E' : 'var(--text-primary)' },
              { label: 'Prazos na Semana', value: prazosSemana.toString(), color: prazosSemana > 0 ? '#F59E0B' : 'var(--text-primary)' },
              { label: 'Urgências', value: urgencias.toString(), color: urgencias > 0 ? '#EF4444' : 'var(--text-primary)', alert: urgencias > 0 },
              { label: 'Taxa de Êxito', value: encerrados.length > 0 ? '—' : '—', color: '#22C55E' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                ...cardStyle,
                borderTop: kpi.alert ? '2px solid #EF4444' : undefined,
              }}>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                  {kpi.label}
                </p>
                <p className="font-mono" style={{ fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1, color: kpi.color }}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Row 2: Financial KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Valor Total das Causas', value: 'R$ 0', sub: 'soma dos valores de causa', color: 'var(--text-primary)', icon: DollarSign },
              { label: 'Risco Financeiro Estimado', value: 'R$ 0', sub: 'estimativa AI de exposição real', color: '#F59E0B', icon: Shield },
              { label: 'Condenações Acumuladas', value: 'R$ 0', sub: 'processos encerrados desfavoráveis', color: '#EF4444', icon: AlertTriangle },
            ].map(kpi => (
              <div key={kpi.label} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                    {kpi.label}
                  </p>
                  <kpi.icon size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                </div>
                <p className="font-mono" style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 4px', lineHeight: 1, color: kpi.color }}>
                  {kpi.value}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Row 3: Pipeline + Risk + Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>

            {/* Pipeline */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>Pipeline</h3>
              {/* Stacked bar */}
              <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '2px', background: 'var(--bg-input)', marginBottom: '16px' }}>
                {Object.entries(FASE_COLORS).map(([key, color]) => {
                  const count = pipeline[key] || 0
                  if (count === 0) return null
                  return <div key={key} style={{ width: `${(count / totalPipeline) * 100}%`, background: color, borderRadius: '2px' }} />
                })}
              </div>
              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(FASE_LABELS).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: FASE_COLORS[key], flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                    <div style={{ width: '60px', height: '4px', borderRadius: '2px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${((pipeline[key] || 0) / totalPipeline) * 100}%`, height: '100%', background: FASE_COLORS[key], borderRadius: '2px' }} />
                    </div>
                    <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', width: '20px', textAlign: 'right' }}>
                      {pipeline[key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Distribution */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>Distribuição de Risco</h3>
              {totalRisk > 0 ? (
                <>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '2px', background: 'var(--bg-input)', marginBottom: '16px' }}>
                    {riskDist.alto > 0 && <div style={{ width: `${(riskDist.alto / totalRisk) * 100}%`, background: '#EF4444', borderRadius: '2px' }} />}
                    {riskDist.medio > 0 && <div style={{ width: `${(riskDist.medio / totalRisk) * 100}%`, background: '#F59E0B', borderRadius: '2px' }} />}
                    {riskDist.baixo > 0 && <div style={{ width: `${(riskDist.baixo / totalRisk) * 100}%`, background: '#22C55E', borderRadius: '2px' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Alto', color: '#EF4444', count: riskDist.alto },
                      { label: 'Médio', color: '#F59E0B', count: riskDist.medio },
                      { label: 'Baixo', color: '#22C55E', count: riskDist.baixo },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{r.label}</span>
                        <span className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: r.color }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem dados de risco ainda.</p>
              )}
            </div>

            {/* Activity */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>Atividade Recente</h3>
              {activityItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activityItems.slice(0, 6).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.desc}
                      </span>
                      <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhuma atividade recente.</p>
              )}
            </div>
          </div>

          {/* Row 4: Por Comarca */}
          {comarcas.length > 0 && (
            <div style={{ ...cardStyle, maxWidth: '400px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} style={{ color: 'var(--text-muted)' }} /> Por Comarca
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {comarcas.map(([comarca, count]) => (
                  <div key={comarca} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{comarca}</span>
                    <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ PROCESSOS TAB ══════ */}
      {activeTab === 'processos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Processos ({filteredProjects.length})
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input placeholder="Buscar processo..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ height: '32px', paddingLeft: '30px', paddingRight: '12px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '200px' }}
                />
              </div>
              <select value={faseFilter} onChange={e => setFaseFilter(e.target.value)}
                style={{ height: '32px', padding: '0 8px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                <option value="all">Todas as fases</option>
                {Object.entries(FASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
                style={{ height: '32px', padding: '0 8px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                <option value="all">Todos os tipos</option>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <Folder size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '14px' }}>
                {projects.length === 0 ? 'Nenhum processo para este cliente.' : 'Nenhum processo corresponde aos filtros.'}
              </p>
            </div>
          ) : (
            <div style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Nome', 'Nº Processo', 'Tipo', 'Fase', 'Docs', 'Próx. Prazo', 'Risco', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(project => {
                    const faseColor = FASE_COLORS[project.fase] || '#71717A'
                    return (
                      <tr key={project.id} style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{project.name}</p>
                        </td>
                        <td className="font-mono" style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{project.numero_processo || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{TIPO_LABELS[project.tipo] || project.tipo}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="font-mono" style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: `${faseColor}18`, color: faseColor, border: `1px solid ${faseColor}30`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {FASE_LABELS[project.fase] || project.fase}
                          </span>
                        </td>
                        <td className="font-mono" style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {project._doc_count}
                          {project._pending_docs > 0 && <span style={{ color: 'var(--warning)', marginLeft: '4px' }}>({project._pending_docs})</span>}
                        </td>
                        <td className="font-mono" style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{project._next_prazo ? formatDate(project._next_prazo) : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {project._risk ? (
                            <span className="font-mono" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                              background: project._risk === 'alto' ? 'rgba(239,68,68,0.12)' : project._risk === 'medio' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                              color: project._risk === 'alto' ? '#EF4444' : project._risk === 'medio' ? '#F59E0B' : '#22C55E',
                              border: `1px solid ${project._risk === 'alto' ? 'rgba(239,68,68,0.25)' : project._risk === 'medio' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
                            }}>{project._risk}</span>
                          ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        {/* Delete button */}
                        <td style={{ padding: '12px 8px', width: '40px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteProjectTarget(project) }}
                            title="Excluir processo"
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: 'transparent', border: '1px solid transparent',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 150ms ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                              e.currentTarget.style.color = '#EF4444'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.borderColor = 'transparent'
                              e.currentTarget.style.color = 'var(--text-muted)'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* ══════ ALERTAS TAB ══════ */}
      {activeTab === 'alertas' && (
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Alertas ({urgencias})
          </h2>
          {urgencias === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 20px' }}>
              <p style={{ fontSize: '14px', color: '#22C55E' }}>✓ Nenhuma urgência pendente</p>
            </div>
          )}
          {clientPrazos.filter(p => p.status === 'pendente' && diasUteisRestantes(p.data_prazo) < 0).map(p => (
            <div key={p.id} style={{ ...cardStyle, borderLeft: '3px solid #EF4444', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' }}>{p.descricao}</p>
                  <p className="font-mono" style={{ fontSize: '12px', margin: 0, color: '#EF4444' }}>Vencido — {formatDate(p.data_prazo)}</p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>VENCIDO</span>
              </div>
            </div>
          ))}
          {clientPrazos.filter(p => p.status === 'pendente' && diasUteisRestantes(p.data_prazo) === 0).map(p => (
            <div key={p.id} style={{ ...cardStyle, borderLeft: '3px solid #F59E0B', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' }}>{p.descricao}</p>
                  <p className="font-mono" style={{ fontSize: '12px', margin: 0, color: '#F59E0B' }}>Vence hoje — {formatDate(p.data_prazo)}</p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>HOJE</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════ ATIVIDADE TAB ══════ */}
      {activeTab === 'atividade' && (
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>Atividade</h2>
          {activityItems.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Nenhuma atividade registrada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityItems.map(item => (
                <div key={item.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{item.desc}</span>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ MODAL: NOVO PROCESSO ══════ */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Novo Processo</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Nome do processo *', field: 'name', placeholder: 'Ação de Cobrança — Empresa X', required: true },
                { label: 'Número do processo', field: 'numero_processo', placeholder: '0000000-00.0000.0.00.0000', mono: true },
                { label: 'Vara', field: 'vara', placeholder: '1ª Vara Cível' },
                { label: 'Comarca', field: 'comarca', placeholder: 'São Paulo' },
              ].map(({ label, field, placeholder, required, mono }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</label>
                  <input placeholder={placeholder} value={(form as Record<string, string>)[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required={required}
                    style={{ ...inputStyle, fontFamily: mono ? 'var(--font-mono)' : undefined }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="contencioso">Contencioso</option>
                  <option value="trabalhista">Trabalhista</option>
                  <option value="tributario">Tributário</option>
                  <option value="consultivo">Consultivo</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Criando...' : 'Criar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NovoProcessoModal
        open={novoProcessoOpen}
        onClose={() => setNovoProcessoOpen(false)}
        onSuccess={() => {
          setNovoProcessoOpen(false)
          loadData()
        }}
        preSelectedClientId={clientId}
      />

      {/* Delete project confirmation modal */}
      <DeleteModal
        open={!!deleteProjectTarget}
        title="Excluir Processo"
        message={deleteProjectTarget
          ? `Tem certeza que deseja excluir o processo "${deleteProjectTarget.name}"? Esta ação não pode ser desfeita. Todos os documentos, extrações e estratégias associados serão removidos.`
          : ''}
        confirmLabel="Excluir Processo"
        loading={deletingProject}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteProjectTarget(null)}
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

/* ─── Helpers ────────────────────────────────────────────────── */
function riskPriority(risk: string): number {
  if (risk === 'alto') return 3
  if (risk === 'medio') return 2
  if (risk === 'baixo') return 1
  return 0
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
