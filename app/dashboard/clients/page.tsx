'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string
  cnpj?: string
  email?: string
  type: string
  created_at: string
  projects?: Array<{ id: string; status: string }>
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', type: 'empresa' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setSaving(false); return }
    setClients(prev => [data, ...prev])
    setShowModal(false)
    setForm({ name: '', cnpj: '', email: '', type: 'empresa' })
    setSaving(false)
  }

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-4)' }}>Carregando clientes...</span>
    </div>
  )

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Clientes</h1>
          <p style={{ color: 'var(--text-4)', fontSize: 13 }}>{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-gold" onClick={() => setShowModal(true)}>+ Novo Cliente</button>
      </div>

      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>◈</div>
          <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>Nenhum cliente cadastrado</h3>
          <p style={{ color: 'var(--text-4)', marginBottom: 24 }}>Adicione seu primeiro cliente para começar</p>
          <button className="btn-gold" onClick={() => setShowModal(true)}>+ Novo Cliente</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {clients.map(c => {
            const activeProjects = c.projects?.filter(p => p.status === 'ativo').length || 0
            return (
              <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--gold-light)', border: '1px solid var(--gold-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'var(--gold)', fontWeight: 700
                  }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-4)', border: '1px solid var(--border)' }}>
                    {c.type}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.name}</h3>
                {c.cnpj && <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>CNPJ: {c.cnpj}</p>}
                {c.email && <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>{c.email}</p>}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                    {activeProjects} processo{activeProjects !== 1 ? 's' : ''} ativo{activeProjects !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100
        }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="card" style={{ width: 440, padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>Novo Cliente</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="TechInova Ltda" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CNPJ</label>
                <input value={form.cnpj} onChange={e => setForm(f => ({...f, cnpj: e.target.value}))} placeholder="00.000.000/0001-00" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="contato@empresa.com.br" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  <option value="empresa">Empresa</option>
                  <option value="pessoa_fisica">Pessoa Física</option>
                  <option value="orgao_publico">Órgão Público</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
