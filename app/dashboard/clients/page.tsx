'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Client } from '@/lib/types'
import Link from 'next/link'
import { Plus, Building2, X, Search, Trash2 } from 'lucide-react'
import DeleteModal from '@/app/dashboard/components/DeleteModal'
import Toast from '@/app/dashboard/components/Toast'

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  borderRadius: '6px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

interface ClientWithMeta extends Client {
  _project_count: number
  _next_prazo: string | null
  _risk_level: string | null
}

function riskBadgeStyle(risk: string | null): React.CSSProperties {
  if (risk === 'alto') return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }
  if (risk === 'medio') return { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }
  if (risk === 'baixo') return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
  return {}
}

function ClientsPageInner() {
  const { firmId } = useAuth()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')
  const [clients, setClients] = useState<ClientWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]       = useState({ name: '', cnpj: '', email: '', type: 'empresa' })
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<ClientWithMeta | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auto-open "Novo Cliente" modal when navigated with ?action=new
  useEffect(() => {
    if (action === 'new') {
      setShowNew(true)
    }
  }, [action])

  useEffect(() => { loadClients() }, [firmId])

  async function loadClients() {
    const [clientRes, projRes, docRes, prazoRes] = await Promise.all([
      supabase.from('clients').select('*, projects(id, status)').eq('firm_id', firmId).order('name'),
      supabase.from('projects').select('id, client_id, status').eq('firm_id', firmId),
      supabase.from('documents').select('id, project_id, extracted_data').eq('firm_id', firmId).eq('processing_status', 'completed'),
      supabase.from('prazos').select('id, project_id, data_prazo, status').eq('firm_id', firmId).eq('status', 'pendente').order('data_prazo'),
    ])

    const projects = projRes.data || []
    const docs = docRes.data || []
    const prazos = prazoRes.data || []

    const clientsData: ClientWithMeta[] = (clientRes.data || []).map((c: Record<string, unknown>) => {
      const clientProjects = projects.filter(p => p.client_id === c.id)
      const projectIds = new Set(clientProjects.map(p => p.id))

      // Highest risk across all projects
      let highestRisk: string | null = null
      docs.forEach(d => {
        if (projectIds.has(d.project_id)) {
          const ed = d.extracted_data as { risco_estimado?: string } | null
          if (ed?.risco_estimado) {
            if (!highestRisk || riskPriority(ed.risco_estimado) > riskPriority(highestRisk)) {
              highestRisk = ed.risco_estimado
            }
          }
        }
      })

      // Nearest prazo
      const clientPrazos = prazos.filter(p => projectIds.has(p.project_id))
      const nextPrazo = clientPrazos.length > 0 ? clientPrazos[0].data_prazo : null

      return {
        ...c as unknown as Client,
        _project_count: Array.isArray(c.projects) ? (c.projects as unknown[]).length : 0,
        _next_prazo: nextPrazo,
        _risk_level: highestRisk,
      }
    })

    setClients(clientsData)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('clients').insert({
      firm_id: firmId,
      name: form.name,
      cnpj: form.cnpj || null,
      email: form.email || null,
      type: form.type,
    })
    setForm({ name: '', cnpj: '', email: '', type: 'empresa' })
    setShowNew(false)
    setSaving(false)
    loadClients()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir')
      setToast({ message: 'Cliente excluído com sucesso', type: 'success' })
      setDeleteTarget(null)
      loadClients()
    } catch {
      setToast({ message: 'Erro ao excluir cliente', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.name.toLowerCase().includes(s) && !(c.cnpj || '').includes(s) && !(c.email || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [clients, typeFilter, search])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Banner: new-process guidance */}
      {action === 'new-process' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', borderRadius: '8px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
          color: 'var(--text-primary)', fontSize: '13px',
        }}>
          <span style={{ fontSize: '18px' }}>⚖️</span>
          <span><strong>Novo Processo:</strong> selecione um cliente abaixo para abrir a ficha e criar o processo.</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="font-serif" style={{ fontSize: '20px', fontWeight: 400, margin: 0, color: 'var(--text-primary)' }}>Clientes</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '6px',
            background: 'var(--accent)', color: '#000000',
            fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={2} />
          Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Buscar por nome, CNPJ ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              height: '36px',
              paddingLeft: '32px',
            }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            height: '36px', padding: '0 10px', borderRadius: '6px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="all">Todos os tipos</option>
          <option value="empresa">Empresa / PJ</option>
          <option value="pessoa_fisica">Pessoa Física</option>
          <option value="orgao_publico">Órgão Público</option>
        </select>
      </div>

      {/* ── Modal: Novo Cliente ───────────────────────────── */}
      {showNew && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            width: '100%', maxWidth: '440px',
            padding: '28px', borderRadius: '12px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Novo Cliente</h2>
              <button
                onClick={() => setShowNew(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nome / Razão Social *
                </label>
                <input placeholder="Empresa Ltda." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  CNPJ
                </label>
                <input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Email de contato
                </label>
                <input type="email" placeholder="contato@empresa.com.br" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Tipo
                </label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="empresa">Empresa / PJ</option>
                  <option value="pessoa_fisica">Pessoa Física</option>
                  <option value="orgao_publico">Órgão Público</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ flex: 1, height: '40px', borderRadius: '6px', background: 'var(--accent)', color: '#000000', fontWeight: 600, fontSize: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Client Grid ───────────────────────────────────── */}
      {filteredClients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '14px' }}>{search || typeFilter !== 'all' ? 'Nenhum cliente corresponde aos filtros.' : 'Nenhum cliente cadastrado.'}</p>
          {!search && typeFilter === 'all' && (
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Clique em &quot;Novo Cliente&quot; para começar.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filteredClients.map(client => (
            <div
              key={client.id}
              style={{ position: 'relative' }}
              className="client-card-wrapper"
            >
              <Link
                href={`/dashboard/clients/${client.id}`}
                style={{
                  display: 'block',
                  padding: '20px',
                  paddingRight: '44px',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                    {client.name}
                  </h3>
                  {client._risk_level && (
                    <span className="font-mono" style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                      textTransform: 'uppercase', flexShrink: 0,
                      ...riskBadgeStyle(client._risk_level),
                    }}>
                      {client._risk_level}
                    </span>
                  )}
                </div>
                {client.cnpj && (
                  <p className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {client.cnpj}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {client._project_count || 0} processo{(client._project_count || 0) !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {client.type?.replace('_', ' ')}
                  </span>
                  {client._next_prazo && (
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Prazo: {formatDate(client._next_prazo)}
                    </span>
                  )}
                </div>
              </Link>
              {/* Delete button — overlaid top-right */}
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(client) }}
                title="Excluir cliente"
                style={{
                  position: 'absolute', top: '12px', right: '12px',
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms ease',
                  zIndex: 1,
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
            </div>
          ))}
        </div>
      )}
      {/* Delete confirmation modal */}
      <DeleteModal
        open={!!deleteTarget}
        title="Excluir Cliente"
        message={deleteTarget
          ? `Tem certeza que deseja excluir o cliente "${deleteTarget.name}"? Todos os processos associados a este cliente também serão removidos.`
          : ''}
        confirmLabel="Excluir Cliente"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
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

function riskPriority(risk: string): number {
  if (risk === 'alto') return 3
  if (risk === 'medio') return 2
  if (risk === 'baixo') return 1
  return 0
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}><div className="spinner" /></div>}>
      <ClientsPageInner />
    </Suspense>
  )
}
