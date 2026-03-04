'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardData {
  stats: {
    totalProcessos: number
    documentosPendentes: number
    prazosEstaSemana: number
    prazosVencidos: number
  }
  pipeline: {
    analise: number
    contestacao: number
    recurso: number
    execucao: number
    encerrado: number
  }
  proximosPrazos: Array<{
    id: string
    descricao: string
    data_prazo: string
    project_id: string
    projects?: { name: string }
  }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData)
  }, [])

  const stats = data?.stats

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 4 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  )

  const FASES = [
    { key: 'analise', label: 'Análise' },
    { key: 'contestacao', label: 'Contestação' },
    { key: 'recurso', label: 'Recurso' },
    { key: 'execucao', label: 'Execução' },
    { key: 'encerrado', label: 'Encerrado' },
  ]

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-4)', fontSize: 13 }}>Visão geral das operações</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <StatCard label="Processos Ativos" value={stats?.totalProcessos ?? 0} color="var(--text)" />
        <StatCard label="Docs Pendentes" value={stats?.documentosPendentes ?? 0} color="var(--warning)" />
        <StatCard label="Prazos Esta Semana" value={stats?.prazosEstaSemana ?? 0} color="var(--gold)" />
        <StatCard label="Prazos Vencidos" value={stats?.prazosVencidos ?? 0} color="var(--error)" />
      </div>

      {/* Pipeline */}
      <div className="card" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Pipeline de Processos</h2>
        <div style={{ display: 'flex', gap: 0 }}>
          {FASES.map((fase, i) => {
            const count = data?.pipeline[fase.key as keyof typeof data.pipeline] ?? 0
            const isLast = i === FASES.length - 1
            return (
              <div key={fase.key} style={{
                flex: 1, padding: '16px 20px', background: 'var(--bg-3)',
                borderRight: isLast ? 'none' : '1px solid var(--border)',
                borderRadius: i === 0 ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: count > 0 ? 'var(--gold)' : 'var(--text-4)', marginBottom: 4 }}>
                  {count}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {fase.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Próximos prazos */}
      <div className="card">
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>
          Prazos Próximos (10 dias)
        </h2>
        {!data?.proximosPrazos?.length ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-4)' }}>
            Nenhum prazo próximo
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Descrição', 'Processo', 'Data'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.proximosPrazos.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => router.push(`/dashboard/projects/${p.project_id}`)}>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.descricao}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-3)' }}>
                    {p.projects?.name || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--gold)' }}>
                    {new Date(p.data_prazo).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
