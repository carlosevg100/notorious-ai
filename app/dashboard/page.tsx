'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Prazo, Client } from '@/lib/types'
import Link from 'next/link'
import { Search, AlertTriangle, TrendingUp, FileText, CalendarClock, Users, ArrowRight } from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */
interface Stats {
  totalProcessos: number
  docsPendentes:  number
  prazosEstaSemana: number
  prazosVencidos: number
  totalClientes: number
}

interface Pipeline {
  analise:     number
  contestacao: number
  recurso:     number
  execucao:    number
  encerrado:   number
}

interface AtividadeItem {
  id: string
  tipo: 'documento' | 'peca'
  descricao: string
  created_at: string
  project_id?: string
}

interface ClientWithMeta extends Client {
  _project_count: number
  _risk_level: 'alto' | 'medio' | 'baixo' | null
  _next_prazo: string | null
}

/* ─── Constants ──────────────────────────────────────────────── */
const PIPELINE_STAGES: { key: keyof Pipeline; label: string; color: string }[] = [
  { key: 'analise',     label: 'Análise',     color: '#3B82F6' },
  { key: 'contestacao', label: 'Contestação', color: '#F59E0B' },
  { key: 'recurso',     label: 'Recurso',     color: '#EF4444' },
  { key: 'execucao',    label: 'Execução',    color: '#22C55E' },
  { key: 'encerrado',   label: 'Encerrado',   color: '#71717A' },
]

const KPI_CONFIGS: { key: string; label: string; icon: React.ElementType; color: string; alert?: boolean }[] = [
  { key: 'totalProcessos', label: 'Processos Ativos', icon: TrendingUp, color: 'var(--accent)' },
  { key: 'docsPendentes',  label: 'Docs Pendentes',   icon: FileText,   color: 'var(--info)' },
  { key: 'prazosEstaSemana', label: 'Prazos Esta Semana', icon: CalendarClock, color: 'var(--warning)' },
  { key: 'prazosVencidos',   label: 'Prazos Vencidos',    icon: AlertTriangle, color: 'var(--error)', alert: true },
]

function diasBadgeStyle(dias: number): React.CSSProperties {
  if (dias < 0)  return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
  if (dias < 3)  return { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
  if (dias < 7)  return { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
  return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
}

function riskBadgeStyle(risk: string | null): React.CSSProperties {
  if (risk === 'alto') return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }
  if (risk === 'medio') return { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }
  if (risk === 'baixo') return { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
  return { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

/* ─── Component ──────────────────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDateBR(): string {
  const d = new Date()
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

export default function DashboardPage() {
  const { firmId, userName } = useAuth()

  const [stats,          setStats]          = useState<Stats>({ totalProcessos: 0, docsPendentes: 0, prazosEstaSemana: 0, prazosVencidos: 0, totalClientes: 0 })
  const [pipeline,       setPipeline]       = useState<Pipeline>({ analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 })
  const [prazosProximos, setPrazosProximos] = useState<(Prazo & { project_name?: string })[]>([])
  const [atividades,     setAtividades]     = useState<AtividadeItem[]>([])
  const [clients,        setClients]        = useState<ClientWithMeta[]>([])
  const [clientSearch,   setClientSearch]   = useState('')
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      const [projRes, docRes, prazoRes, atDocRes, atPecaRes, clientRes] = await Promise.all([
        supabase.from('projects').select('id, fase, status, client_id').eq('firm_id', firmId),
        supabase.from('documents').select('id, processing_status, extracted_data, project_id').eq('firm_id', firmId),
        supabase.from('prazos').select('*, projects(name)').eq('firm_id', firmId).order('data_prazo', { ascending: true }),
        supabase.from('documents').select('id, name, created_at, project_id').eq('firm_id', firmId).eq('processing_status', 'completed').order('created_at', { ascending: false }).limit(5),
        supabase.from('pecas').select('id, tipo, created_at, project_id').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(3),
        supabase.from('clients').select('*, projects(id, fase, status)').eq('firm_id', firmId).order('name'),
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

      const vencidos   = prazosWithDias.filter(p => p.dias_uteis_restantes < 0 && p.status === 'pendente')
      const estaSemana = prazosWithDias.filter(p => p.dias_uteis_restantes >= 0 && p.dias_uteis_restantes <= 5 && p.status === 'pendente')

      setStats({
        totalProcessos:   activeProjects.length,
        docsPendentes:    pendingDocs.length,
        prazosEstaSemana: estaSemana.length,
        prazosVencidos:   vencidos.length,
        totalClientes:    (clientRes.data || []).length,
      })

      const pip: Pipeline = { analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 }
      activeProjects.forEach(p => {
        if (p.fase in pip) pip[p.fase as keyof Pipeline]++
      })
      setPipeline(pip)
      setPrazosProximos(prazosWithDias.filter(p => p.status === 'pendente').slice(0, 12))

      // Build client meta: risk + project count + next prazo
      const clientRiskMap = new Map<string, string>()
      docs.forEach(d => {
        const ed = d.extracted_data as { risco_estimado?: string } | null
        if (ed?.risco_estimado) {
          const proj = projects.find(p => p.id === d.project_id)
          if (proj?.client_id) {
            const current = clientRiskMap.get(proj.client_id)
            if (!current || riskPriority(ed.risco_estimado) > riskPriority(current)) {
              clientRiskMap.set(proj.client_id, ed.risco_estimado)
            }
          }
        }
      })

      const clientPrazoMap = new Map<string, string>()
      prazosWithDias
        .filter(p => p.status === 'pendente' && p.dias_uteis_restantes >= 0)
        .forEach(p => {
          const proj = projects.find(pr => pr.id === p.project_id)
          if (proj?.client_id) {
            const current = clientPrazoMap.get(proj.client_id)
            if (!current || new Date(p.data_prazo) < new Date(current)) {
              clientPrazoMap.set(proj.client_id, p.data_prazo)
            }
          }
        })

      const clientsWithMeta: ClientWithMeta[] = (clientRes.data || []).map((c: Record<string, unknown>) => ({
        ...c as unknown as Client,
        _project_count: Array.isArray(c.projects) ? (c.projects as unknown[]).length : 0,
        _risk_level: (clientRiskMap.get(c.id as string) as ClientWithMeta['_risk_level']) || null,
        _next_prazo: clientPrazoMap.get(c.id as string) || null,
      }))
      setClients(clientsWithMeta)

      // Atividade recente
      const docAtividades: AtividadeItem[] = (atDocRes.data || []).map((d: Record<string, string>) => ({
        id: d.id, tipo: 'documento' as const,
        descricao: `Documento processado: ${d.name || 'arquivo'}`,
        created_at: d.created_at,
        project_id: d.project_id,
      }))
      const pecaAtividades: AtividadeItem[] = (atPecaRes.data || []).map((p: Record<string, string>) => ({
        id: p.id, tipo: 'peca' as const,
        descricao: `Peça gerada: ${p.tipo || 'peça jurídica'}`,
        created_at: p.created_at,
        project_id: p.project_id,
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

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(clientSearch))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Greeting + Executive Summary */}
      <div style={{
        padding: '20px 24px',
        borderRadius: '10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {getGreeting()}, {userName || 'Doutor(a)'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {formatDateBR()}
        </p>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {stats.prazosVencidos > 0 && (
            <div style={{ fontSize: '13px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} />
              <span><strong>{stats.prazosVencidos} prazo{stats.prazosVencidos > 1 ? 's' : ''} vencido{stats.prazosVencidos > 1 ? 's' : ''}</strong> — atenção imediata necessária</span>
            </div>
          )}
          {stats.prazosEstaSemana > 0 && (
            <div style={{ fontSize: '13px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock size={14} />
              <span><strong>{stats.prazosEstaSemana} prazo{stats.prazosEstaSemana > 1 ? 's' : ''}</strong> vence{stats.prazosEstaSemana > 1 ? 'm' : ''} esta semana</span>
            </div>
          )}
          {stats.docsPendentes > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={14} />
              <span><strong>{stats.docsPendentes} documento{stats.docsPendentes > 1 ? 's' : ''}</strong> aguardando processamento</span>
            </div>
          )}
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} />
            <span><strong>{stats.totalProcessos} processo{stats.totalProcessos !== 1 ? 's' : ''} ativo{stats.totalProcessos !== 1 ? 's' : ''}</strong> em {stats.totalClientes} cliente{stats.totalClientes !== 1 ? 's' : ''}</span>
          </div>
          {stats.prazosVencidos === 0 && stats.prazosEstaSemana === 0 && stats.docsPendentes === 0 && (
            <div style={{ fontSize: '13px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✓ Tudo em dia — nenhuma pendência urgente</span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {KPI_CONFIGS.map(kpi => {
          const value = stats[kpi.key as keyof Stats]
          const isAlert = kpi.alert && value > 0
          const Icon = kpi.icon
          return (
            <div key={kpi.key} style={{
              padding: '20px',
              borderRadius: '8px',
              background: isAlert ? 'rgba(239,68,68,0.05)' : 'var(--bg-card)',
              border: `1px solid var(--border)`,
              borderTop: isAlert ? '2px solid var(--error)' : '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
                  {kpi.label}
                </p>
                <Icon size={16} strokeWidth={1.5} style={{ color: kpi.color, opacity: 0.7 }} />
              </div>
              <p className="font-mono" style={{
                fontSize: '32px',
                fontWeight: 700,
                margin: 0,
                color: isAlert ? 'var(--error)' : 'var(--text-primary)',
                lineHeight: 1,
              }}>
                {value}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Pipeline ──────────────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Pipeline de Processos
        </h2>

        {/* Bar */}
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '2px', background: 'var(--bg-input)' }}>
          {PIPELINE_STAGES.map(stage => {
            const pct = (pipeline[stage.key] / totalPipeline) * 100
            if (pct === 0) return null
            return (
              <div
                key={stage.key}
                title={`${stage.label}: ${pipeline[stage.key]}`}
                style={{
                  width: `${pct}%`,
                  background: stage.color,
                  borderRadius: '3px',
                  transition: 'width 300ms ease',
                  minWidth: pipeline[stage.key] > 0 ? '20px' : 0,
                }}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginTop: '14px' }}>
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stage.label}</span>
              <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{pipeline[stage.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column layout: Prazos + Atividade ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Prazos Próximos */}
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Prazos Próximos
            </h2>
            <Link href="/dashboard/prazos" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          {prazosProximos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum prazo pendente.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {prazosProximos.slice(0, 8).map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.descricao}
                    </p>
                    <Link
                      href={`/dashboard/projects/${p.project_id}`}
                      style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {p.project_name || '—'}
                    </Link>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(p.data_prazo)}
                    </span>
                    <span className="font-mono" style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      ...diasBadgeStyle(p.dias_uteis_restantes ?? 0),
                    }}>
                      {(p.dias_uteis_restantes ?? 0) < 0 ? 'VENCIDO' : `${p.dias_uteis_restantes} d.u.`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atividade Recente */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                      background: a.tipo === 'documento' ? 'var(--info)' : 'var(--accent)',
                    }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.descricao}
                    </span>
                  </div>
                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '12px' }}>
                    {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Client Grid ──────────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Clientes ({stats.totalClientes})
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                style={{
                  height: '32px',
                  paddingLeft: '30px',
                  paddingRight: '12px',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  width: '220px',
                }}
              />
            </div>
            <Link href="/dashboard/clients" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ fontSize: '13px' }}>{clientSearch ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {filteredClients.slice(0, 9).map(client => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                style={{
                  display: 'block',
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.name}
                    </h3>
                    {client.cnpj && (
                      <p className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {client.cnpj}
                      </p>
                    )}
                  </div>
                  {client._risk_level && (
                    <span className="font-mono" style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
                      ...riskBadgeStyle(client._risk_level),
                    }}>
                      {client._risk_level}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <span className="font-mono" style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}>
                    {client._project_count} proc.
                  </span>
                  {client._next_prazo && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Próx: {formatDate(client._next_prazo)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────────────── */
function riskPriority(risk: string): number {
  if (risk === 'alto') return 3
  if (risk === 'medio') return 2
  if (risk === 'baixo') return 1
  return 0
}
