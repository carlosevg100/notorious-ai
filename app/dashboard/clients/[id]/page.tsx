'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Client, Project } from '@/lib/types'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Folder } from 'lucide-react'

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const { firmId } = useAuth()
  const router = useRouter()

  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', numero_processo: '', tipo: 'contencioso', vara: '', comarca: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [clientId, firmId])

  async function loadData() {
    const [clientRes, projRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('projects').select('*, documents(id, processing_status), prazos(data_prazo, status)').eq('client_id', clientId).eq('firm_id', firmId).order('created_at', { ascending: false }),
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  }

  if (!client) {
    return <p style={{ color: 'var(--text-muted)' }}>Cliente não encontrado.</p>
  }

  const faseLabel: Record<string, string> = {
    analise: 'Análise', contestacao: 'Contestação', recurso: 'Recurso',
    execucao: 'Execução', encerrado: 'Encerrado',
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/dashboard/clients')} className="flex items-center gap-1 text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {client.cnpj && <span>CNPJ: {client.cnpj}</span>}
            {client.email && <span>{client.email}</span>}
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black"
          style={{ background: 'var(--color-gold)' }}
        >
          <Plus size={16} /> Novo Processo
        </button>
      </div>

      {/* New Project Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md p-6 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Novo Processo</h2>
              <button onClick={() => setShowNew(false)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Nome do processo *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
              <input placeholder="Número do processo" value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="contencioso">Contencioso</option>
                <option value="consultivo">Consultivo</option>
                <option value="trabalhista">Trabalhista</option>
                <option value="tributario">Tributário</option>
              </select>
              <input placeholder="Vara" value={form.vara} onChange={e => setForm({ ...form, vara: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
              <input placeholder="Comarca" value={form.comarca} onChange={e => setForm({ ...form, comarca: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={saving} className="w-full py-2 rounded-lg font-semibold text-black text-sm disabled:opacity-50" style={{ background: 'var(--color-gold)' }}>
                {saving ? 'Criando...' : 'Criar Processo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Projects list */}
      {projects.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Folder size={48} className="mx-auto mb-3 opacity-40" />
          <p>Nenhum processo para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const proj = project as unknown as Record<string, unknown>
            const docCount = Array.isArray(proj.documents) ? (proj.documents as unknown[]).length : 0
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 rounded-xl transition-all hover:scale-[1.005]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <div className="flex gap-3 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {project.numero_processo && <span>{project.numero_processo}</span>}
                      <span>{faseLabel[project.fase] || project.fase}</span>
                      <span>{docCount} docs</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--color-gold)' }}>
                    {faseLabel[project.fase] || project.fase}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
