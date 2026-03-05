'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate, prazoBadgeColor } from '@/lib/utils'
import type { Project, Prazo } from '@/lib/types'
import Link from 'next/link'
import { FileText, Clock, AlertTriangle, Briefcase } from 'lucide-react'

interface Stats {
  totalProcessos: number
  docsPendentes: number
  prazosEstaSemana: number
  prazosVencidos: number
}

interface Pipeline {
  analise: number
  contestacao: number
  recurso: number
  execucao: number
  encerrado: number
}

export default function DashboardPage() {
  const { firmId } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalProcessos: 0, docsPendentes: 0, prazosEstaSemana: 0, prazosVencidos: 0 })
  const [pipeline, setPipeline] = useState<Pipeline>({ analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 })
  const [prazosProximos, setPrazosProximos] = useState<(Prazo & { project_name?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [projRes, docRes, prazoRes] = await Promise.all([
        supabase.from('projects').select('id, fase, status').eq('firm_id', firmId),
        supabase.from('documents').select('id, processing_status').eq('firm_id', firmId),
        supabase.from('prazos').select('*, projects(name)').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
      ])

      const projects = projRes.data || []
      const docs = docRes.data || []
      const prazos = prazoRes.data || []

      const activeProjects = projects.filter(p => p.status === 'ativo')
      const pendingDocs = docs.filter(d => d.processing_status === 'pending' || d.processing_status === 'processing')

      const now = new Date()
      const prazosWithDias = prazos.map(p => ({
        ...p,
        project_name: (p as Record<string, unknown>).projects ? ((p as Record<string, unknown>).projects as { name: string }).name : undefined,
        dias_uteis_restantes: diasUteisRestantes(p.data_prazo),
      }))

      const prazosVencidos = prazosWithDias.filter(p => p.dias_uteis_restantes < 0 && p.status === 'pendente')
      const prazosEstaSemana = prazosWithDias.filter(p => p.dias_uteis_restantes >= 0 && p.dias_uteis_restantes <= 5 && p.status === 'pendente')

      setStats({
        totalProcessos: activeProjects.length,
        docsPendentes: pendingDocs.length,
        prazosEstaSemana: prazosEstaSemana.length,
        prazosVencidos: prazosVencidos.length,
      })

      const pip: Pipeline = { analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 }
      activeProjects.forEach(p => {
        if (p.fase in pip) pip[p.fase as keyof Pipeline]++
      })
      setPipeline(pip)

      setPrazosProximos(prazosWithDias.filter(p => p.status === 'pendente').slice(0, 10))
      setLoading(false)
    }
    load()
  }, [firmId])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
  }

  const statCards = [
    { label: 'Processos Ativos', value: stats.totalProcessos, icon: Briefcase, color: 'text-blue-400' },
    { label: 'Docs Pendentes', value: stats.docsPendentes, icon: FileText, color: 'text-amber-400' },
    { label: 'Prazos Esta Semana', value: stats.prazosEstaSemana, icon: Clock, color: 'text-emerald-400' },
    { label: 'Prazos Vencidos', value: stats.prazosVencidos, icon: AlertTriangle, color: 'text-red-400' },
  ]

  const pipelineStages = [
    { key: 'analise', label: 'Análise' },
    { key: 'contestacao', label: 'Contestação' },
    { key: 'recurso', label: 'Recurso' },
    { key: 'execucao', label: 'Execução' },
    { key: 'encerrado', label: 'Encerrado' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <card.icon size={28} className={card.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-lg font-semibold mb-4">Pipeline de Processos</h2>
        <div className="flex gap-2">
          {pipelineStages.map(stage => (
            <div key={stage.key} className="flex-1 text-center p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>
                {pipeline[stage.key as keyof Pipeline]}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stage.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prazos próximos */}
      <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-lg font-semibold mb-4">Prazos Próximos</h2>
        {prazosProximos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum prazo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-left py-2 px-3">Processo</th>
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Dias Úteis</th>
                </tr>
              </thead>
              <tbody>
                {prazosProximos.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="py-2.5 px-3">{p.descricao}</td>
                    <td className="py-2.5 px-3">
                      <Link href={`/dashboard/projects/${p.project_id}`} className="hover:underline" style={{ color: 'var(--color-gold)' }}>
                        {p.project_name || '—'}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">{formatDate(p.data_prazo)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${prazoBadgeColor(p.dias_uteis_restantes ?? 0)}`}>
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
    </div>
  )
}
