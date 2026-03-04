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
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setClient(data)
      setLoading(false)
    })
  }, [id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', files[0])
      fd.append('client_id', id)
      const res = await fetch('/api/intake', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.processo_id) router.push(`/dashboard/processos/${data.processo_id}`)
    } finally {
      setUploading(false)
    }
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
          <label className="btn-gold" style={{ cursor: 'pointer' }}>
            {uploading ? 'Enviando...' : '+ Upload Documento'}
            <input type="file" accept=".pdf,.docx,.txt" hidden onChange={handleUpload} disabled={uploading} />
          </label>
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
          <label className="btn-gold" style={{ cursor: 'pointer' }}>
            {uploading ? 'Enviando...' : '+ Upload Documento'}
            <input type="file" accept=".pdf,.docx,.txt" hidden onChange={handleUpload} disabled={uploading} />
          </label>
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
    </div>
  )
}
