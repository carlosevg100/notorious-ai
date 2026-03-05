'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate, diasUteisRestantes } from '@/lib/utils'
import type { Client, Project, Prazo } from '@/lib/types'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Folder, TrendingUp, FileText, CalendarClock, AlertTriangle, Search, Filter } from 'lucide-react'

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
  const [loading,  setLoading]  = useState(true)
  const [showNew,  setShowNew]  = useState(false)
  const [form,     setForm]     = useState({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [faseFilter, setFaseFilter] = useState<string>('all')
  const [tipoFilter, setTipoFilter] = useState<string>('all')

  useEffect(() => { loadData() }, [clientId, firmId])

  async function loadData() {
    const [clientRes, projRes, prazoRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('projects').select('*, documents(id, processing_status, extracted_data)')
        .eq('client_id', clientId).eq('firm_id', firmId).order('created_at', { ascending: false }),
      supabase.from('prazos').select('*').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
    ])
    setClient(clientRes.data)

    const projData = projRes.data || []
    const prazoData = prazoRes.data || []
    setPrazos(prazoData)

    const projectsMeta: ProjectWithMeta[] = projData.map((p: Record<string, unknown>) => {
      const docs = Array.isArray(p.documents) ? p.documents as Record<string, unknown>[] : []
      const projPrazos = prazoData.filter((pr: Prazo) => pr.project_id === p.id && pr.status === 'pendente')
      const nextPrazo = projPrazos.length > 0 ? projPrazos[0].data_prazo : null

      // Get highest risk from extracted data
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
  const prazosCritical = clientPrazos.filter(p => {
    if (p.status !== 'pendente') return false
    const d = diasUteisRestantes(p.data_prazo)
    return d >= 0 && d <= 5
  }).length

  // Risk distribution
  const riskDist = { alto: 0, medio: 0, baixo: 0 }
  projects.forEach(p => {
    if (p._risk === 'alto') riskDist.alto++
    else if (p._risk === 'medio') riskDist.medio++
    else if (p._risk === 'baixo') riskDist.baixo++
  })
  const hasRisk = riskDist.alto + riskDist.medio + riskDist.baixo > 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
      <div className="spinner" />
    </div>
  )

  if (!client) return <p style={{ color: 'var(--text-muted)' }}>Cliente não encontrado.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={14} /> Voltar a Clientes
      </button>

      {/* Client header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{client.name}</h1>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {client.cnpj && <span className="font-mono">CNPJ: {client.cnpj}</span>}
            {client.email && <span>{client.email}</span>}
            <span style={{ textTransform: 'capitalize' }}>{client.type?.replace('_', ' ')}</span>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '6px', flexShrink: 0,
            background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={2} /> Novo Processo
        </button>
      </div>

      {/* ── Client KPIs ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {[
          { label: 'Processos Ativos', value: activeProjects.length, icon: TrendingUp, color: 'var(--accent)' },
          { label: 'Documentos', value: totalDocs, icon: FileText, color: 'var(--info)' },
          { label: 'Docs Pendentes', value: pendingDocs, icon: FileText, color: 'var(--warning)' },
          { label: 'Prazos Críticos', value: prazosCritical, icon: CalendarClock, color: 'var(--warning)' },
          { label: 'Prazos Vencidos', value: prazosVencidos, icon: AlertTriangle, color: 'var(--error)', alert: prazosVencidos > 0 },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '16px',
            borderRadius: '8px',
            background: kpi.alert ? 'rgba(239,68,68,0.05)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderTop: kpi.alert ? '2px solid var(--error)' : '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                {kpi.label}
              </p>
              <kpi.icon size={14} strokeWidth={1.5} style={{ color: kpi.color, opacity: 0.6 }} />
            </div>
            <p className="font-mono" style={{
              fontSize: '26px', fontWeight: 700, margin: 0, lineHeight: 1,
              color: kpi.alert ? 'var(--error)' : 'var(--text-primary)',
            }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Risk Distribution ────────────────────────────── */}
      {hasRisk && (
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>
            Distribuição de Risco
          </h2>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Mini bar */}
            <div style={{ flex: 1, display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '2px', background: 'var(--bg-input)' }}>
              {riskDist.alto > 0 && <div style={{ width: `${(riskDist.alto / (riskDist.alto + riskDist.medio + riskDist.baixo)) * 100}%`, background: '#EF4444', borderRadius: '2px' }} />}
              {riskDist.medio > 0 && <div style={{ width: `${(riskDist.medio / (riskDist.alto + riskDist.medio + riskDist.baixo)) * 100}%`, background: '#F59E0B', borderRadius: '2px' }} />}
              {riskDist.baixo > 0 && <div style={{ width: `${(riskDist.baixo / (riskDist.alto + riskDist.medio + riskDist.baixo)) * 100}%`, background: '#22C55E', borderRadius: '2px' }} />}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
              {[
                { label: 'Alto', color: '#EF4444', count: riskDist.alto },
                { label: 'Médio', color: '#F59E0B', count: riskDist.medio },
                { label: 'Baixo', color: '#22C55E', count: riskDist.baixo },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: r.color }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Novo Processo ──────────────────────────── */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Novo Processo</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={18} />
              </button>
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
                  <input
                    placeholder={placeholder}
                    value={(form as Record<string, string>)[field]}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    required={required}
                    style={{ ...inputStyle, fontFamily: mono ? 'var(--font-mono)' : undefined }}
                  />
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
                <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Criando...' : 'Criar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Process Table with Filters ───────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Processos ({filteredProjects.length})
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="Buscar processo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  height: '32px', paddingLeft: '30px', paddingRight: '12px', borderRadius: '6px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                  fontSize: '13px', outline: 'none', width: '200px',
                }}
              />
            </div>
            {/* Fase filter */}
            <select
              value={faseFilter}
              onChange={e => setFaseFilter(e.target.value)}
              style={{
                height: '32px', padding: '0 8px', borderRadius: '6px',
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                fontSize: '13px', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">Todas as fases</option>
              {Object.entries(FASE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {/* Tipo filter */}
            <select
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
              style={{
                height: '32px', padding: '0 8px', borderRadius: '6px',
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                fontSize: '13px', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">Todos os tipos</option>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
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
                  {['Nome', 'Nº Processo', 'Tipo', 'Fase', 'Docs', 'Próx. Prazo', 'Risco'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => {
                  const faseColor = FASE_COLORS[project.fase] || '#71717A'
                  return (
                    <tr
                      key={project.id}
                      style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{project.name}</p>
                      </td>
                      <td className="font-mono" style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {project.numero_processo || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {TIPO_LABELS[project.tipo] || project.tipo}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="font-mono" style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: `${faseColor}18`, color: faseColor, border: `1px solid ${faseColor}30`,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {FASE_LABELS[project.fase] || project.fase}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {project._doc_count}
                        {project._pending_docs > 0 && (
                          <span style={{ color: 'var(--warning)', marginLeft: '4px' }}>({project._pending_docs})</span>
                        )}
                      </td>
                      <td className="font-mono" style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {project._next_prazo ? formatDate(project._next_prazo) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {project._risk ? (
                          <span className="font-mono" style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            textTransform: 'uppercase',
                            background: project._risk === 'alto' ? 'rgba(239,68,68,0.12)' : project._risk === 'medio' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                            color: project._risk === 'alto' ? '#EF4444' : project._risk === 'medio' ? '#F59E0B' : '#22C55E',
                            border: `1px solid ${project._risk === 'alto' ? 'rgba(239,68,68,0.25)' : project._risk === 'medio' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
                          }}>
                            {project._risk}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
