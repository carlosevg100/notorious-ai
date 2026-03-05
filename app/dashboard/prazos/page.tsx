'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Prazo } from '@/lib/types'
import Link from 'next/link'
import { CalendarClock, Plus, X, Search } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

function diasBadgeStyle(dias: number): React.CSSProperties {
  if (dias < 0)  return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
  if (dias < 3)  return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
  if (dias < 7)  return { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
  return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
}

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'cumprido') return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
  if (status === 'vencido') return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }
  return { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }
}

interface PrazoWithMeta extends Prazo {
  project_name?: string
}

export default function PrazosPage() {
  const { firmId } = useAuth()
  const [prazos, setPrazos] = useState<PrazoWithMeta[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ descricao: '', data_prazo: '', tipo: 'processual', project_id: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tipoFilter, setTipoFilter] = useState('all')

  useEffect(() => { loadData() }, [firmId])

  async function loadData() {
    const [prazoRes, projRes] = await Promise.all([
      supabase.from('prazos').select('*, projects(name)').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
      supabase.from('projects').select('id, name').eq('firm_id', firmId).eq('status', 'ativo').order('name'),
    ])

    setPrazos((prazoRes.data || []).map((p: Record<string, unknown>) => ({
      ...p as unknown as Prazo,
      project_name: p.projects ? (p.projects as { name: string }).name : undefined,
      dias_uteis_restantes: diasUteisRestantes((p as unknown as Prazo).data_prazo),
    })))
    setProjects(projRes.data || [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return
    setSaving(true)
    await supabase.from('prazos').insert({
      firm_id: firmId,
      project_id: form.project_id,
      descricao: form.descricao,
      data_prazo: form.data_prazo,
      tipo: form.tipo,
    })
    setForm({ descricao: '', data_prazo: '', tipo: 'processual', project_id: '' })
    setShowNew(false)
    setSaving(false)
    loadData()
  }

  const filteredPrazos = useMemo(() => {
    return prazos.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (tipoFilter !== 'all' && p.tipo !== tipoFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!p.descricao.toLowerCase().includes(s) && !(p.project_name || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [prazos, statusFilter, tipoFilter, search])

  // Stats
  const pendentes = prazos.filter(p => p.status === 'pendente')
  const vencidos = pendentes.filter(p => (p.dias_uteis_restantes ?? 0) < 0).length
  const criticos = pendentes.filter(p => { const d = p.dias_uteis_restantes ?? 0; return d >= 0 && d <= 3 }).length
  const proximos = pendentes.filter(p => { const d = p.dias_uteis_restantes ?? 0; return d > 3 && d <= 7 }).length

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}><div className="spinner" /></div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Prazos</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gestão de prazos — CPC art. 219 (dias úteis)
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '6px',
            background: 'var(--accent)', color: '#000',
            fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={2} /> Novo Prazo
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Pendentes', value: pendentes.length, color: 'var(--text-primary)', alert: false },
          { label: 'Vencidos', value: vencidos, color: 'var(--error)', alert: vencidos > 0 },
          { label: 'Críticos (≤3 d.u.)', value: criticos, color: '#EF4444', alert: criticos > 0 },
          { label: 'Próximos (≤7 d.u.)', value: proximos, color: 'var(--warning)', alert: false },
        ].map(s => (
          <div key={s.label} style={{
            padding: '14px 16px', borderRadius: '8px',
            background: s.alert ? 'rgba(239,68,68,0.05)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderTop: s.alert ? '2px solid var(--error)' : '1px solid var(--border)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>{s.label}</p>
            <p className="font-mono" style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 0', color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Modal: Novo Prazo ──────────────────────────────── */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', maxWidth: '480px', padding: '28px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Novo Prazo</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Processo *</label>
                <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} required style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Selecione o processo...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Descrição *</label>
                <input placeholder="Contestação — art. 335 CPC" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Data *</label>
                  <input type="date" value={form.data_prazo} onChange={e => setForm({ ...form, data_prazo: e.target.value })} required style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="processual">Processual</option>
                    <option value="contratual">Contratual</option>
                    <option value="administrativo">Administrativo</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : 'Criar Prazo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Buscar prazo ou processo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, height: '36px', paddingLeft: '32px' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="cumprido">Cumprido</option>
          <option value="vencido">Vencido</option>
        </select>
        <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          <option value="all">Todos os tipos</option>
          <option value="processual">Processual</option>
          <option value="contratual">Contratual</option>
          <option value="administrativo">Administrativo</option>
        </select>
      </div>

      {/* Table */}
      {filteredPrazos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <CalendarClock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '14px' }}>{prazos.length === 0 ? 'Nenhum prazo cadastrado.' : 'Nenhum prazo corresponde aos filtros.'}</p>
        </div>
      ) : (
        <div style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Descrição', 'Processo', 'Data', 'Tipo', 'Dias Úteis', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPrazos.map(p => (
                <tr
                  key={p.id}
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{p.descricao}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Link href={`/dashboard/projects/${p.project_id}`} style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>
                      {p.project_name || '—'}
                    </Link>
                  </td>
                  <td className="font-mono" style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDate(p.data_prazo)}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.tipo}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="font-mono" style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      ...diasBadgeStyle(p.dias_uteis_restantes ?? 0),
                    }}>
                      {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="font-mono" style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      textTransform: 'uppercase',
                      ...statusBadgeStyle(p.status),
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
