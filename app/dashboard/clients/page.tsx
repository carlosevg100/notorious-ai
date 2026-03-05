'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/types'
import Link from 'next/link'
import { Plus, Building2, X } from 'lucide-react'

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

export default function ClientsPage() {
  const { firmId } = useAuth()
  const [clients, setClients] = useState<(Client & { _project_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]       = useState({ name: '', cnpj: '', email: '', type: 'empresa' })
  const [saving, setSaving]   = useState(false)

  useEffect(() => { loadClients() }, [firmId])

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*, projects(id)')
      .eq('firm_id', firmId)
      .order('name')

    setClients((data || []).map((c: Record<string, unknown>) => ({
      ...c as unknown as Client,
      _project_count: Array.isArray(c.projects) ? c.projects.length : 0,
    })))
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Clientes</h1>
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
                <input
                  placeholder="Empresa Ltda."
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  CNPJ
                </label>
                <input
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={e => setForm({ ...form, cnpj: e.target.value })}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Email de contato
                </label>
                <input
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Tipo
                </label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="empresa">Empresa / PJ</option>
                  <option value="pessoa_fisica">Pessoa Física</option>
                  <option value="orgao_publico">Órgão Público</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  style={{
                    flex: 1, height: '40px', borderRadius: '6px',
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1, height: '40px', borderRadius: '6px',
                    background: 'var(--accent)', color: '#000000',
                    fontWeight: 600, fontSize: '14px', border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Client Grid ───────────────────────────────────── */}
      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '14px' }}>Nenhum cliente cadastrado.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Clique em &quot;Novo Cliente&quot; para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {clients.map(client => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              style={{
                display: 'block',
                padding: '20px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'border-color 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                {client.name}
              </h3>
              {client.cnpj && (
                <p className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {client.cnpj}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
