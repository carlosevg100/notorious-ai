'use client'
import { useEffect, useState } from 'react'

interface Peca {
  id: string
  tipo: string
  conteudo: string
  modelo_ia: string
  versao: number
  created_at: string
  project_id: string
}

export default function PecasPage() {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Peca | null>(null)

  useEffect(() => {
    fetch('/api/pecas').then(r => r.json()).then(data => {
      setPecas(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-4)' }}>Carregando peças...</span>
    </div>
  )

  const TIPO_LABELS: Record<string, string> = {
    contestacao: 'Contestação', recurso: 'Recurso', peticao: 'Petição'
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Peças</h1>
        <p style={{ color: 'var(--text-4)', fontSize: 13 }}>Documentos gerados por IA</p>
      </div>

      {!pecas.length ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>◻</div>
          <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>Nenhuma peça gerada</h3>
          <p style={{ color: 'var(--text-4)' }}>
            Acesse um processo e use a aba Peças para gerar contestações, recursos e petições.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pecas.map(p => (
                <button key={p.id} onClick={() => setSelected(p)} className="btn"
                  style={{
                    justifyContent: 'space-between', padding: '12px 14px',
                    background: selected?.id === p.id ? 'var(--gold-light)' : 'var(--bg-3)',
                    borderColor: selected?.id === p.id ? 'var(--gold-border)' : 'var(--border)',
                    color: selected?.id === p.id ? 'var(--gold)' : 'var(--text-3)',
                    width: '100%'
                  }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {new Date(p.created_at).toLocaleDateString('pt-BR')} — v{p.versao}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            {selected ? (
              <div className="card" style={{ height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                    {TIPO_LABELS[selected.tipo] || selected.tipo}
                  </h3>
                  <button className="btn" style={{ padding: '6px 14px', fontSize: 12 }}
                    onClick={() => navigator.clipboard.writeText(selected.conteudo)}>
                    Copiar texto
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
                  {selected.conteudo}
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <p style={{ color: 'var(--text-4)' }}>Selecione uma peça para visualizar</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
