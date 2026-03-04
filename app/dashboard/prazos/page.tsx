'use client'
import { useEffect, useState } from 'react'
import { diasUteisRestantes } from '@/lib/utils'

interface Prazo {
  id: string
  descricao: string
  data_prazo: string
  tipo: string
  status: string
  dias_uteis_restantes?: number
  project_id: string
  projects?: { name: string }
}

function PrazoBadge({ du }: { du: number }) {
  if (du < 0) return <span className="badge" style={{ background: '#ef444420', color: 'var(--error)', border: '1px solid #ef444440' }}>VENCIDO</span>
  if (du <= 3) return <span className="badge" style={{ background: '#ef444420', color: 'var(--error)', border: '1px solid #ef444440' }}>{du} d.u.</span>
  if (du <= 7) return <span className="badge" style={{ background: '#f59e0b20', color: 'var(--warning)', border: '1px solid #f59e0b40' }}>{du} d.u.</span>
  return <span className="badge" style={{ background: '#22c55e20', color: 'var(--success)', border: '1px solid #22c55e40' }}>{du} d.u.</span>
}

export default function PrazosPage() {
  const [prazos, setPrazos] = useState<Prazo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/prazos').then(r => r.json()).then(data => {
      setPrazos(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-4)' }}>Carregando prazos...</span>
    </div>
  )

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Prazos</h1>
        <p style={{ color: 'var(--text-4)', fontSize: 13 }}>Todos os prazos — em dias úteis (CPC art. 219)</p>
      </div>

      <div className="card">
        {!prazos.length ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◷</div>
            <p>Nenhum prazo cadastrado. Os prazos são extraídos automaticamente dos documentos processados.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Descrição', 'Processo', 'Data', 'Tipo', 'Dias Úteis', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prazos.map(p => {
                const du = diasUteisRestantes(p.data_prazo)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.descricao}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-3)' }}>
                      {p.projects?.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      {new Date(p.data_prazo).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-4)' }}>
                      {p.tipo}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <PrazoBadge du={du} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge" style={{
                        background: p.status === 'cumprido' ? '#22c55e20' : 'var(--bg-3)',
                        color: p.status === 'cumprido' ? 'var(--success)' : 'var(--text-4)',
                        border: `1px solid ${p.status === 'cumprido' ? '#22c55e40' : 'var(--border)'}`
                      }}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
