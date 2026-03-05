'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/types'
import Link from 'next/link'
import { Plus, Building2, X } from 'lucide-react'

export default function ClientsPage() {
  const { firmId } = useAuth()
  const [clients, setClients] = useState<(Client & { _project_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', type: 'empresa' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClients()
  }, [firmId])

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
    return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black"
          style={{ background: 'var(--color-gold)' }}
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* New Client Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md p-6 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Novo Cliente</h2>
              <button onClick={() => setShowNew(false)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                placeholder="Nome do cliente *"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                placeholder="CNPJ"
                value={form.cnpj}
                onChange={e => setForm({ ...form, cnpj: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="empresa">Empresa</option>
                <option value="pessoa_fisica">Pessoa Física</option>
                <option value="orgao_publico">Órgão Público</option>
              </select>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 rounded-lg font-semibold text-black text-sm disabled:opacity-50"
                style={{ background: 'var(--color-gold)' }}
              >
                {saving ? 'Salvando...' : 'Criar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Client Grid */}
      {clients.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Building2 size={48} className="mx-auto mb-3 opacity-40" />
          <p>Nenhum cliente cadastrado.</p>
          <p className="text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="block p-5 rounded-xl transition-all hover:scale-[1.01]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <h3 className="font-semibold text-lg">{client.name}</h3>
              {client.cnpj && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{client.cnpj}</p>}
              <div className="mt-3 flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>{client._project_count || 0} processos</span>
                <span className="capitalize">{client.type.replace('_', ' ')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
