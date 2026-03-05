'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Client, Project } from '@/lib/types'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Folder } from 'lucide-react'

const FASE_LABELS: Record<string, string> = {
  analise: 'Análise', contestacao: 'Contestação', recurso: 'Recurso',
  execucao: 'Execução', encerrado: 'Encerrado',
}
const FASE_COLORS: Record<string, string> = {
  analise: '#60A5FA', contestacao: '#F59E0B', recurso: '#F87171',
  execucao: '#34D399', encerrado: '#4B5563',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const { firmId } = useAuth()
  const router = useRouter()

  const [client,   setClient]   = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showNew,  setShowNew]  = useState(false)
  const [form,     setForm]     = useState({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { loadData() }, [clientId, firmId])

  async function loadData() {
    const [clientRes, projRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('projects').select('*, documents(id, processing_status), prazos(data_prazo, status)')
        .eq('client_id', clientId).eq('firm_id', firmId).order('created_at', { ascending: false }),
    ])
    setClient(clientRes.data)
    setProjects(projRes.data || [])
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
      tipo: form.tipo,
      vara: form.vara || null,
      comarca: form.comarca || null,
    }).select().single()
    setSaving(false)
    setShowNew(false)
    setForm({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
    if (data) router.push(`/dashboard/projects/${data.id}`)
  }

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
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{client.name}</h1>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {client.cnpj && <span className="font-mono">CNPJ: {client.cnpj}</span>}
            {client.email && <span>{client.email}</span>}
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

      {/* ── Projects ──────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>
          Processos ({projects.length})
        </h2>

        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
            <Folder size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '14px' }}>Nenhum processo para este cliente.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(project => {
              const proj = project as unknown as Record<string, unknown>
              const docCount = Array.isArray(proj.documents) ? (proj.documents as unknown[]).length : 0
              const faseColor = FASE_COLORS[project.fase] || '#4B5563'

              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  style={{
                    display: 'block', padding: '16px 20px', borderRadius: '8px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'border-color 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{project.name}</p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {project.numero_processo && (
                          <span className="font-mono">{project.numero_processo}</span>
                        )}
                        <span>{docCount} documento{docCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      background: `${faseColor}18`, color: faseColor, border: `1px solid ${faseColor}30`,
                      fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}>
                      {FASE_LABELS[project.fase] || project.fase}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
