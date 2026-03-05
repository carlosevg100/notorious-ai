'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Prazo, Client } from '@/lib/types'
import Link from 'next/link'
import {
  Search, AlertTriangle, TrendingUp, FileText, CalendarClock, Users, ArrowRight,
  Zap, BarChart2, Sparkles, DollarSign, Shield,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */
interface Stats {
  totalProcessos: number
  docsPendentes:  number
  prazosEstaSemana: number
  prazosVencidos: number
  totalClientes: number
  docsCompletados: number
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

const AVATAR_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

/* ─── Helper Functions ───────────────────────────────────────── */
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

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h atrás`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `${diffD} dias atrás`
  return formatDate(dateStr)
}

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

function kpiColor(key: string, value: number): string {
  if (key === 'prazosVencidos') return value > 0 ? '#EF4444' : '#22C55E'
  if (key === 'prazosEstaSemana') return value > 0 ? '#F59E0B' : '#22C55E'
  if (key === 'docsPendentes') return value > 0 ? '#F59E0B' : '#22C55E'
  return 'var(--accent)'
}

function prazoUrgencyBadge(p: { data_prazo: string; dias_uteis_restantes?: number | null }): { label: string; style: React.CSSProperties } {
  const dias = p.dias_uteis_restantes ?? 0
  if (dias < 0) return {
    label: 'VENCIDO',
    style: { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' },
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const prazoDate = new Date(p.data_prazo + 'T00:00:00')
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (prazoDate.getTime() === today.getTime()) return {
    label: 'HOJE',
    style: { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' },
  }
  if (prazoDate.getTime() === tomorrow.getTime()) return {
    label: 'AMANHÃ',
    style: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' },
  }
  return {
    label: formatDate(p.data_prazo),
    style: { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  }
}

const KPI_CONFIGS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'totalProcessos',   label: 'Processos Ativos',   icon: TrendingUp },
  { key: 'docsPendentes',    label: 'Docs Pendentes',     icon: FileText },
  { key: 'prazosEstaSemana', label: 'Prazos Esta Semana', icon: CalendarClock },
  { key: 'prazosVencidos',   label: 'Prazos Vencidos',    icon: AlertTriangle },
]

/* ─── Component ──────────────────────────────────────────────── */
export default function DashboardPage() {
  const { firmId, userName } = useAuth()

  const [stats,          setStats]          = useState<Stats>({ totalProcessos: 0, docsPendentes: 0, prazosEstaSemana: 0, prazosVencidos: 0, totalClientes: 0, docsCompletados: 0 })
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
      const completedDocs  = docs.filter(d => d.processing_status === 'completed')

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
        docsCompletados:  completedDocs.length,
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
  const pecasGeradas = atividades.filter(a => a.tipo === 'peca').length
  const clientsAltoRisco = clients.filter(c => c._risk_level === 'alto')
  const clientsMedioRisco = clients.filter(c => c._risk_level === 'medio')

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(clientSearch))
  )

  /* ─── Card style shorthand ─────────────────────────────────── */
  const card: React.CSSProperties = {
    padding: '20px',
    borderRadius: '10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 14px',
    color: 'var(--text-muted)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ═══ 1. GREETING ═══════════════════════════════════════ */}
      <div style={{ padding: '4px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {getGreeting()}, {userName ? (userName.toLowerCase().startsWith('dr') ? userName.split(' ').slice(0,2).join(' ') : `Dr. ${userName.split(' ')[0]}`) : 'Doutor(a)'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          {formatDateBR()}
        </p>
      </div>

      {/* ═══ 2. AI BRIEFING CARD ══════════════════════════════= */}
      <div style={{
        ...card,
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(59,130,246,0.03) 100%)',
        borderTop: '2px solid var(--accent)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: '14px', marginBottom: '16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
              Briefing Executivo
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
              background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
            }}>
              AI
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Gerado hoje às {formatCurrentTime()}
          </span>
        </div>

        {/* 3 Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>

          {/* AÇÃO IMEDIATA */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Zap size={13} style={{ color: '#EF4444' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#EF4444' }}>
                Ação Imediata
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.prazosVencidos > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>{stats.prazosVencidos}</strong> prazo{stats.prazosVencidos > 1 ? 's' : ''} vencido{stats.prazosVencidos > 1 ? 's' : ''} — ação urgente
                  </span>
                </div>
              )}
              {stats.docsPendentes > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>{stats.docsPendentes}</strong> doc{stats.docsPendentes > 1 ? 's' : ''} aguardando processamento
                  </span>
                </div>
              )}
              {stats.prazosEstaSemana > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>{stats.prazosEstaSemana}</strong> prazo{stats.prazosEstaSemana > 1 ? 's' : ''} vence{stats.prazosEstaSemana > 1 ? 'm' : ''} esta semana
                  </span>
                </div>
              )}
              {stats.prazosVencidos === 0 && stats.docsPendentes === 0 && stats.prazosEstaSemana === 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#22C55E' }}>Nenhuma pendência urgente</span>
                </div>
              )}
            </div>
          </div>

          {/* SITUAÇÃO DA CARTEIRA */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <BarChart2 size={13} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                Situação da Carteira
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', marginTop: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  <strong>{stats.totalProcessos}</strong> processo{stats.totalProcessos !== 1 ? 's' : ''} ativo{stats.totalProcessos !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3B82F6', marginTop: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  <strong>{pipeline.analise}</strong> em fase de análise
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted)', marginTop: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  <strong>{stats.totalClientes}</strong> cliente{stats.totalClientes !== 1 ? 's' : ''} na carteira
                </span>
              </div>
            </div>
          </div>

          {/* RESULTADOS E OPORTUNIDADES */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <TrendingUp size={13} style={{ color: '#22C55E' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#22C55E' }}>
                Resultados
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pecasGeradas > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>{pecasGeradas}</strong> peça{pecasGeradas > 1 ? 's' : ''} gerada{pecasGeradas > 1 ? 's' : ''} recentemente
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', marginTop: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  <strong>{stats.docsCompletados}</strong> documento{stats.docsCompletados !== 1 ? 's' : ''} processado{stats.docsCompletados !== 1 ? 's' : ''}
                </span>
              </div>
              {stats.prazosVencidos === 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#22C55E' }}>Carteira sem prazos vencidos</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3. KPI ROW ═══════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {KPI_CONFIGS.map(kpi => {
          const value = stats[kpi.key as keyof Stats] as number
          const color = kpiColor(kpi.key, value)
          const isAlert = kpi.key === 'prazosVencidos' && value > 0
          const Icon = kpi.icon
          return (
            <div key={kpi.key} style={{
              ...card,
              padding: '18px 20px',
              borderTop: isAlert ? `2px solid ${color}` : `1px solid var(--border)`,
              background: isAlert ? 'rgba(239,68,68,0.04)' : 'var(--bg-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
                  {kpi.label}
                </p>
                <Icon size={16} strokeWidth={1.5} style={{ color, opacity: 0.7 }} />
              </div>
              <p className="font-mono" style={{
                fontSize: '32px',
                fontWeight: 700,
                margin: 0,
                color,
                lineHeight: 1,
              }}>
                {value}
              </p>
            </div>
          )
        })}
      </div>

      {/* ═══ 4. MIDDLE ROW — Pipeline | Risco | Atividade ════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>

        {/* ── PIPELINE GLOBAL ───────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>
            Pipeline Global
          </h2>
          {/* Stacked bar */}
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
                    minWidth: pipeline[stage.key] > 0 ? '16px' : 0,
                  }}
                />
              )
            })}
          </div>
          {/* Legend with mini bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{stage.label}</span>
                <div style={{ width: '48px', height: '4px', borderRadius: '2px', background: 'var(--bg-input)', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{
                    width: `${Math.max((pipeline[stage.key] / totalPipeline) * 100, pipeline[stage.key] > 0 ? 10 : 0)}%`,
                    height: '100%',
                    background: stage.color,
                    borderRadius: '2px',
                  }} />
                </div>
                <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', width: '20px', textAlign: 'right' }}>
                  {pipeline[stage.key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RISCO FINANCEIRO ───────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>
            Risco Financeiro
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <DollarSign size={20} style={{ color: '#F59E0B' }} />
            <span className="font-mono" style={{ fontSize: '28px', fontWeight: 700, color: '#F59E0B', lineHeight: 1 }}>
              R$ 0
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {clientsAltoRisco.length} alto · {clientsMedioRisco.length} médio
          </p>
          {/* Per-client risk list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {clients.filter(c => c._risk_level).slice(0, 5).map(c => (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  textDecoration: 'none', padding: '6px 0',
                }}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: avatarColor(c.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {getInitials(c.name)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                <span className="font-mono" style={{
                  padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                  textTransform: 'uppercase', flexShrink: 0,
                  ...riskBadgeStyle(c._risk_level),
                }}>
                  {c._risk_level}
                </span>
              </Link>
            ))}
            {clients.filter(c => c._risk_level).length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
                <Shield size={16} style={{ color: '#22C55E', opacity: 0.6 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem riscos classificados</span>
              </div>
            )}
          </div>
        </div>

        {/* ── ATIVIDADE RECENTE ──────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>
            Atividade Recente
          </h2>
          {atividades.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma atividade recente.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {atividades.map(a => {
                const borderColor = a.tipo === 'documento' ? '#3B82F6' : '#8B5CF6'
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      borderLeft: `3px solid ${borderColor}`,
                    }}
                  >
                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.descricao}
                    </p>
                    <p className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      {relativeTime(a.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ 5. CLIENT GRID ═══════════════════════════════════ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ ...sectionTitle, margin: 0 }}>
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
                  height: '32px', paddingLeft: '30px', paddingRight: '12px',
                  borderRadius: '6px', background: 'var(--bg-input)',
                  border: '1px solid var(--border)', color: 'var(--text-primary)',
                  fontSize: '13px', outline: 'none', width: '200px',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {filteredClients.slice(0, 12).map(client => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px', borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                {/* Initials circle */}
                <span style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: avatarColor(client.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>
                  {getInitials(client.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span className="font-mono" style={{
                      padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                    }}>
                      {client._project_count} proc.
                    </span>
                    {client._risk_level && (
                      <span className="font-mono" style={{
                        padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                        textTransform: 'uppercase',
                        ...riskBadgeStyle(client._risk_level),
                      }}>
                        {client._risk_level}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 6. PRAZOS PRÓXIMOS ═══════════════════════════════ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ ...sectionTitle, margin: 0 }}>
            Prazos Próximos
          </h2>
          <Link href="/dashboard/prazos" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>

        {prazosProximos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum prazo pendente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {prazosProximos.slice(0, 8).map(p => {
              const badge = prazoUrgencyBadge(p)
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Urgency badge */}
                  <span className="font-mono" style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                    minWidth: '64px', textAlign: 'center', flexShrink: 0,
                    ...badge.style,
                  }}>
                    {badge.label}
                  </span>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.descricao}
                    </p>
                    <Link
                      href={`/dashboard/projects/${p.project_id}`}
                      style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {p.project_name || '—'}
                    </Link>
                  </div>
                  {/* Date */}
                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {formatDate(p.data_prazo)}
                  </span>
                </div>
              )
            })}
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
