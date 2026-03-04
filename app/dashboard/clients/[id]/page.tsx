'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'

interface Client {
  id: string
  name: string
  cnpj?: string
  email?: string
  type: string
  projects?: Project[]
}

interface Project {
  id: string
  name: string
  numero_processo?: string
  tipo: string
  fase: string
  status: string
  created_at: string
}

const FASE_LABELS: Record<string, string> = {
  analise: 'Análise', contestacao: 'Contestação',
  recurso: 'Recurso', execucao: 'Execução', encerrado: 'Encerrado'
}

const TIPO_LABELS: Record<string, string> = {
  contencioso: 'Contencioso', consultivo: 'Consultivo',
  trabalhista: 'Trabalhista', tributario: 'Tributário'
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setClient(data)
      setLoading(false)
    })
  }, [id])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, client_id: id })
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setSaving(false); return }
    setClient(prev => prev ? { ...prev, projects: [data, ...(prev.projects || [])] } : prev)
    setShowModal(false)
    setForm({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
    setSaving(false)
  }

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-4)' }}>Carregando...</span>
    </div>
  )

  if (!client) return <div style={{ padding: 32, color: 'var(--text-4)' }}>Cliente não encontrado</div>

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => router.push('/dashboard/clients')}>
            ← Clientes
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{client.name}</h1>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {client.cnpj && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>CNPJ: {client.cnpj}</span>}
              {client.email && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{client.email}</span>}
              <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-4)', border: '1px solid var(--border)' }}>
                {client.type}
              </span>
            </div>
          </div>
          <button className="btn-gold" onClick={() => setShowModal(true)}>+ Novo Processo</button>
        </div>
      </div>

      {/* Projects */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
        Processos ({client.projects?.length || 0})
      </h2>
      {!client.projects?.length ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◻</div>
          <p style={{ color: 'var(--text-4)', marginBottom: 20 }}>Nenhum processo cadastrado</p>
          <button className="btn-gold" onClick={() => setShowModal(true)}>+ Novo Processo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {client.projects.map(p => (
            <div key={p.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s', padding: '16px 20px' }}
              onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-border)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {p.numero_processo && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Proc: {p.numero_processo}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--gold-light)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
                    {FASE_LABELS[p.fase] || p.fase}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="card" style={{ width: 480, padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>Novo Processo</h2>
            <form onSubmit={handleCreateProject}>
              {[
                { key: 'name', label: 'Nome do Processo *', placeholder: 'Ex: Revisão Contratual TechInova', required: true },
                { key: 'numero_processo', label: 'Número do Processo', placeholder: '0000000-00.0000.0.00.0000', required: false },
                { key: 'vara', label: 'Vara', placeholder: '1ª Vara Cível', required: false },
                { key: 'comarca', label: 'Comarca', placeholder: 'São Paulo', required: false },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field.label}</label>
                  <input value={form[field.key as keyof typeof form]} onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))} placeholder={field.placeholder} required={field.required} />
                </div>
              ))}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}>
                  <option value="contencioso">Contencioso</option>
                  <option value="consultivo">Consultivo</option>
                  <option value="trabalhista">Trabalhista</option>
                  <option value="tributario">Tributário</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
