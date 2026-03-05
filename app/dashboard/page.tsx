'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { diasUteisRestantes, formatDate } from '@/lib/utils'
import type { Prazo, Client } from '@/lib/types'
import Link from 'next/link'
import {
  Search, TrendingUp, FileText, CalendarClock, Users, ArrowRight,
  Zap, BarChart2, Sparkles, DollarSign, Shield, AlertTriangle,
} from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'

/* ─── Types ──────────────────────────────────────────────────── */
interface Stats {
  totalProcessos:   number
  docsPendentes:    number
  prazosEstaSemana: number
  prazosVencidos:   number
  totalClientes:    number
  docsCompletados:  number
}

interface Pipeline {
  analise:     number
  contestacao: number
  recurso:     number
  execucao:    number
  encerrado:   number
}

interface AtividadeItem {
  id:          string
  tipo:        'documento' | 'peca'
  descricao:   string
  created_at:  string
  project_id?: string
}

interface ClientWithMeta extends Client {
  _project_count: number
  _risk_level:    'alto' | 'medio' | 'baixo' | null
  _next_prazo:    string | null
}

const AVATAR_COLORS = ['#3B82F6','#EF4444','#22C55E','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316']

type Urgency = 'critico' | 'alto' | 'medio' | 'baixo'

/* ─── Helpers ────────────────────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDateBR(): string {
  const d = new Date()
  const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
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
  if (diffMin < 1)  return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h atrás`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)  return 'ontem'
  if (diffD < 7)    return `${diffD}d atrás`
  return formatDate(dateStr)
}

function urgencyFromDias(dias: number): Urgency {
  if (dias < 0)  return 'critico'
  if (dias === 0) return 'critico'
  if (dias <= 2) return 'alto'
  if (dias <= 7) return 'medio'
  return 'baixo'
}

function riskPriority(risk: string): number {
  if (risk === 'alto')  return 3
  if (risk === 'medio') return 2
  if (risk === 'baixo') return 1
  return 0
}

/* ─── SLabel sub-component ───────────────────────────────────── */
function SLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: 9, color, letterSpacing: '0.1em',
      fontFamily: 'IBM Plex Mono, monospace',
      textTransform: 'uppercase' as const,
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

/* ─── Unused imports kept to satisfy TS ─────────────────────── */
const _unused = { TrendingUp, FileText, CalendarClock, Zap, BarChart2, Sparkles, DollarSign, AlertTriangle }
void _unused

/* ─── Component ──────────────────────────────────────────────── */
export default function DashboardPage() {
  const { firmId, userName } = useAuth()
  const { theme } = useTheme()

  // Theme-aware color palette — recomputed on every theme switch
  const C = getColors(theme)

  // Configs that depend on C (must live inside component)
  const STAGE_CFG: { key: keyof Pipeline; label: string; color: string }[] = [
    { key: 'analise',     label: 'Análise',     color: C.stages.analise },
    { key: 'contestacao', label: 'Contestação', color: C.stages.contestacao },
    { key: 'recurso',     label: 'Recurso',     color: C.stages.recurso },
    { key: 'execucao',    label: 'Execução',    color: C.stages.execucao },
    { key: 'encerrado',   label: 'Encerrado',   color: C.stages.encerrado },
  ]

  const URGENCY_CFG: Record<Urgency, { cor: string; bg: string; border: string }> = {
    critico: { cor: C.red,    bg: C.redBg,    border: C.redBorder },
    alto:    { cor: C.yellow, bg: C.yellowBg, border: C.yellowBorder },
    medio:   { cor: C.blue,   bg: C.blueBg,   border: C.blueBorder },
    baixo:   { cor: C.text3,  bg: theme === 'light' ? C.bg3 : '#1A1A2088', border: C.border1 },
  }

  const [stats,          setStats]          = useState<Stats>({ totalProcessos: 0, docsPendentes: 0, prazosEstaSemana: 0, prazosVencidos: 0, totalClientes: 0, docsCompletados: 0 })
  const [pipeline,       setPipeline]       = useState<Pipeline>({ analise: 0, contestacao: 0, recurso: 0, execucao: 0, encerrado: 0 })
  const [prazosProximos, setPrazosProximos] = useState<(Prazo & { project_name?: string; dias_uteis_restantes?: number })[]>([])
  const [atividades,     setAtividades]     = useState<AtividadeItem[]>([])
  const [clients,        setClients]        = useState<ClientWithMeta[]>([])
  const [clientSearch,   setClientSearch]   = useState('')
  const [loading,        setLoading]        = useState(true)
  const [briefingAberto, setBriefingAberto] = useState(true)

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

      const projects = projRes.data  || []
      const docs     = docRes.data   || []
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
  const clientsAltoRisco   = clients.filter(c => c._risk_level === 'alto')
  const clientsMedioRisco  = clients.filter(c => c._risk_level === 'medio')
  const clientsBaixoRisco  = clients.filter(c => c._risk_level === 'baixo')

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(clientSearch))
  )

  /* Greeting — fix "Dr. Dr" bug */
  const greetingName = (() => {
    if (!userName) return 'Doutor(a)'
    const lower = userName.trim().toLowerCase()
    if (lower.startsWith('dr.') || lower.startsWith('dra.') ||
        lower.startsWith('dr ') || lower.startsWith('dra ')) {
      return userName.split(' ').slice(0, 2).join(' ')
    }
    return `Dr. ${userName.split(' ')[0]}`
  })()

  const tipoIcon: Record<string, string> = { documento: '↑', peca: '◆' }

  /* ─── KPI definitions ────────────────────────────────────── */
  const kpis = [
    { key: 'totalProcessos',   label: 'Processos Ativos',   value: stats.totalProcessos,   color: C.amber,  alert: false },
    { key: 'totalClientes',    label: 'Clientes',           value: stats.totalClientes,    color: C.blue,   alert: false },
    { key: 'prazosEstaSemana', label: 'Prazos Esta Semana', value: stats.prazosEstaSemana, color: C.yellow, alert: stats.prazosEstaSemana > 0 },
    { key: 'prazosVencidos',   label: 'Prazos Vencidos',    value: stats.prazosVencidos,   color: C.red,    alert: stats.prazosVencidos > 0 },
    { key: 'docsPendentes',    label: 'Docs Pendentes',     value: stats.docsPendentes,    color: C.yellow, alert: stats.docsPendentes > 0 },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .35; transform: scale(.8); }
        }
        .f1 { animation: fadeUp 0.35s ease both; }
        .f2 { animation: fadeUp 0.35s ease 0.07s both; }
        .f3 { animation: fadeUp 0.35s ease 0.13s both; }
        .f4 { animation: fadeUp 0.35s ease 0.19s both; }
        .pulse { animation: pulseDot 1.4s ease infinite; }

        .kpi-card:hover    { border-color: ${C.border3} !important; }
        .client-card:hover { border-color: ${C.amber}50 !important; background: ${C.bg3} !important; }
        .prazo-row:hover   { filter: brightness(1.15); }
        .atv-card:hover    { background: ${C.bg3} !important; }
        .action-btn-amber:hover { background: ${C.amberBg} !important; border-color: ${C.amberBorder} !important; color: ${C.amber} !important; }
        .action-btn-muted:hover { background: ${C.bg3} !important; border-color: ${C.border3} !important; color: ${C.text1} !important; }
        .link-btn:hover    { color: ${C.amber} !important; }
        .risk-row:hover    { background: ${C.bg3} !important; }

        /* ── Responsive grids ─────────────────────────────── */
        .kpi-grid        { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .two-col-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .client-grid     { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .activity-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .briefing-grid   { display: grid; grid-template-columns: 1fr 1fr 1fr; }
        .top-bar         { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .top-bar-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 4px; }

        @media (max-width: 768px) {
          .kpi-grid        { grid-template-columns: repeat(2, 1fr); }
          .two-col-grid    { grid-template-columns: 1fr; }
          .client-grid     { grid-template-columns: 1fr; }
          .activity-grid   { grid-template-columns: 1fr; }
          .briefing-grid   { grid-template-columns: 1fr; }
          .top-bar         { flex-direction: column; gap: 12px; }
          .top-bar-actions { flex-wrap: wrap; padding-top: 0; }
          .briefing-col-border { border-left: none !important; border-top: 1px solid ${C.border1} !important; }
        }

        @media (max-width: 480px) {
          .kpi-grid        { grid-template-columns: 1fr; }
          .top-bar-actions { gap: 8px; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ═══ 1. TOP BAR ══════════════════════════════════════ */}
        <div className="f1 top-bar">
          {/* Left */}
          <div>
            <div style={{
              fontSize: '9px', color: C.text3, letterSpacing: '0.1em',
              fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              {formatDateBR()} · {formatCurrentTime()}
            </div>
            <h1 style={{
              fontSize: '24px', fontWeight: 700, margin: 0,
              color: C.text1, letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>
              {getGreeting()}, {greetingName}
            </h1>
            <div style={{
              fontSize: '11px', color: C.text3, marginTop: '5px',
              fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
            }}>
              {stats.totalProcessos} processos · {stats.totalClientes} clientes
            </div>
          </div>

          {/* Right: alert + actions */}
          <div className="top-bar-actions">
            {stats.prazosVencidos > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: C.redBg, border: `1px solid ${C.redBorder}`,
                borderRadius: '6px', padding: '7px 13px',
              }}>
                <span className="pulse" style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: C.red, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: C.red,
                  fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                }}>
                  {stats.prazosVencidos} PRAZO{stats.prazosVencidos > 1 ? 'S' : ''} VENCIDO{stats.prazosVencidos > 1 ? 'S' : ''}
                </span>
              </div>
            )}
            <Link
              href="/dashboard/clients"
              className="action-btn-amber"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '7px',
                background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                color: C.amber, fontSize: '11px', fontWeight: 700,
                textDecoration: 'none', transition: 'all 150ms ease',
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
              }}
            >
              + CLIENTE
            </Link>
            <Link
              href="/dashboard/projects/new"
              className="action-btn-muted"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '7px',
                background: C.bg2, border: `1px solid ${C.border2}`,
                color: C.text2, fontSize: '11px', fontWeight: 500,
                textDecoration: 'none', transition: 'all 150ms ease',
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
              }}
            >
              + PROCESSO
            </Link>
          </div>
        </div>

        {/* ═══ 2. AI BRIEFING ══════════════════════════════════ */}
        <div className="f1" style={{
          background: C.bg1,
          border: `1px solid ${C.border2}`,
          borderLeft: `3px solid ${C.amber}`,
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {/* Header — clickable to toggle */}
          <div
            onClick={() => setBriefingAberto(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: C.amber }}>◆</span>
              <span style={{
                fontSize: '10px', color: C.amber,
                fontFamily: 'IBM Plex Mono, monospace',
                textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
              }}>
                Briefing Executivo · IA
              </span>
              <span style={{
                fontSize: '9px', background: C.amberBg, color: C.amber,
                border: `1px solid ${C.amberBorder}`, padding: '2px 8px',
                borderRadius: '4px', fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.06em',
              }}>
                Gerado {formatCurrentTime()}
              </span>
            </div>
            <span style={{
              fontSize: '9px', color: C.text3,
              fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.08em',
            }}>
              {briefingAberto ? '▲ RECOLHER' : '▼ EXPANDIR'}
            </span>
          </div>

          {briefingAberto && (
            <div
              className="briefing-grid"
              style={{ borderTop: `1px solid ${C.border1}` }}
            >
              {/* AÇÃO IMEDIATA */}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                  <span style={{ color: C.red, fontSize: '13px' }}>⚡</span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: C.red, fontWeight: 700,
                  }}>Ação Imediata</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {stats.prazosVencidos > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.red, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.text1 }}>
                        <strong>{stats.prazosVencidos}</strong> prazo{stats.prazosVencidos > 1 ? 's' : ''} vencido{stats.prazosVencidos > 1 ? 's' : ''} — ação urgente
                      </span>
                    </div>
                  )}
                  {stats.docsPendentes > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.yellow, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.text1 }}>
                        <strong>{stats.docsPendentes}</strong> doc{stats.docsPendentes > 1 ? 's' : ''} aguardando processamento
                      </span>
                    </div>
                  )}
                  {stats.prazosEstaSemana > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.yellow, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.text1 }}>
                        <strong>{stats.prazosEstaSemana}</strong> prazo{stats.prazosEstaSemana > 1 ? 's' : ''} esta semana
                      </span>
                    </div>
                  )}
                  {stats.prazosVencidos === 0 && stats.docsPendentes === 0 && stats.prazosEstaSemana === 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.green }}>Nenhuma pendência urgente</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SITUAÇÃO DA CARTEIRA */}
              <div className="briefing-col-border" style={{ padding: '18px 20px', borderLeft: `1px solid ${C.border1}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                  <span style={{ color: C.amber, fontSize: '12px' }}>◈</span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: C.text2, fontWeight: 700,
                  }}>Situação da Carteira</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.amber, marginTop: '6px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: C.text1 }}>
                      <strong>{stats.totalProcessos}</strong> processo{stats.totalProcessos !== 1 ? 's' : ''} ativo{stats.totalProcessos !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.blue, marginTop: '6px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: C.text1 }}>
                      <strong>{pipeline.analise}</strong> em fase de análise
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.text3, marginTop: '6px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: C.text1 }}>
                      <strong>{stats.totalClientes}</strong> cliente{stats.totalClientes !== 1 ? 's' : ''} na carteira
                    </span>
                  </div>
                </div>
              </div>

              {/* RESULTADOS */}
              <div className="briefing-col-border" style={{ padding: '18px 20px', borderLeft: `1px solid ${C.border1}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                  <span style={{ color: C.green, fontSize: '12px' }}>✓</span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: C.green, fontWeight: 700,
                  }}>Resultados</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {pecasGeradas > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.text1 }}>
                        <strong>{pecasGeradas}</strong> peça{pecasGeradas > 1 ? 's' : ''} gerada{pecasGeradas > 1 ? 's' : ''} recentemente
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green, marginTop: '6px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: C.text1 }}>
                      <strong>{stats.docsCompletados}</strong> documento{stats.docsCompletados !== 1 ? 's' : ''} processado{stats.docsCompletados !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {stats.prazosVencidos === 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green, marginTop: '6px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: C.green }}>Carteira sem prazos vencidos</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 3. KPI ROW ══════════════════════════════════════ */}
        <div className="f2 kpi-grid">
          {kpis.map(kpi => (
            <div
              key={kpi.key}
              className="kpi-card"
              style={{
                padding: '18px 20px',
                borderRadius: '10px',
                background: kpi.alert ? kpi.color + '0A' : C.bg1,
                border: `1px solid ${kpi.alert ? kpi.color + '35' : C.border2}`,
                borderTop: `2px solid ${kpi.alert ? kpi.color : C.border1}`,
                transition: 'border-color 150ms ease',
              }}
            >
              <div style={{
                fontSize: '9px', color: C.text3, letterSpacing: '0.1em',
                fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
                marginBottom: '12px',
              }}>
                {kpi.label}
              </div>
              <div style={{
                fontSize: '38px', fontWeight: 700, color: kpi.color,
                fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1,
              }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ 4. PIPELINE + RISCO ═════════════════════════════ */}
        <div className="f2 two-col-grid">

          {/* ── Pipeline Global ───────────────────────────────── */}
          <div style={{
            background: C.bg1, border: `1px solid ${C.border2}`,
            borderRadius: '10px', padding: '20px',
          }}>
            <SLabel color={C.text3}>Pipeline Global — {stats.totalProcessos} processos</SLabel>

            {/* Proportional colored bar */}
            <div style={{
              display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden',
              background: C.bg3, gap: '2px', marginBottom: '18px',
            }}>
              {STAGE_CFG.map(stage => {
                const count = pipeline[stage.key]
                const pct = (count / totalPipeline) * 100
                if (pct === 0) return null
                return (
                  <div
                    key={stage.key}
                    title={`${stage.label}: ${count}`}
                    style={{
                      width: `${pct}%`, background: stage.color,
                      borderRadius: '3px', transition: 'width 400ms ease',
                      minWidth: count > 0 ? '8px' : 0,
                    }}
                  />
                )
              })}
            </div>

            {/* Legend with mini progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {STAGE_CFG.map(stage => {
                const count = pipeline[stage.key]
                const pct = (count / totalPipeline) * 100
                return (
                  <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '2px',
                      background: stage.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '11px', color: C.text2, flex: 1,
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      {stage.label}
                    </span>
                    <div style={{
                      width: '60px', height: '4px', borderRadius: '2px',
                      background: C.bg3, overflow: 'hidden', flexShrink: 0,
                    }}>
                      <div style={{
                        width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                        height: '100%', background: stage.color, borderRadius: '2px',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '14px', fontWeight: 700,
                      color: count > 0 ? stage.color : C.text4,
                      fontFamily: 'IBM Plex Mono, monospace',
                      width: '24px', textAlign: 'right',
                    }}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Risco Financeiro ───────────────────────────────── */}
          <div style={{
            background: C.bg1, border: `1px solid ${C.border2}`,
            borderRadius: '10px', padding: '20px',
          }}>
            <SLabel color={C.text3}>Risco Financeiro — Carteira</SLabel>

            {/* Risk counters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              {[
                { label: 'ALTO',  count: clientsAltoRisco.length,  color: C.red,    bg: C.redBg,    border: C.redBorder },
                { label: 'MÉDIO', count: clientsMedioRisco.length, color: C.yellow, bg: C.yellowBg, border: C.yellowBorder },
                { label: 'BAIXO', count: clientsBaixoRisco.length, color: C.green,  bg: C.greenBg,  border: C.greenBorder },
              ].map(r => (
                <div key={r.label} style={{
                  flex: 1, padding: '10px 12px', borderRadius: '8px',
                  background: r.bg, border: `1px solid ${r.border}`,
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '24px', fontWeight: 700, color: r.color,
                    fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1,
                  }}>
                    {r.count}
                  </div>
                  <div style={{
                    fontSize: '8px', color: r.color,
                    fontFamily: 'IBM Plex Mono, monospace',
                    letterSpacing: '0.1em', marginTop: '5px',
                  }}>
                    {r.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-client risk breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {clients.filter(c => c._risk_level).slice(0, 5).map(c => {
                const rc = c._risk_level === 'alto' ? C.red : c._risk_level === 'medio' ? C.yellow : C.green
                const rb = c._risk_level === 'alto' ? C.redBg : c._risk_level === 'medio' ? C.yellowBg : C.greenBg
                const rd = c._risk_level === 'alto' ? C.redBorder : c._risk_level === 'medio' ? C.yellowBorder : C.greenBorder
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/clients/${c.id}`}
                    className="risk-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      textDecoration: 'none', padding: '7px 10px',
                      borderRadius: '6px', background: C.bg2,
                      border: `1px solid ${C.border1}`,
                      transition: 'background 150ms ease',
                    }}
                  >
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '6px',
                      background: avatarColor(c.name) + '25',
                      border: `1px solid ${avatarColor(c.name)}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: avatarColor(c.name),
                      flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      {getInitials(c.name)}
                    </span>
                    <span style={{
                      fontSize: '11px', color: C.text1, flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name}
                    </span>
                    <span style={{
                      padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                      textTransform: 'uppercase', flexShrink: 0,
                      background: rb, color: rc, border: `1px solid ${rd}`,
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      {c._risk_level}
                    </span>
                  </Link>
                )
              })}
              {clients.filter(c => c._risk_level).length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
                  <Shield size={16} style={{ color: C.green, opacity: 0.5 }} />
                  <span style={{ fontSize: '12px', color: C.text3 }}>Sem riscos classificados na carteira</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 5. CLIENT GRID ══════════════════════════════════ */}
        <div className="f3" style={{
          background: C.bg1, border: `1px solid ${C.border2}`,
          borderRadius: '10px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <SLabel color={C.text3}>Carteira de Clientes — {stats.totalClientes} clientes</SLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-14px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: C.text3 }} />
                <input
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  style={{
                    height: '30px', paddingLeft: '27px', paddingRight: '10px',
                    borderRadius: '6px', background: C.bg3,
                    border: `1px solid ${C.border2}`, color: C.text1,
                    fontSize: '11px', outline: 'none', width: '175px',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                />
              </div>
              <Link
                href="/dashboard/clients"
                className="link-btn"
                style={{
                  fontSize: '9px', color: C.text3, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                  transition: 'color 150ms ease',
                }}
              >
                VER TODOS <ArrowRight size={10} />
              </Link>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.text3 }}>
              <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.25 }} />
              <p style={{ fontSize: '12px' }}>{clientSearch ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</p>
            </div>
          ) : (
            <div className="client-grid">
              {filteredClients.slice(0, 12).map(client => {
                const ac = avatarColor(client.name)
                const rc = client._risk_level === 'alto' ? C.red   : client._risk_level === 'medio' ? C.yellow : C.green
                const rb = client._risk_level === 'alto' ? C.redBg : client._risk_level === 'medio' ? C.yellowBg : C.greenBg
                const rd = client._risk_level === 'alto' ? C.redBorder : client._risk_level === 'medio' ? C.yellowBorder : C.greenBorder
                return (
                  <Link
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className="client-card"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '12px',
                      padding: '14px 16px', borderRadius: '8px',
                      background: C.bg2, border: `1px solid ${C.border1}`,
                      textDecoration: 'none', transition: 'all 150ms ease',
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '34px', height: '34px', borderRadius: '8px',
                        background: ac + '20', border: `1px solid ${ac}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: ac,
                        flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace',
                      }}>
                        {getInitials(client.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px', fontWeight: 600, color: C.text1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {client.name}
                        </div>
                        <div style={{
                          fontSize: '10px', color: C.text3, marginTop: '2px',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {client._project_count} proc{client._next_prazo ? ` · próx. ${formatDate(client._next_prazo)}` : ''}
                        </div>
                      </div>
                      {client._risk_level && (
                        <span style={{
                          padding: '2px 7px', borderRadius: '4px', fontSize: '8px', fontWeight: 700,
                          textTransform: 'uppercase', flexShrink: 0,
                          background: rb, color: rc, border: `1px solid ${rd}`,
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {client._risk_level}
                        </span>
                      )}
                    </div>

                    {/* Pipeline mini-bar */}
                    <div>
                      <div style={{
                        display: 'flex', height: '4px', borderRadius: '2px',
                        overflow: 'hidden', background: C.bg3, gap: '1px',
                      }}>
                        {STAGE_CFG.filter(s => s.key !== 'encerrado').map(stage => (
                          <div
                            key={stage.key}
                            style={{
                              flex: 1, background: stage.color,
                              opacity: client._project_count > 0 ? 0.55 : 0.15,
                              borderRadius: '1px',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace' }}>
                          PIPELINE
                        </span>
                        <span style={{ fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace' }}>
                          {client._project_count} proc.
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ 6. PRAZOS + ATIVIDADE ═══════════════════════════ */}
        <div className="f4 two-col-grid">

          {/* ── Prazos Próximos ───────────────────────────────── */}
          <div style={{
            background: C.bg1, border: `1px solid ${C.border2}`,
            borderRadius: '10px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <SLabel color={C.text3}>Prazos Próximos — {prazosProximos.length} pendentes</SLabel>
              <Link
                href="/dashboard/prazos"
                className="link-btn"
                style={{
                  fontSize: '9px', color: C.text3, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                  transition: 'color 150ms ease', marginTop: '-14px',
                }}
              >
                VER TODOS <ArrowRight size={10} />
              </Link>
            </div>

            {prazosProximos.length === 0 ? (
              <p style={{ color: C.text3, fontSize: '12px', padding: '16px 0' }}>Nenhum prazo pendente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {prazosProximos.slice(0, 8).map(p => {
                  const dias = p.dias_uteis_restantes ?? 0
                  const urgency = urgencyFromDias(dias)
                  const urg = URGENCY_CFG[urgency]
                  return (
                    <div
                      key={p.id}
                      className="prazo-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 10px', borderRadius: '6px',
                        background: urg.bg, border: `1px solid ${urg.border}`,
                        transition: 'filter 150ms ease',
                      }}
                    >
                      <span style={{
                        padding: '2px 7px', borderRadius: '4px', fontSize: '8px', fontWeight: 700,
                        minWidth: '52px', textAlign: 'center', flexShrink: 0,
                        color: urg.cor, border: `1px solid ${urg.border}`,
                        fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.05em',
                        background: 'transparent',
                      }}>
                        {dias < 0 ? 'VENCIDO' : dias === 0 ? 'HOJE' : dias === 1 ? 'AMANHÃ' : `${dias}d`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '11px', color: C.text1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {p.descricao}
                        </div>
                        <div style={{
                          fontSize: '9px', color: C.text3, marginTop: '2px',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {p.project_name || '—'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '9px', color: C.text3, flexShrink: 0,
                        fontFamily: 'IBM Plex Mono, monospace',
                      }}>
                        {formatDate(p.data_prazo)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Atividade Recente ─────────────────────────────── */}
          <div style={{
            background: C.bg1, border: `1px solid ${C.border2}`,
            borderRadius: '10px', padding: '20px',
          }}>
            <SLabel color={C.text3}>Atividade Recente</SLabel>

            {atividades.length === 0 ? (
              <p style={{ color: C.text3, fontSize: '12px', padding: '16px 0' }}>Nenhuma atividade recente.</p>
            ) : (
              <div className="activity-grid">
                {atividades.map(a => {
                  const icon = tipoIcon[a.tipo] ?? '·'
                  const borderColor = a.tipo === 'documento' ? C.blue : C.stages.contestacao
                  return (
                    <div
                      key={a.id}
                      className="atv-card"
                      style={{
                        padding: '11px 12px', borderRadius: '7px',
                        background: C.bg2, border: `1px solid ${C.border1}`,
                        borderLeft: `3px solid ${borderColor}`,
                        transition: 'background 150ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: borderColor, flexShrink: 0, marginTop: '1px' }}>
                          {icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11px', color: C.text1, fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {a.descricao}
                          </div>
                          <div style={{
                            fontSize: '9px', color: C.text3, marginTop: '4px',
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>
                            {relativeTime(a.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
