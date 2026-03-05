'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Prazo } from '@/lib/types'
import Link from 'next/link'

interface Stats {
  totalProcessos: number
  docsPendentes:  number
  prazosEstaSemana: number
  prazosVencidos: number
}

interface Pipeline {
  analise:     number
  contestacao: number
  recurso:     number
  execucao:    number
  encerrado:   number
}

const PIPELINE_STAGES: { key: keyof Pipeline; label: string; color: string }[] = [
  { key: 'analise',     label: 'Análise',     color: '#60A5FA' },
  { key: 'contestacao', label: 'Contestação', color: '#F59E0B' },
  { key: 'recurso',     label: 'Recurso',     color: '#F87171' },
  { key: 'execucao',    label: 'Execução',    color: '#34D399' },
  { key: 'encerrado',   label: 'Encerrado',   color: '#4B5563' },
]

function diasBadgeStyle(dias: number): React.CSSProperties {
  if (dias < 0)  return { background: 'rgba(239,68,68,0.15)',  color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)'  }
  if (dias < 3)  return { background: 'rgba(239,68,68,0.15)',  color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)'  }
  if (dias < 7)  return { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
  return            { background: 'rgba(34,197,94,0.12)',  color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)'  }
}

export default function DashboardPage() {
  const { firmId } = useAuth()
  interface AtividadeItem { id: string; tipo: 'documento' | 'peca'; descricao: string; created_at: string }

  const [stats,           setStats]           = useState<Stats>({ totalProcessos: 0, docsPendentes: 0, prazosEstaSemana: 0, prazosVencidos: 0 })
  const [pipeline,        setPipeline]        = useState<Pipeline>({ analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 })
  const [prazosProximos,  setPrazosProximos]  = useState<(Prazo & { project_name?: string })[]>([])
  const [atividades,      setAtividades]      = useState<AtividadeItem[]>([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const [projRes, docRes, prazoRes, atDocRes, atPecaRes] = await Promise.all([
        supabase.from('projects').select('id, fase, status').eq('firm_id', firmId),
        supabase.from('documents').select('id, processing_status').eq('firm_id', firmId),
        supabase.from('prazos').select('*, projects(name)').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
        supabase.from('documents').select('id, nome_arquivo, created_at').eq('firm_id', firmId).eq('processing_status', 'completed').order('created_at', { ascending: false }).limit(5),
        supabase.from('pecas').select('id, tipo_peca, created_at').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(3),
      ])

      const projects = projRes.data || []
      const docs     = docRes.data  || []
      const prazos   = prazoRes.data || []

      const activeProjects = projects.filter(p => p.status === 'ativo')
      const pendingDocs    = docs.filter(d => d.processing_status === 'pending' || d.processing_status === 'processing')

      const prazosWithDias = prazos.map(p => ({
        ...p,
        project_name: (p as Record<string, unknown>).projects
          ? ((p as Record<string, unknown>).projects as { name: string }).name
          : undefined,
        dias_uteis_restantes: diasUteisRestantes(p.data_prazo),
      }))

      const vencidos     = prazosWithDias.filter(p => p.dias_uteis_restantes < 0 && p.status === 'pendente')
      const estaSemana   = prazosWithDias.filter(p => p.dias_uteis_restantes >= 0 && p.dias_uteis_restantes <= 5 && p.status === 'pendente')

      setStats({
        totalProcessos:    activeProjects.length,
        docsPendentes:     pendingDocs.length,
        prazosEstaSemana:  estaSemana.length,
        prazosVencidos:    vencidos.length,
      })

      const pip: Pipeline = { analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 }
      activeProjects.forEach(p => {
        if (p.fase in pip) pip[p.fase as keyof Pipeline]++
      })
      setPipeline(pip)

      setPrazosProximos(prazosWithDias.filter(p => p.status === 'pendente').slice(0, 12))

      // Atividade recente
      const docAtividades: AtividadeItem[] = (atDocRes.data || []).map((d: Record<string, string>) => ({
        id: d.id, tipo: 'documento' as const,
        descricao: `Documento processado: ${d.nome_arquivo || 'arquivo'}`,
        created_at: d.created_at,
      }))
      const pecaAtividades: AtividadeItem[] = (atPecaRes.data || []).map((p: Record<string, string>) => ({
        id: p.id, tipo: 'peca' as const,
        descricao: `Peça gerada: ${p.tipo_peca || 'peça jurídica'}`,
        created_at: p.created_at,
      }))
      const all = [...docAtividades, ...pecaAtividades]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
      setAtividades(all)

      setLoading(false)
    }
    load()
  }, [firmId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
        <div className="spinner" />
      </div>
    )
  }

  const totalPipeline = Object.values(pipeline).reduce((a, b) => a + b, 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Page title */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Visão geral da operação
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>

        {/* Processos Ativos */}
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            Processos Ativos
          </p>
          <p className="font-mono" style={{ fontSize: '32px', fontWeight: 700, margin: '8px 0 0', color: 'var(--text-primary)', lineHeight: 1 }}>
            {stats.totalProcessos}
          </p>
        </div>

        {/* Docs Pendentes */}
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            Docs Pendentes
          </p>
          <p className="font-mono" style={{ fontSize: '32px', fontWeight: 700, margin: '8px 0 0', color: 'var(--text-primary)', lineHeight: 1 }}>
            {stats.docsPendentes}
          </p>
        </div>

        {/* Prazos Esta Semana */}
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            Prazos Esta Semana
          </p>
          <p className="font-mono" style={{ fontSize: '32px', fontWeight: 700, margin: '8px 0 0', color: 'var(--text-primary)', lineHeight: 1 }}>
            {stats.prazosEstaSemana}
          </p>
        </div>

        {/* Prazos Vencidos — alert card */}
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          background: stats.prazosVencidos > 0 ? 'rgba(239,68,68,0.05)' : 'var(--bg-card)',
          border: `1px solid var(--border)`,
          borderTop: stats.prazosVencidos > 0 ? '2px solid var(--error)' : '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            Prazos Vencidos
          </p>
          <p className="font-mono" style={{
            fontSize: '32px',
            fontWeight: 700,
            margin: '8px 0 0',
            color: stats.prazosVencidos > 0 ? 'var(--error)' : 'var(--text-primary)',
            lineHeight: 1,
          }}>
            {stats.prazosVencidos}
          </p>
        </div>
      </div>

      {/* ── Pipeline ──────────────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Pipeline de Processos
        </h2>

        {/* Bar */}
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '1px' }}>
          {PIPELINE_STAGES.map(stage => {
            const pct = (pipeline[stage.key] / totalPipeline) * 100
            if (pct === 0) return null
            return (
              <div
                key={stage.key}
                title={`${stage.label}: ${pipeline[stage.key]}`}
                style={{ width: `${pct}%`, background: stage.color, borderRadius: '2px' }}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', marginTop: '12px' }}>
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stage.label}</span>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{pipeline[stage.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Prazos Próximos ───────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Prazos Próximos
        </h2>

        {prazosProximos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum prazo pendente.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Descrição', 'Processo', 'Data', 'Dias Úteis'].map(h => (
                    <th key={h} className="font-mono" style={{
                      textAlign: 'left',
                      padding: '0 12px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prazosProximos.map(p => (
                  <tr
                    key={p.id}
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{p.descricao}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Link
                        href={`/dashboard/projects/${p.project_id}`}
                        style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}
                      >
                        {p.project_name || '—'}
                      </Link>
                    </td>
                    <td className="font-mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {formatDate(p.data_prazo)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="font-mono" style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        ...diasBadgeStyle(p.dias_uteis_restantes ?? 0),
                      }}>
                        {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Atividade Recente ─────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Atividade Recente
        </h2>
        {atividades.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma atividade recente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {atividades.map(a => (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: a.tipo === 'documento' ? 'var(--info)' : 'var(--accent)',
                  }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{a.descricao}</span>
                </div>
                <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '16px' }}>
                  {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
