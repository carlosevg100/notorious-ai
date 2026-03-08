'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Upload, CheckCircle2, Loader2, FileText,
  AlertCircle, Trash2, ChevronDown, ChevronRight,
  Scale, BookOpen, TrendingUp, TrendingDown, Edit3, Save,
  ClipboardList, ShieldCheck, Users, Printer, Calendar,
  Gavel, MapPin, User, Banknote, List, Link,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'
import type { CaseAnalysis, DocumentoNecessario, ProvaFornecida, ChecklistDocumentos } from '@/app/api/analyze-case/route'

/* ─── Types ──────────────────────────────────────────────────── */

const DOCUMENT_CATEGORIES = [
  'Petição Inicial',
  'Procuração',
  'Contrato',
  'Laudo / Parecer',
  'Comprovante',
  'Notificação',
  'Outro',
] as const

const CLIENT_DOCUMENT_CATEGORIES = [
  'Contrato',
  'Correspondência (WhatsApp/Email)',
  'Comprovante de Pagamento',
  'Gravação/Áudio',
  'Procuração',
  'Outro',
] as const

type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]
type ClientDocCategory = typeof CLIENT_DOCUMENT_CATEGORIES[number]

interface TaggedFile {
  id: string
  file: File
  category: DocumentCategory
  suggested?: boolean
}

interface ClientTaggedFile {
  id: string
  file: File
  category: ClientDocCategory
}

interface Client {
  id: string
  name: string
}

interface PeticaoParty {
  nome: string | null
  cpf_cnpj: string | null
  rg: string | null
  nacionalidade: string | null
  estado_civil: string | null
  profissao: string | null
  data_nascimento: string | null
  email: string | null
  endereco_completo: string | null
  telefone: string | null
  representante_legal?: string | null
  cargo_representante?: string | null
}

interface PeticaoAdvogado {
  nome: string | null
  oab: string | null
  seccional: string | null
  escritorio: string | null
  endereco: string | null
  email: string | null
  telefone: string | null
}

interface PeticaoValorItem {
  item: string
  valor: string
}

interface PeticaoExtracted {
  numero_processo: string | null
  nome_processo: string | null
  tipo_acao: string | null
  autor: PeticaoParty | null
  advogado_autor: PeticaoAdvogado | null
  reu: PeticaoParty | null
  advogado_reu: PeticaoAdvogado | null
  vara: string | null
  comarca: string | null
  valor_causa: string | null
  valores_pleiteados: PeticaoValorItem[] | null
  pedidos: string | null
  prazos: string | null
  tipo: string | null
  area: string | null
  objeto_acao: string | null
  fatos_principais: string[] | null
  fundamentos_legais: string[] | null
  raw_text_preview?: string | null
}

interface SupportingExtracted {
  doc_type: string | null
  summary: string | null
  resumo_executivo?: string | null
  pontos_principais?: string[] | null
  parties: { name: string; role: string }[]
  key_dates: { date: string | null; description: string }[]
  deadlines: { date: string | null; description: string; urgency: string }[]
  risk_flags: { severity: string; description: string }[]
  relevant_clauses: string | null
  connection_to_case: string | null
}

interface FileExtractionResult {
  taggedFileId: string
  fileName: string
  category: DocumentCategory | ClientDocCategory
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
  extracted?: PeticaoExtracted | SupportingExtracted
  documentId?: string
}

interface JurisprudenciaItem {
  tribunal: string
  numero: string
  data: string
  ementa: string
  relevancia?: string
  risco?: string
}

interface ResearchResults {
  precedentes_favoraveis: JurisprudenciaItem[]
  precedentes_desfavoraveis: JurisprudenciaItem[]
  probabilidade_exito: number
  fundamentacao: string
}

interface StrategyResult {
  tese_principal: string
  teses_subsidiarias: string[]
  jurisprudencia_favoravel: JurisprudenciaItem[]
  jurisprudencia_desfavoravel: JurisprudenciaItem[]
  probabilidade_exito: number
  risco_estimado: string
  valor_risco_estimado: string
  recomendacao: string
  draft: string
}

interface ResumeProject {
  id: string
  clientId: string
  clientName: string
}

interface NovoProcessoModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  preSelectedClientId?: string | null
  resumeProject?: ResumeProject | null
}

/* ─── Avatar helpers ─────────────────────────────────────────── */
const AVATAR_COLORS = [
  '#3B82F6', '#EF4444', '#22C55E', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({ step, C }: { step: number; C: ReturnType<typeof getColors> }) {
  const steps = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Extração AI' },
    { n: 3, label: 'Resumo' },
    { n: 4, label: 'Docs Cliente' },
    { n: 5, label: 'Estratégia' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '24px' }}>
      {steps.map((s, idx) => {
        const isActive   = s.n === step
        const isDone     = s.n < step
        const isInactive = s.n > step
        void isInactive
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: isDone ? C.green : isActive ? C.amber : C.bg3,
                color: isDone ? '#fff' : isActive ? '#fff' : C.text3,
                border: `2px solid ${isDone ? C.green : isActive ? C.amber : C.border2}`,
                transition: 'all 300ms ease',
              }}>
                {isDone ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: '9px', fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: isActive ? C.amber : isDone ? C.green : C.text3,
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{
                width: '40px', height: '2px', margin: '-14px 0 0',
                background: s.n < step ? C.green : C.border2,
                transition: 'background 300ms ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── File status icon ───────────────────────────────────────── */
function FileStatusIcon({ status, C }: { status: FileExtractionResult['status']; C: ReturnType<typeof getColors> }) {
  if (status === 'done') return <CheckCircle2 size={14} style={{ color: C.green, flexShrink: 0 }} />
  if (status === 'error') return <AlertCircle size={14} style={{ color: C.red, flexShrink: 0 }} />
  if (status === 'processing') return <Loader2 size={14} style={{ color: C.amber, flexShrink: 0, animation: 'spin 1s linear infinite' }} />
  return <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.border2}`, flexShrink: 0 }} />
}

/* ─── Category dropdown ──────────────────────────────────────── */
function CategoryDropdown({
  value, onChange, disabled, highlighted, options, C,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  highlighted?: boolean
  options: readonly string[]
  C: ReturnType<typeof getColors>
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          padding: '5px 28px 5px 10px',
          borderRadius: '6px',
          background: highlighted ? C.amberBg : C.bg2,
          border: `1px solid ${highlighted ? C.amber : C.border2}`,
          color: disabled ? C.text3 : C.text1,
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          minWidth: '140px',
          boxShadow: highlighted ? `0 0 0 2px ${C.amber}33` : 'none',
          transition: 'all 150ms ease',
        }}
      >
        {options.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: 'absolute', right: '8px', pointerEvents: 'none',
          color: disabled ? C.text4 : highlighted ? C.amber : C.text3,
        }}
      />
    </div>
  )
}

/* ─── Tribunal badge ─────────────────────────────────────────── */
function TribunalBadge({ tribunal, C }: { tribunal: string; C: ReturnType<typeof getColors> }) {
  const isSTJ = tribunal.toUpperCase().includes('STJ')
  const isSTF = tribunal.toUpperCase().includes('STF')
  const bg = isSTJ || isSTF ? C.amberBg : C.blueBg
  const border = isSTJ || isSTF ? C.amberBorder : C.blueBorder
  const color = isSTJ || isSTF ? C.amber : C.blue
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '4px',
      background: bg, border: `1px solid ${border}`,
      color, fontSize: '10px', fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.06em', flexShrink: 0,
    }}>
      {tribunal}
    </span>
  )
}

/* ─── Jurisprudência card ────────────────────────────────────── */
function JurisprudenciaCard({ item, type, C }: { item: JurisprudenciaItem; type: 'favorable' | 'unfavorable'; C: ReturnType<typeof getColors> }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = type === 'favorable' ? C.greenBorder : C.redBorder
  const badgeBg = type === 'favorable' ? C.greenBg : C.redBg
  return (
    <div style={{ borderRadius: '8px', background: C.bg2, border: `1px solid ${borderColor}`, padding: '10px 12px', transition: 'all 150ms ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <TribunalBadge tribunal={item.tribunal} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: C.text1, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.numero}</div>
          <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', marginTop: '1px' }}>{item.data}</div>
        </div>
        <button onClick={() => setExpanded(e => !e)} style={{ background: badgeBg, border: 'none', color: type === 'favorable' ? C.green : C.red, cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={12} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border1}` }}>
          <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.5, marginBottom: '6px' }}>{item.ementa}</div>
          {(item.relevancia || item.risco) && (
            <div style={{ fontSize: '10px', color: type === 'favorable' ? C.green : C.red, background: badgeBg, padding: '4px 8px', borderRadius: '4px', lineHeight: 1.4 }}>
              {type === 'favorable' ? `✓ ${item.relevancia}` : `⚠ ${item.risco}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Probability circle ─────────────────────────────────────── */
function ProbabilityDisplay({ value, C }: { value: number; C: ReturnType<typeof getColors> }) {
  const color = value >= 70 ? C.green : value >= 40 ? C.amber : C.red
  const label = value >= 70 ? 'Favorável' : value >= 40 ? 'Incerto' : 'Desfavorável'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, textAlign: 'center' }}>
      <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Probabilidade de Êxito</div>
      <div style={{ fontSize: '48px', fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}%</div>
      <div style={{ marginTop: '6px', padding: '3px 12px', borderRadius: '20px', background: color + '20', border: `1px solid ${color}50`, fontSize: '11px', fontWeight: 700, color }}>{label}</div>
      <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: C.bg3, overflow: 'hidden', marginTop: '10px' }}>
        <div style={{ height: '100%', width: `${value}%`, borderRadius: '2px', background: color, transition: 'width 800ms ease', boxShadow: `0 0 6px ${color}66` }} />
      </div>
    </div>
  )
}

/* ─── Priority badge ─────────────────────────────────────────── */
function PriorityBadge({ prioridade, C }: { prioridade: DocumentoNecessario['prioridade']; C: ReturnType<typeof getColors> }) {
  const config = {
    alta:  { color: C.red,   bg: C.redBg,   border: C.redBorder,   label: 'Alta' },
    media: { color: C.amber, bg: C.amberBg, border: C.amberBorder, label: 'Média' },
    baixa: { color: C.text3, bg: C.bg3,     border: C.border2,     label: 'Baixa' },
  }
  const s = config[prioridade] || config.baixa
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '4px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', flexShrink: 0 }}>
      {s.label}
    </span>
  )
}

/* ─── Checklist HTML export helper (pure string, no React) ─── */
function buildChecklistSectionHTML(checklist: ChecklistDocumentos): string {
  const grupos = (checklist.grupos || []).filter(g => g.documentos && g.documentos.length > 0)
  if (grupos.length === 0) return ''
  const totalDocs = grupos.reduce((s, g) => s + g.documentos.length, 0)
  const classifStyle = (c: string) => {
    if (c === 'OBRIGATÓRIO') return 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5'
    if (c === 'IMPORTANTE') return 'background:#fef3c7;color:#d97706;border:1px solid #fcd34d'
    if (c === 'COMPLEMENTAR') return 'background:#dbeafe;color:#2563eb;border:1px solid #93c5fd'
    if (c === 'REQUERIMENTO JUDICIAL') return 'background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd'
    return 'background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db'
  }
  const obsStyle = (t: string) => {
    if (t.includes('IMEDIATA') || t.includes('IMEDIATAMENTE') || t.includes('PRAZO') || t.includes('URGENTE'))
      return 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5'
    if (t.includes('CONTRADIÇÃO') || t.includes('FRACO'))
      return 'background:#fef3c7;color:#d97706;border:1px solid #fcd34d'
    if (t.includes('JURISPRUDÊNCIA'))
      return 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'
    return 'background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd'
  }
  return `
<h2>CHECKLIST DE DOCUMENTOS — ${checklist.subtitulo || ''}</h2>
<div style="font-size:11px;color:#555;margin-bottom:12px;font-family:monospace">Total: ${totalDocs} documentos em ${grupos.length} grupos</div>
${grupos.map(g => `
<div class="card" style="margin-bottom:14px;page-break-inside:avoid">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;flex:1">${g.nome}</div>
    <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace;${classifStyle(g.classificacao)}">${g.classificacao}</span>
  </div>
  ${g.documentos.map(d => `
  <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f5f5f5">
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600;margin-bottom:3px">${d.nome}</div>
      <div style="font-size:11px;color:#555;line-height:1.5">${d.justificativa}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span class="badge badge-${d.prioridade}">${d.prioridade}</span>
      <div style="display:flex;gap:4px;font-size:10px;font-family:monospace;color:#888">
        <span style="border:1px solid #ccc;border-radius:3px;padding:1px 5px">Rec ☐</span>
        <span style="border:1px solid #ccc;border-radius:3px;padding:1px 5px">Dig ☐</span>
        <span style="border:1px solid #ccc;border-radius:3px;padding:1px 5px">Jun ☐</span>
      </div>
    </div>
  </div>`).join('')}
</div>`).join('')}
${(checklist.observacoes_estrategicas || []).length > 0 ? `
<div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb;margin-top:14px">
  <div class="card-header" style="color:#92400e">OBSERVAÇÕES ESTRATÉGICAS DO ADVOGADO</div>
  ${(checklist.observacoes_estrategicas).map(o => `
  <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
    <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace;flex-shrink:0;${obsStyle(o.tipo)}">${o.tipo}</span>
    <div style="font-size:12px;color:#333;line-height:1.6">${o.descricao}</div>
  </div>`).join('')}
</div>` : ''}`
}

/* ─── Checklist badge color helpers ─────────────────────────── */
function classifBadgeColors(classificacao: string): { bg: string; color: string; border: string } {
  switch (classificacao) {
    case 'OBRIGATÓRIO':           return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' }
    case 'IMPORTANTE':            return { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' }
    case 'COMPLEMENTAR':          return { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' }
    case 'REQUERIMENTO JUDICIAL': return { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' }
    default:                      return { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' }
  }
}

function obsBadgeColors(tipo: string): { bg: string; color: string; border: string } {
  if (tipo.includes('IMEDIATA') || tipo.includes('IMEDIATAMENTE') || tipo.includes('PRAZO') || tipo.includes('URGENTE'))
    return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' }
  if (tipo.includes('CONTRADIÇÃO') || tipo.includes('FRACO'))
    return { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' }
  if (tipo.includes('JURISPRUDÊNCIA'))
    return { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' }
  return { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' }
}

function ChecklistDocumentosCard({ checklist, C }: { checklist: ChecklistDocumentos; C: ReturnType<typeof getColors> }) {
  const grupos = (checklist.grupos || []).filter(g => g.documentos && g.documentos.length > 0)
  const totalDocs = grupos.reduce((s, g) => s + g.documentos.length, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <ClipboardList size={13} style={{ color: C.blue, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {checklist.titulo || 'CHECKLIST DE DOCUMENTOS DO CLIENTE'}
              </div>
              {checklist.subtitulo && (
                <div style={{ fontSize: '10px', color: C.text4, marginTop: '1px' }}>{checklist.subtitulo}</div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            {totalDocs} documentos · {grupos.length} grupos
          </span>
        </div>
      </div>
      {grupos.map((grupo, gi) => {
        const bc = classifBadgeColors(grupo.classificacao)
        return (
          <div key={gi} style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text1, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                {grupo.nome}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', background: bc.bg, color: bc.color, border: `1px solid ${bc.border}`, flexShrink: 0 }}>
                {grupo.classificacao}
              </span>
              <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {grupo.documentos.length} doc{grupo.documentos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {grupo.documentos.map((doc, di) => (
                <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.text1 }}>{doc.nome}</span>
                      <PriorityBadge prioridade={doc.prioridade} C={C} />
                    </div>
                    <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5 }}>{doc.justificativa}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', marginTop: '2px' }}>
                    {(['Rec', 'Dig', 'Jun'] as const).map(label => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '3px', border: `1.5px solid ${C.border3}`, background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                        <span style={{ fontSize: '8px', color: C.text4, fontFamily: 'var(--font-mono)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {(checklist.observacoes_estrategicas || []).length > 0 && (
        <div style={{ borderRadius: '10px', background: C.amberBg, border: `2px solid ${C.amberBorder}`, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <AlertCircle size={13} style={{ color: C.amber, flexShrink: 0 }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: C.amber, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Observações Estratégicas do Advogado
            </div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {checklist.observacoes_estrategicas.map((obs, oi) => {
              const obc = obsBadgeColors(obs.tipo)
              return (
                <div key={oi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, padding: '3px 9px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginTop: '1px', background: obc.bg, color: obc.color, border: `1px solid ${obc.border}` }}>
                    {obs.tipo}
                  </span>
                  <div style={{ fontSize: '12px', color: C.text1, lineHeight: 1.6 }}>{obs.descricao}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Risk badge ─────────────────────────────────────────────── */
function RiskBadge({ risco, C }: { risco: string; C: ReturnType<typeof getColors> }) {
  const lower = risco.toLowerCase()
  const color = lower === 'alto' ? C.red : lower === 'medio' ? C.amber : C.green
  const bg    = lower === 'alto' ? C.redBg : lower === 'medio' ? C.amberBg : C.greenBg
  const border = lower === 'alto' ? C.redBorder : lower === 'medio' ? C.amberBorder : C.greenBorder
  const label = lower === 'alto' ? '⚠ Risco Alto' : lower === 'medio' ? '◈ Risco Médio' : '✓ Risco Baixo'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '6px', background: bg, border: `1px solid ${border}`, color, fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
      {label}
    </span>
  )
}

/* ─── Detail field ───────────────────────────────────────────── */
function DetailField({ label, value, C, span }: { label: string; value: string | null | undefined; C: ReturnType<typeof getColors>; span?: boolean }) {
  const empty = !value || value.trim() === ''
  return (
    <div style={{ marginBottom: '8px', gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: empty ? 400 : 500, marginTop: '2px', lineHeight: 1.4, color: empty ? C.text4 : C.text1, fontStyle: empty ? 'italic' : 'normal' }}>
        {empty ? 'Não informado' : value}
      </div>
    </div>
  )
}

/* ─── Expandable party card ──────────────────────────────────── */
import type { ParteDetalhada } from '@/app/api/analyze-case/route'

function ExpandablePartyCard({
  label, party, accent, icon, C,
}: {
  label: string
  party: ParteDetalhada | undefined | null
  accent: string
  icon: React.ReactNode
  C: ReturnType<typeof getColors>
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedAdvs, setExpandedAdvs] = useState<Set<number>>(new Set())

  const p = party || ({} as ParteDetalhada)

  // Build formatted address string
  const addr = p.endereco
  const addrParts = addr ? [
    addr.rua && addr.numero ? `${addr.rua}, ${addr.numero}` : (addr.rua || addr.numero || ''),
    addr.bairro,
    addr.cidade && addr.estado ? `${addr.cidade}/${addr.estado}` : (addr.cidade || addr.estado || ''),
    addr.cep,
  ].filter(Boolean) : []
  const addrStr = addrParts.length > 0 ? addrParts.join(' — ') : null

  // Calculate age from data_nascimento (DD/MM/AAAA)
  let idadeStr = ''
  if (p.data_nascimento) {
    const parts = p.data_nascimento.split('/')
    if (parts.length === 3) {
      const birth = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      if (!isNaN(birth.getTime())) {
        const now = new Date()
        let age = now.getFullYear() - birth.getFullYear()
        const m = now.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
        idadeStr = ` (${age} anos)`
      }
    }
  }
  const dataNascDisplay = p.data_nascimento ? `${p.data_nascimento}${idadeStr}` : null

  const toggleAdv = (i: number) => setExpandedAdvs(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  return (
    <div style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${accent}`, overflow: 'hidden' }}>
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '11px 14px', background: C.bg3, cursor: 'pointer', border: 'none',
          borderBottom: `1px solid ${expanded ? accent + '60' : C.border2}`,
          textAlign: 'left', transition: 'background 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.bg2 }}
        onMouseLeave={e => { e.currentTarget.style.background = C.bg3 }}
      >
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
          <div style={{ fontSize: '13px', color: C.text1, fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.nome || <span style={{ color: C.text4, fontStyle: 'italic', fontWeight: 400 }}>Não identificado</span>}
          </div>
        </div>
        {p.cpf_cnpj && (
          <span style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.cpf_cnpj}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '4px' }}>
          {!expanded && (
            <span style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)' }}>detalhes</span>
          )}
          <ChevronRight size={12} style={{ color: C.text4, transform: expanded ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
        </div>
      </button>

      {/* Collapsed: quick summary row */}
      {!expanded && (
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {p.estado_civil && (
            <span style={{ fontSize: '11px', color: C.text3, fontFamily: 'var(--font-mono)' }}>{p.estado_civil}</span>
          )}
          {p.profissao && (
            <span style={{ fontSize: '11px', color: C.text3 }}>{p.profissao}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)' }}>
            {(p.advogados || []).length > 0 ? `${p.advogados.length} adv.` : 'sem advogado'}
          </span>
        </div>
      )}

      {/* Expanded: full details */}
      {expanded && (
        <div style={{ padding: '14px 16px' }}>
          {/* Personal data 2-col grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <DetailField label="CPF / CNPJ" value={p.cpf_cnpj} C={C} />
            <DetailField label="RG" value={p.rg} C={C} />
            <DetailField label="Nacionalidade" value={p.nacionalidade} C={C} />
            <DetailField label="Estado Civil" value={p.estado_civil} C={C} />
            <DetailField label="Profissão" value={p.profissao} C={C} />
            <DetailField label="Data de Nascimento" value={dataNascDisplay} C={C} />
            <DetailField label="Email" value={p.email} C={C} />
            <DetailField label="Telefone" value={p.telefone} C={C} />
          </div>

          {/* Address full span */}
          {addrStr ? (
            <DetailField label="Endereço" value={addrStr} C={C} span />
          ) : (
            <DetailField label="Endereço" value={null} C={C} span />
          )}

          {/* Outras info */}
          {p.outras_info && p.outras_info.trim() !== '' && (
            <div style={{ marginTop: '4px', marginBottom: '8px', padding: '8px 10px', borderRadius: '6px', background: C.bg3, border: `1px solid ${C.border1}` }}>
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Outras Informações</div>
              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{p.outras_info}</div>
            </div>
          )}

          {/* Advogados */}
          <div style={{ marginTop: '12px', borderTop: `1px solid ${C.border1}`, paddingTop: '12px' }}>
            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>
              Advogados {(p.advogados || []).length > 0 ? `(${p.advogados.length})` : ''}
            </div>

            {(!p.advogados || p.advogados.length === 0) && (
              <div style={{ fontSize: '11px', color: C.text4, fontStyle: 'italic' }}>Advogado não identificado</div>
            )}

            {(p.advogados || []).map((adv, i) => {
              const advExp = expandedAdvs.has(i)
              const oabLabel = adv.oab ? `OAB ${adv.seccional ? adv.seccional + '/' : ''}${adv.oab}` : null
              return (
                <div key={i} style={{ borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border1}`, marginBottom: '6px', overflow: 'hidden' }}>
                  <button
                    onClick={() => toggleAdv(i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg2 }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: C.text1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.nome || '—'}</div>
                      {oabLabel && (
                        <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', marginTop: '1px' }}>{oabLabel}</div>
                      )}
                    </div>
                    <ChevronRight size={11} style={{ color: C.text4, flexShrink: 0, transform: advExp ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
                  </button>

                  {advExp && (
                    <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${C.border1}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      <DetailField label="OAB" value={oabLabel} C={C} />
                      <DetailField label="Escritório" value={adv.escritorio} C={C} />
                      <DetailField label="Email" value={adv.email} C={C} />
                      <DetailField label="Telefone" value={adv.telefone} C={C} />
                      {adv.endereco && adv.endereco.trim() !== '' && (
                        <DetailField label="Endereço do Escritório" value={adv.endereco} C={C} span />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */

export default function NovoProcessoModal({
  open,
  onClose,
  onSuccess,
  preSelectedClientId,
  resumeProject,
}: NovoProcessoModalProps) {
  const { firmId } = useAuth()
  const { theme } = useTheme()
  const C = getColors(theme)

  const [step,           setStep]           = useState(1)
  const [clients,        setClients]        = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [taggedFiles,    setTaggedFiles]    = useState<TaggedFile[]>([])
  const [dragOver,       setDragOver]       = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)

  /* Step 2 state */
  const [extractions,    setExtractions]    = useState<FileExtractionResult[]>([])
  const [logLines,       setLogLines]       = useState<string[]>([])
  const [overallProgress, setOverallProgress] = useState(0)
  const [projectId,      setProjectId]      = useState<string | null>(null)
  const [globalError,    setGlobalError]    = useState<string | null>(null)

  /* Step 2 → 3 bridge */
  const [peticaoData,    setPeticaoData]    = useState<PeticaoExtracted | null>(null)
  const [allExtractions, setAllExtractions] = useState<FileExtractionResult[]>([])
  const [expandedDocCards, setExpandedDocCards] = useState<Set<string>>(new Set())

  /* Step 3 — Case Analysis */
  const [caseAnalysis,         setCaseAnalysis]         = useState<CaseAnalysis | null>(null)
  const [caseAnalysisLoading,  setCaseAnalysisLoading]  = useState(false)
  const [caseAnalysisError,    setCaseAnalysisError]    = useState<string | null>(null)
  const [checkedDocs,          setCheckedDocs]          = useState<Set<number>>(new Set())
  const [isSavingAndWaiting,   setIsSavingAndWaiting]   = useState(false)

  /* Step 4 — Client Documents */
  const [clientTaggedFiles,    setClientTaggedFiles]    = useState<ClientTaggedFile[]>([])
  const [clientDragOver,       setClientDragOver]       = useState(false)
  const [clientExtractions,    setClientExtractions]    = useState<FileExtractionResult[]>([])
  const [clientLogLines,       setClientLogLines]       = useState<string[]>([])
  const [clientProgress,       setClientProgress]       = useState(0)
  const [clientExtractionsDone, setClientExtractionsDone] = useState(false)
  const [clientGlobalError,    setClientGlobalError]    = useState<string | null>(null)
  const clientFileInputRef = useRef<HTMLInputElement>(null)

  /* Step 5 — Research + Strategy state */
  const [researchLogLines,  setResearchLogLines]  = useState<string[]>([])
  const [researchDone,      setResearchDone]      = useState(false)
  const [researchResults,   setResearchResults]   = useState<ResearchResults | null>(null)
  const [researchError,     setResearchError]     = useState<string | null>(null)
  const [strategyData,      setStrategyData]      = useState<StrategyResult | null>(null)
  const [strategyLoading,   setStrategyLoading]   = useState(false)
  const [strategyError,     setStrategyError]     = useState<string | null>(null)
  const [showAdjustInput,   setShowAdjustInput]   = useState(false)
  const [adjustFeedback,    setAdjustFeedback]    = useState('')
  const [isSaving,          setIsSaving]          = useState(false)
  const [expandedTese,      setExpandedTese]      = useState<number | null>(null)

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const researchLogRef = useRef<HTMLDivElement>(null)
  const draftRef       = useRef<HTMLDivElement>(null)

  /* ── Reset on open ───────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setTaggedFiles([])
      setExtractions([])
      setLogLines([])
      setOverallProgress(0)
      setGlobalError(null)
      setAllExtractions([])
      setExpandedDocCards(new Set())
      setCaseAnalysisLoading(false)
      setCaseAnalysisError(null)
      setCheckedDocs(new Set())
      setIsSavingAndWaiting(false)
      setClientTaggedFiles([])
      setClientDragOver(false)
      setClientExtractions([])
      setClientLogLines([])
      setClientProgress(0)
      setClientExtractionsDone(false)
      setClientGlobalError(null)
      setResearchLogLines([])
      setResearchDone(false)
      setResearchResults(null)
      setResearchError(null)
      setStrategyData(null)
      setStrategyLoading(false)
      setStrategyError(null)
      setShowAdjustInput(false)
      setAdjustFeedback('')
      setIsSaving(false)

      if (resumeProject) {
        // Resume mode: start at Step 4 with existing project loaded
        setStep(4)
        setProjectId(resumeProject.id)
        setSelectedClient(resumeProject.clientId)
        setPeticaoData(null)
        setCaseAnalysis(null)
      } else {
        // Fresh start
        setStep(1)
        setProjectId(null)
        setPeticaoData(null)
        setCaseAnalysis(null)
        setSelectedClient(preSelectedClientId || null)
      }
    }
  }, [open, preSelectedClientId, resumeProject])

  /* ── Load saved Phase 1 analysis when resuming ───────────── */
  useEffect(() => {
    if (!open || !resumeProject) return

    async function loadResumedAnalysis() {
      if (!resumeProject) return
      try {
        const { data } = await supabase
          .from('case_strategies')
          .select('draft_peca')
          .eq('project_id', resumeProject.id)
          .eq('status', 'analise_inicial')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data?.draft_peca) {
          try {
            const parsed = JSON.parse(data.draft_peca) as {
              caseAnalysis?: CaseAnalysis
              peticaoData?: PeticaoExtracted
            }
            if (parsed.caseAnalysis) {
              setCaseAnalysis(parsed.caseAnalysis)
            }
            if (parsed.peticaoData) {
              setPeticaoData(parsed.peticaoData)
            } else if (parsed.caseAnalysis) {
              // Reconstruct synthetic peticaoData from saved analysis for Step 5
              const a = parsed.caseAnalysis
              const nullParty: PeticaoParty = {
                nome: null, cpf_cnpj: null, rg: null, nacionalidade: null,
                estado_civil: null, profissao: null, data_nascimento: null,
                email: null, endereco_completo: null, telefone: null,
              }
              const synth: PeticaoExtracted = {
                numero_processo: a.dados_processo?.numero_cnj || null,
                nome_processo: null,
                tipo_acao: a.objeto_da_acao?.tipo || null,
                autor: a.partes?.autor
                  ? { ...nullParty, nome: a.partes.autor.nome || null, cpf_cnpj: a.partes.autor.cpf_cnpj || null }
                  : null,
                advogado_autor: null,
                reu: a.partes?.reu
                  ? { ...nullParty, nome: a.partes.reu.nome || resumeProject.clientName || null, cpf_cnpj: a.partes.reu.cpf_cnpj || null }
                  : { ...nullParty, nome: resumeProject.clientName || null },
                advogado_reu: null,
                vara: a.dados_processo?.vara || null,
                comarca: a.dados_processo?.comarca || null,
                valor_causa: a.valores?.total || null,
                valores_pleiteados: null,
                pedidos: a.fundamento_juridico?.pedidos?.join('; ') || null,
                prazos: null,
                tipo: null,
                area: null,
                objeto_acao: a.objeto_da_acao?.descricao || null,
                fatos_principais: a.fatos_narrados || null,
                fundamentos_legais: a.fundamento_juridico?.base_legal || null,
              }
              setPeticaoData(synth)
            }
          } catch {
            // JSON parse error — proceed without analysis
          }
        }
      } catch {
        // Not found or error — proceed without analysis context
      }
    }

    loadResumedAnalysis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeProject?.id])

  /* ── Auto-scroll research log ────────────────────────────── */
  useEffect(() => {
    if (researchLogRef.current) {
      researchLogRef.current.scrollTop = researchLogRef.current.scrollHeight
    }
  }, [researchLogLines])

  /* ── Load clients ────────────────────────────────────────── */
  useEffect(() => {
    if (!open || !firmId) return
    supabase
      .from('clients')
      .select('id, name')
      .eq('firm_id', firmId)
      .order('name')
      .then(({ data }) => setClients(data || []))
  }, [open, firmId])

  /* ── Trigger case analysis when entering step 3 ──────────── */
  useEffect(() => {
    if (step !== 3 || caseAnalysis || caseAnalysisLoading || !projectId) return
    runCaseAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /* ── Trigger research when entering step 5 ───────────────── */
  useEffect(() => {
    if (step !== 5 || researchDone || researchLogLines.length > 0 || !projectId || !peticaoData) return
    runResearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /* ── Unique ID generator ─────────────────────────────────── */
  function genId() {
    return Math.random().toString(36).slice(2, 10)
  }

  /* ── File drop handlers (plaintiff docs) ─────────────────── */
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    addFiles(dropped)
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf')
    addFiles(selected)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  function isSuggestedPeticao(filename: string): boolean {
    const lower = filename.toLowerCase()
    return lower.includes('peti') || lower.includes('inicial')
  }
  function addFiles(files: File[]) {
    setTaggedFiles(prev => [
      ...prev,
      ...files.map(file => ({
        id: genId(),
        file,
        category: 'Outro' as DocumentCategory,
        suggested: isSuggestedPeticao(file.name),
      })),
    ])
  }
  function removeFile(id: string) {
    setTaggedFiles(prev => prev.filter(f => f.id !== id))
  }
  function handleCategoryChange(id: string, newCategory: DocumentCategory) {
    setTaggedFiles(prev => prev.map(f => {
      if (f.id === id) return { ...f, category: newCategory, suggested: false }
      if (newCategory === 'Petição Inicial' && f.category === 'Petição Inicial') return { ...f, category: 'Outro' as DocumentCategory }
      return f
    }))
  }

  /* ── File drop handlers (client docs) ───────────────────── */
  function handleClientDrop(e: React.DragEvent) {
    e.preventDefault()
    setClientDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    addClientFiles(dropped)
  }
  function handleClientFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf')
    addClientFiles(selected)
    if (clientFileInputRef.current) clientFileInputRef.current.value = ''
  }
  function addClientFiles(files: File[]) {
    setClientTaggedFiles(prev => [
      ...prev,
      ...files.map(file => ({ id: genId(), file, category: 'Outro' as ClientDocCategory })),
    ])
  }
  function removeClientFile(id: string) {
    setClientTaggedFiles(prev => prev.filter(f => f.id !== id))
  }
  function handleClientCategoryChange(id: string, cat: ClientDocCategory) {
    setClientTaggedFiles(prev => prev.map(f => f.id === id ? { ...f, category: cat } : f))
  }

  const hasPeticao = taggedFiles.some(f => f.category === 'Petição Inicial')
  const canProceed = selectedClient && taggedFiles.length > 0 && hasPeticao

  /* ── Log helpers ─────────────────────────────────────────── */
  function addLog(line: string) { setLogLines(prev => [...prev, line]) }
  function addResearchLog(line: string) { setResearchLogLines(prev => [...prev, line]) }
  function addClientLog(line: string) { setClientLogLines(prev => [...prev, line]) }

  /* ── Main plaintiff extraction flow ──────────────────────── */
  const runExtraction = useCallback(async () => {
    if (!firmId || !selectedClient || taggedFiles.length === 0) return
    setStep(2)
    setGlobalError(null)

    const initialExtractions: FileExtractionResult[] = taggedFiles.map(tf => ({
      taggedFileId: tf.id, fileName: tf.file.name, category: tf.category, status: 'pending',
    }))
    setExtractions(initialExtractions)
    const total = taggedFiles.length

    try {
      addLog('Criando processo no sistema...')
      const projectName = `Novo Processo — ${clients.find(c => c.id === selectedClient)?.name || 'Cliente'}`
      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .insert({ firm_id: firmId, client_id: selectedClient, name: projectName, fase: 'analise', status: 'ativo', risk_level: 'medio', tipo: 'contencioso', area: 'civel' })
        .select('id')
        .single()

      if (projectError || !projectRow) throw new Error(`Falha ao criar processo: ${projectError?.message}`)

      const newProjectId = projectRow.id
      setProjectId(newProjectId)
      addLog(`✓ Processo criado [${newProjectId.slice(0, 8)}...]`)
      addLog(`Enviando ${total} documento(s) para armazenamento...`)

      const uploadFormData = new FormData()
      uploadFormData.append('project_id', newProjectId)
      uploadFormData.append('firm_id', firmId)
      uploadFormData.append('doc_source', 'parte_autora')
      taggedFiles.forEach((tf, i) => {
        uploadFormData.append(`file_${i}`, tf.file)
        uploadFormData.append(`category_${i}`, tf.category)
        uploadFormData.append(`doc_source_${i}`, 'parte_autora')
      })

      const uploadRes = await fetch('/api/upload-documents', { method: 'POST', body: uploadFormData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.documents) throw new Error(uploadData.error || 'Falha no upload de documentos')
      addLog(`✓ ${total} documento(s) enviados com sucesso`)

      const uploadedDocs = uploadData.documents as { field: string; document_id: string; name: string; document_category: string }[]
      setExtractions(prev => prev.map(e => {
        const match = uploadedDocs.find(d => d.name === e.fileName)
        return match ? { ...e, documentId: match.document_id } : e
      }))

      const peticaoTagged = taggedFiles.find(f => f.category === 'Petição Inicial')!
      const peticaoUploaded = uploadedDocs.find(d => d.document_category === 'Petição Inicial')!

      addLog(`Extraindo petição inicial: ${peticaoTagged.file.name}...`)
      setExtractions(prev => prev.map(e => e.taggedFileId === peticaoTagged.id ? { ...e, status: 'processing' } : e))

      let peticaoExtracted: PeticaoExtracted | null = null
      try {
        const peticaoFd = new FormData()
        peticaoFd.append('file', peticaoTagged.file)
        peticaoFd.append('document_category', 'Petição Inicial')
        const pRes = await fetch('/api/extract-pdf', { method: 'POST', body: peticaoFd })
        const pData = await pRes.json()
        if (!pRes.ok || !pData.extracted) throw new Error(pData.error || 'Falha na extração')
        peticaoExtracted = pData.extracted as PeticaoExtracted
        await fetch('/api/save-extraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: peticaoUploaded.document_id, project_id: newProjectId, document_category: 'Petição Inicial', extracted: peticaoExtracted, is_peticao: true }) })
        setExtractions(prev => prev.map(e => e.taggedFileId === peticaoTagged.id ? { ...e, status: 'done', extracted: peticaoExtracted!, documentId: peticaoUploaded.document_id } : e))
        addLog(`✓ Petição inicial extraída — ${peticaoExtracted.tipo_acao || 'Tipo identificado'}`)
        if (peticaoExtracted.nome_processo) addLog(`  Processo: ${peticaoExtracted.nome_processo}`)
        if (peticaoExtracted.numero_processo) addLog(`  CNJ: ${peticaoExtracted.numero_processo}`)
        const autorNome = typeof peticaoExtracted.autor === 'object' ? peticaoExtracted.autor?.nome : peticaoExtracted.autor
        if (autorNome) addLog(`  Autor: ${autorNome}`)
        setPeticaoData(peticaoExtracted)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro na extração da petição'
        setExtractions(prev => prev.map(e => e.taggedFileId === peticaoTagged.id ? { ...e, status: 'error', error: msg } : e))
        addLog(`✗ Erro na petição inicial: ${msg}`)
      }

      setOverallProgress(Math.round((1 / total) * 100))
      const supportingFiles = taggedFiles.filter(f => f.category !== 'Petição Inicial')

      if (supportingFiles.length > 0) {
        addLog(`Iniciando extração paralela de ${supportingFiles.length} documento(s) de suporte...`)
        setExtractions(prev => prev.map(e => supportingFiles.some(sf => sf.id === e.taggedFileId) ? { ...e, status: 'processing' } : e))
        const totalDone = { count: 1 }
        await Promise.all(supportingFiles.map(async (sf, sfIdx) => {
          const uploaded = uploadedDocs.find(d => d.name === sf.file.name)
          if (!uploaded) return
          try {
            const fd = new FormData()
            fd.append('file', sf.file)
            fd.append('document_category', sf.category)
            const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok || !data.extracted) throw new Error(data.error || 'Falha na extração')
            const extracted = data.extracted as SupportingExtracted
            await fetch('/api/save-extraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: uploaded.document_id, project_id: newProjectId, document_category: sf.category, extracted, is_peticao: false }) })
            setExtractions(prev => prev.map(e => e.taggedFileId === sf.id ? { ...e, status: 'done', extracted, documentId: uploaded.document_id } : e))
            totalDone.count++
            addLog(`✓ ${sf.category} extraído (${totalDone.count}/${total}): ${sf.file.name}`)
            setOverallProgress(Math.round((totalDone.count / total) * 100))
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro'
            setExtractions(prev => prev.map(e => e.taggedFileId === sf.id ? { ...e, status: 'error', error: msg } : e))
            totalDone.count++
            addLog(`✗ Erro em ${sf.file.name} (${sfIdx + 2}/${total}): ${msg}`)
            setOverallProgress(Math.round((totalDone.count / total) * 100))
          }
        }))
      }

      setOverallProgress(100)
      addLog('▸ Extração completa. Gerando análise executiva...')

      setExtractions(prev => {
        setAllExtractions(prev)
        return prev
      })

      await new Promise(r => setTimeout(r, 800))
      setStep(3)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setGlobalError(msg)
      addLog(`✗ Erro crítico: ${msg}`)
    }
  }, [firmId, selectedClient, taggedFiles, clients])

  /* ── Case analysis (Step 3) ──────────────────────────────── */
  const runCaseAnalysis = useCallback(async () => {
    if (!projectId) return
    setCaseAnalysisLoading(true)
    setCaseAnalysisError(null)

    try {
      const peticaoExt = allExtractions.find(e => e.category === 'Petição Inicial')?.extracted as PeticaoExtracted | undefined
      const supportingDocsPayload = allExtractions
        .filter(e => e.status === 'done' && e.category !== 'Petição Inicial')
        .map(e => ({ fileName: e.fileName, category: e.category as string, extracted: (e.extracted || {}) as Record<string, unknown> }))

      const res = await fetch('/api/analyze-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          peticao_extracted: (peticaoExt || {}) as Record<string, unknown>,
          supporting_docs: supportingDocsPayload,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.analysis) throw new Error(data.error || 'Falha na análise executiva')
      setCaseAnalysis(data.analysis as CaseAnalysis)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setCaseAnalysisError(msg)
    } finally {
      setCaseAnalysisLoading(false)
    }
  }, [projectId, firmId, allExtractions])

  /* ── Export report (Step 3) ──────────────────────────────── */
  const exportRelatorio = useCallback(() => {
    if (!caseAnalysis) return

    const clientName = clients.find(c => c.id === selectedClient)?.name || ''
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR')
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const caseRef = caseAnalysis.dados_processo?.numero_cnj || peticaoData?.numero_processo || 'Processo não identificado'

    const field = (label: string, value: string | undefined | null) =>
      value && value !== 'Não identificado' && value !== ''
        ? `<div class="field"><div class="label">${label}</div><div class="value">${value}</div></div>`
        : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório — ${caseRef}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 13px; }
  .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 28px; }
  .header h1 { font-size: 18px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
  .header p { font-size: 11px; color: #555; margin-top: 6px; font-family: monospace; }
  h2 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #888; margin: 28px 0 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
  .field { margin-bottom: 8px; }
  .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
  .value { font-size: 13px; color: #1a1a1a; font-weight: 500; margin-top: 2px; }
  .card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px 16px; margin-bottom: 10px; }
  .card-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 10px; font-family: monospace; }
  .prose { font-size: 13px; color: #333; line-height: 1.7; margin-bottom: 10px; }
  ul { padding-left: 18px; margin-top: 6px; }
  li { font-size: 12px; color: #444; margin-bottom: 5px; line-height: 1.5; }
  ol { padding-left: 20px; counter-reset: item; }
  ol li { font-size: 12px; color: #444; margin-bottom: 6px; line-height: 1.5; }
  .row-value { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f5f5f5; }
  .row-value:last-child { border-bottom: none; }
  .row-label { font-size: 12px; color: #666; }
  .row-amount { font-size: 13px; font-weight: 700; font-family: monospace; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; font-family: monospace; letter-spacing: 0.05em; margin-right: 8px; }
  .badge-alta { background: #fee2e2; color: #dc2626; }
  .badge-media { background: #fef3c7; color: #d97706; }
  .badge-baixa { background: #f3f4f6; color: #6b7280; }
  .proof-card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; margin-bottom: 8px; }
  .proof-doc { font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
  .proof-type { font-size: 10px; color: #888; font-family: monospace; margin-bottom: 6px; }
  .proof-relevancia { font-size: 11px; color: #2563eb; margin-top: 6px; }
  .timeline-item { display: flex; gap: 14px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
  .timeline-item:last-child { border-bottom: none; }
  .timeline-date { font-size: 10px; font-family: monospace; color: #2563eb; font-weight: 600; min-width: 120px; padding-top: 1px; }
  .timeline-event { font-size: 12px; color: #333; line-height: 1.5; }
  .prazo-row { display: flex; gap: 14px; align-items: flex-start; padding: 10px 12px; background: #fff5f5; border-radius: 6px; margin-top: 10px; border: 1px solid #fecaca; }
  .prazo-label { font-size: 10px; font-family: monospace; color: #dc2626; font-weight: 700; min-width: 120px; }
  .prazo-value { font-size: 12px; color: #dc2626; font-weight: 600; }
  .doc-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
  .doc-item:last-child { border-bottom: none; }
  .footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; font-family: monospace; letter-spacing: 0.05em; }
  @media print { body { padding: 20px; } h2 { margin: 20px 0 8px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>LITIGATOR AI — RELATÓRIO DE ANÁLISE INICIAL</h1>
    <p>Processo: ${caseRef} &nbsp;|&nbsp; Cliente: ${clientName} &nbsp;|&nbsp; Gerado em: ${dateStr}</p>
  </div>

  <h2>DADOS DO PROCESSO</h2>
  <div class="grid-2">
    ${field('Número CNJ', caseAnalysis.dados_processo?.numero_cnj)}
    ${field('Juiz(a)', caseAnalysis.dados_processo?.juiz)}
    ${field('Comarca', caseAnalysis.dados_processo?.comarca)}
    ${field('Vara', caseAnalysis.dados_processo?.vara)}
    ${field('Localização', caseAnalysis.dados_processo?.localizacao)}
    ${field('Data de Distribuição', caseAnalysis.dados_processo?.data_distribuicao)}
  </div>

  <h2>PARTES</h2>
  ${(() => {
    const renderParte = (parte: typeof caseAnalysis.partes.autor | null, titulo: string, fallbackNome?: string) => {
      if (!parte && !fallbackNome) return `<div class="card"><div class="card-header">${titulo}</div><div class="prose" style="color:#aaa;font-style:italic">Não identificado</div></div>`
      const p = parte || { nome: fallbackNome || '', cpf_cnpj: '', rg: '', nacionalidade: '', estado_civil: '', profissao: '', data_nascimento: '', email: '', endereco: null, telefone: '', outras_info: '', advogados: [] }
      const enderecoStr = p.endereco
        ? [p.endereco.rua, p.endereco.numero, p.endereco.bairro, p.endereco.cidade, p.endereco.estado, p.endereco.cep].filter(Boolean).join(', ')
        : (p as unknown as { endereco_completo?: string }).endereco_completo || ''
      const advCards = (p.advogados || []).map((a, idx) => `
        <div style="border:1px solid #e5e5e5;border-radius:4px;padding:10px 12px;margin-top:10px">
          <div class="card-header">ADVOGADO(A) ${idx + 1}</div>
          <div class="grid-2">
            ${field('Nome', a.nome)}
            ${field('OAB / Seccional', [a.oab, a.seccional].filter(Boolean).join(' — '))}
            ${field('Escritório', a.escritorio)}
            ${field('Endereço', a.endereco)}
            ${field('E-mail', a.email)}
            ${field('Telefone', a.telefone)}
          </div>
        </div>`).join('')
      return `
        <div class="card">
          <div class="card-header">${titulo}</div>
          <div class="grid-2">
            ${field('Nome', p.nome || fallbackNome)}
            ${field('CPF / CNPJ', p.cpf_cnpj)}
            ${field('RG', p.rg)}
            ${field('Nacionalidade', p.nacionalidade)}
            ${field('Estado Civil', p.estado_civil)}
            ${field('Profissão', p.profissao)}
            ${field('Data de Nascimento', p.data_nascimento)}
            ${field('E-mail', p.email)}
            ${field('Telefone', p.telefone)}
          </div>
          ${enderecoStr ? `<div class="field" style="margin-top:4px"><div class="label">Endereço Completo</div><div class="value">${enderecoStr}</div></div>` : ''}
          ${field('Outras Informações', p.outras_info)}
          ${advCards}
        </div>`
    }
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">
      ${renderParte(caseAnalysis.partes?.autor || null, 'PARTE AUTORA')}
      ${renderParte(caseAnalysis.partes?.reu || null, 'RÉU — NOSSO CLIENTE', clientName)}
    </div>`
  })()}

  <h2>OBJETO DA AÇÃO</h2>
  ${caseAnalysis.objeto_da_acao ? `
  <div class="card">
    <div style="margin-bottom:10px">
      <span class="badge badge-alta" style="background:#dbeafe;color:#1d4ed8;border:none">${caseAnalysis.objeto_da_acao.tipo || 'Não identificado'}</span>
    </div>
    <div class="prose">${caseAnalysis.objeto_da_acao.descricao || ''}</div>
    ${(caseAnalysis.objeto_da_acao.detalhes || []).length > 0 ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      ${(caseAnalysis.objeto_da_acao.detalhes || []).map(d => `
      <div class="field"><div class="label">${d.campo}</div><div class="value">${d.valor}</div></div>`).join('')}
    </div>` : ''}
  </div>` : '<div class="card"><div class="prose" style="color:#aaa;font-style:italic">Não identificado</div></div>'}

  <h2>VALORES ENVOLVIDOS</h2>
  <div class="card">
    ${(caseAnalysis.valores?.itens || []).filter(it => it.valor && it.valor !== 'Não identificado' && it.valor !== '')
      .map(it => `<div class="row-value"><span class="row-label"><strong>${it.descricao}</strong>${it.fundamento ? `<br><span style="font-size:10px;color:#888">${it.fundamento}</span>` : ''}</span><span class="row-amount">${it.valor}</span></div>`).join('')}
    ${caseAnalysis.valores?.total && caseAnalysis.valores.total !== 'Não identificado' && caseAnalysis.valores.total !== ''
      ? `<div class="row-value" style="font-weight:700;background:#fef3c7;padding:8px 10px;border-radius:6px;margin-top:6px"><span class="row-label">TOTAL PLEITEADO</span><span class="row-amount" style="color:#d97706">${caseAnalysis.valores.total}</span></div>`
      : ''}
  </div>

  <h2>ALEGAÇÃO PRINCIPAL</h2>
  <div class="card">
    <div class="prose">${(caseAnalysis.alegacao_principal || '—').replace(/\n/g, '<br>')}</div>
    ${(caseAnalysis.fatos_narrados || []).length > 0 ? `
    <div class="card-header" style="margin-top:12px">FATOS NARRADOS PELO AUTOR</div>
    <ul>${(caseAnalysis.fatos_narrados || []).map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
  </div>

  <h2>FUNDAMENTO JURÍDICO</h2>
  <div class="card">
    ${(caseAnalysis.fundamento_juridico?.base_legal || []).length > 0 ? `
    <div class="card-header">BASE LEGAL</div>
    <ul>${(caseAnalysis.fundamento_juridico?.base_legal || []).map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
    ${(caseAnalysis.fundamento_juridico?.teses || []).length > 0 ? `
    <div class="card-header" style="margin-top:14px">TESES DO AUTOR</div>
    <ul>${(caseAnalysis.fundamento_juridico?.teses || []).map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    ${(caseAnalysis.fundamento_juridico?.pedidos || []).length > 0 ? `
    <div class="card-header" style="margin-top:14px">PEDIDOS AO JUIZ</div>
    <ol>${(caseAnalysis.fundamento_juridico?.pedidos || []).map(p => `<li>${p}</li>`).join('')}</ol>` : ''}
  </div>

  <h2>PROVAS FORNECIDAS</h2>
  ${(caseAnalysis.provas_fornecidas || []).map(p => `
  <div class="proof-card">
    <div class="proof-doc">📄 ${p.documento}</div>
    <div class="proof-type">${p.tipo}</div>
    <div class="prose">${p.resumo}</div>
    ${p.conteudo_principal ? `<div style="margin-top:6px;font-size:11px;color:#444;line-height:1.5"><strong>Conteúdo:</strong> ${p.conteudo_principal}</div>` : ''}
    ${p.como_autor_usa ? `<div style="margin-top:6px;font-size:11px;color:#1d4ed8;line-height:1.5"><strong>Como o autor usa:</strong> ${p.como_autor_usa}</div>` : ''}
    ${p.tese_que_embasa ? `<div class="proof-relevancia">→ ${p.tese_que_embasa}</div>` : ''}
    ${p.pontos_de_atencao ? `<div style="margin-top:6px;font-size:11px;color:#d97706;background:#fef3c7;padding:6px 8px;border-radius:4px;line-height:1.5">⚠ ${p.pontos_de_atencao}</div>` : ''}
  </div>`).join('')}

  <h2>DATAS IMPORTANTES</h2>
  <div class="card">
    ${(caseAnalysis.datas_importantes || []).map(d => `
    <div class="timeline-item">
      <div class="timeline-date">${d.data}</div>
      <div class="timeline-event">${d.evento}</div>
    </div>`).join('')}
    ${caseAnalysis.prazo_contestacao ? `
    <div class="prazo-row">
      <div class="prazo-label">⚠ PRAZO CONTESTAÇÃO</div>
      <div class="prazo-value">${caseAnalysis.prazo_contestacao}</div>
    </div>` : ''}
  </div>

  <h2>DOCUMENTOS NECESSÁRIOS DO CLIENTE</h2>
  <div class="card">
    ${(caseAnalysis.documentos_necessarios_cliente || []).map(d => `
    <div class="doc-item">
      <span class="badge badge-${d.prioridade}">${d.prioridade}</span>
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:3px">${d.documento}</div>
        <div style="font-size:11px;color:#666;line-height:1.5">${d.motivo}</div>
      </div>
    </div>`).join('')}
  </div>

  ${caseAnalysis.checklist_documentos ? buildChecklistSectionHTML(caseAnalysis.checklist_documentos) : ''}

  <div class="footer">Gerado por Litigator AI em ${dateStr} às ${timeStr}</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    }
  }, [caseAnalysis, peticaoData, clients, selectedClient])

  /* ── Save and wait for documents ─────────────────────────── */
  const handleSaveAndWait = useCallback(async () => {
    if (!projectId || !firmId) return
    setIsSavingAndWaiting(true)
    try {
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'aguardando_documentos', updated_at: new Date().toISOString() })
        .eq('id', projectId)

      // Persist Phase 1 analysis so it can be loaded when the lawyer resumes
      if (caseAnalysis) {
        // Remove any existing analise_inicial record for this project
        await supabase
          .from('case_strategies')
          .delete()
          .eq('project_id', projectId)
          .eq('status', 'analise_inicial')

        await supabase.from('case_strategies').insert({
          project_id: projectId,
          firm_id: firmId,
          status: 'analise_inicial',
          draft_tipo: 'analise_inicial',
          draft_peca: JSON.stringify({ caseAnalysis, peticaoData }),
          tese_principal: 'Análise inicial completa — aguardando documentos do cliente',
          teses_subsidiarias: [],
          jurisprudencia_favoravel: [],
          jurisprudencia_desfavoravel: [],
          risco_estimado: caseAnalysis.risco_preliminar || 'medio',
          recomendacao: 'Aguardando documentos do cliente',
        })
      }

      setToast('Processo salvo — aguardando documentos do cliente.')
      setTimeout(() => {
        setToast(null)
        onSuccess()
        onClose()
      }, 2000)
    } catch (err) {
      console.error('save-and-wait error:', err)
    } finally {
      setIsSavingAndWaiting(false)
    }
  }, [projectId, firmId, caseAnalysis, peticaoData, onSuccess, onClose])

  /* ── Client document extraction flow (Step 4) ───────────── */
  const runClientExtraction = useCallback(async () => {
    if (!firmId || !projectId || clientTaggedFiles.length === 0) return

    setClientExtractionsDone(false)
    setClientGlobalError(null)
    setClientLogLines([])
    setClientProgress(0)

    const total = clientTaggedFiles.length
    const initialExtractions: FileExtractionResult[] = clientTaggedFiles.map(tf => ({
      taggedFileId: tf.id, fileName: tf.file.name, category: tf.category, status: 'pending',
    }))
    setClientExtractions(initialExtractions)

    try {
      // Upload client docs
      addClientLog(`Enviando ${total} documento(s) do cliente...`)
      const uploadFd = new FormData()
      uploadFd.append('project_id', projectId)
      uploadFd.append('firm_id', firmId)
      uploadFd.append('doc_source', 'cliente')
      clientTaggedFiles.forEach((tf, i) => {
        uploadFd.append(`file_${i}`, tf.file)
        uploadFd.append(`category_${i}`, tf.category)
        uploadFd.append(`doc_source_${i}`, 'cliente')
      })
      const uploadRes = await fetch('/api/upload-documents', { method: 'POST', body: uploadFd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.documents) throw new Error(uploadData.error || 'Falha no upload')
      addClientLog(`✓ ${total} documento(s) enviados`)

      const uploadedDocs = uploadData.documents as { field: string; document_id: string; name: string; document_category: string }[]

      setClientExtractions(prev => prev.map(e => {
        const match = uploadedDocs.find(d => d.name === e.fileName)
        return match ? { ...e, documentId: match.document_id } : e
      }))

      // Extract all in parallel
      addClientLog(`Iniciando extração de ${total} documento(s) do cliente...`)
      setClientExtractions(prev => prev.map(e => ({ ...e, status: 'processing' })))

      const totalDone = { count: 0 }
      await Promise.all(clientTaggedFiles.map(async (tf) => {
        const uploaded = uploadedDocs.find(d => d.name === tf.file.name)
        if (!uploaded) return
        try {
          const fd = new FormData()
          fd.append('file', tf.file)
          fd.append('document_category', tf.category)
          const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok || !data.extracted) throw new Error(data.error || 'Falha na extração')
          const extracted = data.extracted as SupportingExtracted
          await fetch('/api/save-extraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: uploaded.document_id, project_id: projectId, document_category: tf.category, extracted, is_peticao: false }) })
          setClientExtractions(prev => prev.map(e => e.taggedFileId === tf.id ? { ...e, status: 'done', extracted, documentId: uploaded.document_id } : e))
          totalDone.count++
          addClientLog(`✓ Extraído: ${tf.file.name} (${totalDone.count}/${total})`)
          setClientProgress(Math.round((totalDone.count / total) * 100))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro'
          setClientExtractions(prev => prev.map(e => e.taggedFileId === tf.id ? { ...e, status: 'error', error: msg } : e))
          totalDone.count++
          addClientLog(`✗ Erro em ${tf.file.name}: ${msg}`)
          setClientProgress(Math.round((totalDone.count / total) * 100))
        }
      }))

      setClientProgress(100)
      addClientLog('▸ Documentos do cliente extraídos. Iniciando análise cruzada...')
      setClientExtractionsDone(true)
      await new Promise(r => setTimeout(r, 800))
      setStep(5)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setClientGlobalError(msg)
      addClientLog(`✗ Erro crítico: ${msg}`)
    }
  }, [firmId, projectId, clientTaggedFiles])

  /* ── Build supporting summaries (shared helper) ──────────── */
  function buildSupportingSummaries(extracts: FileExtractionResult[]): string[] {
    return extracts
      .filter(e => e.status === 'done' && e.category !== 'Petição Inicial')
      .map(e => {
        const sup = e.extracted as SupportingExtracted
        return sup?.summary ? `[${e.category}] ${sup.summary}` : null
      })
      .filter(Boolean) as string[]
  }

  function buildClientDocSummaries(): string[] {
    return clientExtractions
      .filter(e => e.status === 'done')
      .map(e => {
        const sup = e.extracted as SupportingExtracted
        return sup?.summary ? `[${e.category}] ${sup.summary}` : null
      })
      .filter(Boolean) as string[]
  }

  function buildCrossRefNotes(): string {
    if (clientExtractions.filter(e => e.status === 'done').length === 0) return ''
    const plaintiffDocs = allExtractions.filter(e => e.status === 'done').map(e => `${e.category}: ${(e.extracted as SupportingExtracted)?.summary || ''}`)
    const clientDocs = clientExtractions.filter(e => e.status === 'done').map(e => `${e.category}: ${(e.extracted as SupportingExtracted)?.summary || ''}`)
    return `Docs da parte autora: ${plaintiffDocs.join('; ')} | Docs do réu: ${clientDocs.join('; ')}`
  }

  /* ── Research + Strategy flow (Step 5) ──────────────────── */
  const runResearch = useCallback(async () => {
    if (!firmId || !projectId || !peticaoData) return

    setResearchError(null)
    setResearchLogLines([])
    setResearchDone(false)

    const RESEARCH_LOADING_STEPS = [
      'Analisando contexto completo do caso...',
      'Consultando STJ — Superior Tribunal de Justiça...',
      'Consultando STF — Supremo Tribunal Federal...',
      'Pesquisando jurisprudência complementar...',
      'Aguardando resultados das fontes oficiais...',
    ]

    const supportingSummaries = buildSupportingSummaries(allExtractions)
    const clientDocSummaries = buildClientDocSummaries()
    const crossReferenceNotes = buildCrossRefNotes()

    const logPromise = (async () => {
      for (const step_text of RESEARCH_LOADING_STEPS) {
        addResearchLog(step_text)
        await new Promise(r => setTimeout(r, 2500))
      }
    })()

    const peticaoAutorNome = typeof peticaoData.autor === 'object' ? peticaoData.autor?.nome : peticaoData.autor
    const peticaoReuNome = typeof peticaoData.reu === 'object' ? peticaoData.reu?.nome : peticaoData.reu

    const apiPromise = fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        firm_id: firmId,
        case_context: {
          tipo_acao: peticaoData.tipo_acao,
          autor: peticaoAutorNome,
          reu: peticaoReuNome,
          vara: peticaoData.vara,
          comarca: peticaoData.comarca,
          valor_causa: peticaoData.valor_causa,
          pedidos: peticaoData.pedidos,
          area: peticaoData.area,
          supporting_summaries: supportingSummaries,
          client_doc_summaries: clientDocSummaries,
          cross_reference_notes: crossReferenceNotes || undefined,
        },
      }),
    })

    const [, researchRes] = await Promise.all([logPromise, apiPromise])
    const researchJson = await researchRes.json()

    if (!researchRes.ok || !researchJson.results) {
      setResearchError(researchJson.error || 'Falha na pesquisa jurisprudencial')
      addResearchLog(`✗ Erro na pesquisa: ${researchJson.error || 'Falha desconhecida'}`)
      return
    }

    const results = researchJson.results as ResearchResults
    setResearchResults(results)

    if (Array.isArray(researchJson.source_logs)) {
      for (const logLine of researchJson.source_logs as string[]) {
        addResearchLog(logLine)
        await new Promise(r => setTimeout(r, 300))
      }
    }

    addResearchLog('Elaborando estratégia de defesa...')
    await new Promise(r => setTimeout(r, 600))
    addResearchLog('Gerando minuta da contestação...')

    setStrategyLoading(true)
    try {
      const stratAutorNome = typeof peticaoData.autor === 'object' ? peticaoData.autor?.nome : peticaoData.autor
      const stratReuNome = typeof peticaoData.reu === 'object' ? peticaoData.reu?.nome : peticaoData.reu
      const stratRes = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          case_context: {
            tipo_acao: peticaoData.tipo_acao,
            autor: stratAutorNome,
            reu: stratReuNome,
            vara: peticaoData.vara,
            comarca: peticaoData.comarca,
            valor_causa: peticaoData.valor_causa,
            pedidos: peticaoData.pedidos,
            area: peticaoData.area,
            numero_processo: peticaoData.numero_processo,
            nome_processo: peticaoData.nome_processo,
            supporting_summaries: supportingSummaries,
            client_doc_summaries: clientDocSummaries,
            cross_reference_notes: crossReferenceNotes || undefined,
          },
          research_results: results,
        }),
      })

      const stratJson = await stratRes.json()
      if (!stratRes.ok || !stratJson.strategy) {
        setStrategyError(stratJson.error || 'Falha na geração de estratégia')
        addResearchLog(`✗ Erro na estratégia: ${stratJson.error || 'Falha desconhecida'}`)
        return
      }

      setStrategyData(stratJson.strategy)
      addResearchLog('▸ Análise concluída.')
      await new Promise(r => setTimeout(r, 400))
      setResearchDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setStrategyError(msg)
      addResearchLog(`✗ Erro: ${msg}`)
    } finally {
      setStrategyLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId, projectId, peticaoData, allExtractions, clientExtractions])

  /* ── Re-generate strategy ────────────────────────────────── */
  const regenerateStrategy = useCallback(async () => {
    if (!firmId || !projectId || !researchResults || !peticaoData) return
    setStrategyLoading(true)
    setStrategyError(null)
    const supportingSummaries = buildSupportingSummaries(allExtractions)
    const clientDocSummaries = buildClientDocSummaries()
    const crossReferenceNotes = buildCrossRefNotes()
    const regenAutorNome = typeof peticaoData.autor === 'object' ? peticaoData.autor?.nome : peticaoData.autor
    const regenReuNome = typeof peticaoData.reu === 'object' ? peticaoData.reu?.nome : peticaoData.reu
    try {
      const stratRes = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          case_context: {
            tipo_acao: peticaoData.tipo_acao,
            autor: regenAutorNome,
            reu: regenReuNome,
            vara: peticaoData.vara,
            comarca: peticaoData.comarca,
            valor_causa: peticaoData.valor_causa,
            pedidos: peticaoData.pedidos,
            area: peticaoData.area,
            numero_processo: peticaoData.numero_processo,
            nome_processo: peticaoData.nome_processo,
            supporting_summaries: supportingSummaries,
            client_doc_summaries: clientDocSummaries,
            cross_reference_notes: crossReferenceNotes || undefined,
          },
          research_results: researchResults,
          lawyer_feedback: adjustFeedback,
        }),
      })
      const stratJson = await stratRes.json()
      if (!stratRes.ok || !stratJson.strategy) {
        setStrategyError(stratJson.error || 'Falha ao regenerar estratégia')
        return
      }
      setStrategyData(stratJson.strategy)
      setShowAdjustInput(false)
      setAdjustFeedback('')
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setStrategyLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId, projectId, researchResults, peticaoData, allExtractions, clientExtractions, adjustFeedback])

  /* ── Save approved strategy ──────────────────────────────── */
  const handleApproveAndSave = useCallback(async () => {
    if (!firmId || !projectId || !strategyData) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/strategy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, firm_id: firmId, ...strategyData }),
      })
      const json = await res.json()
      if (!res.ok) { setStrategyError(json.error || 'Falha ao salvar'); return }
      setToast('Estratégia e minuta aprovadas e salvas com sucesso!')
      setTimeout(() => { setToast(null); onSuccess(); onClose() }, 2000)
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsSaving(false)
    }
  }, [firmId, projectId, strategyData, onSuccess, onClose])

  /* ── Risk flag helpers ───────────────────────────────────── */
  function getAllKeyDates() {
    const dates: { date: string | null; description: string; source: string }[] = []
    allExtractions.forEach(e => {
      if (e.status !== 'done' || !e.extracted) return
      const ext = e.extracted as SupportingExtracted
      if (ext.key_dates) ext.key_dates.forEach(d => dates.push({ ...d, source: e.fileName }))
    })
    return dates
  }

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || ''
  const modalWidth = step === 5 && strategyData
    ? 'min(1120px, calc(100vw - 32px))'
    : 'min(700px, calc(100vw - 32px))'

  if (!open) return null

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, animation: 'fadeIn 150ms ease' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: modalWidth, maxHeight: 'calc(100vh - 48px)',
        overflowY: (step === 5 && strategyData) ? 'hidden' : 'auto',
        borderRadius: '14px', background: C.bg1,
        border: `1px solid ${C.border2}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        zIndex: 1001, animation: 'slideUp 200ms ease',
        transition: 'width 400ms ease',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: C.text1, letterSpacing: '-0.01em' }}>Novo Processo</h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.text3, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              {step === 1 && 'Etapa 1 de 5 — Upload de documentos do processo'}
              {step === 2 && 'Etapa 2 de 5 — Extração AI em andamento'}
              {step === 3 && 'Etapa 3 de 5 — Resumo executivo + documentos necessários'}
              {step === 4 && !resumeProject && 'Etapa 4 de 5 — Upload dos documentos do cliente'}
              {step === 4 && resumeProject && '📎 Continuar análise — Upload dos documentos do cliente'}
              {step === 5 && 'Etapa 5 de 5 — Pesquisa + Estratégia de Defesa'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.color = C.text1 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ height: '1px', background: C.border1, margin: '16px 0', flexShrink: 0 }} />

        {/* Body */}
        <div style={{
          padding: (step === 5 && strategyData) ? '0 24px' : '0 24px 24px',
          flex: 1,
          overflowY: (step === 5 && strategyData) ? 'hidden' : 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flexShrink: 0 }}>
            <StepIndicator step={step} C={C} />
          </div>

          {/* ══ STEP 1: Upload ════════════════════════════════ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Client selector */}
              <div>
                <div style={{ fontSize: '11px', color: C.text2, fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>1</span>
                  Selecione o cliente
                </div>
                {clients.length === 0 ? (
                  <div style={{ padding: '16px', borderRadius: '8px', background: C.bg2, border: `1px dashed ${C.border2}`, textAlign: 'center', color: C.text3, fontSize: '12px' }}>
                    Nenhum cliente cadastrado. Crie um cliente primeiro.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {clients.map(c => {
                      const ac = avatarColor(c.name)
                      const isSelected = selectedClient === c.id
                      return (
                        <button key={c.id} onClick={() => setSelectedClient(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: isSelected ? C.amberBg : C.bg2, border: `2px solid ${isSelected ? C.amber : C.border1}`, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 150ms ease' }}>
                          <span style={{ width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0, background: ac + '25', border: `1px solid ${ac}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: ac, fontFamily: 'var(--font-mono)' }}>
                            {getInitials(c.name)}
                          </span>
                          <span style={{ fontSize: '12px', color: isSelected ? C.amber : C.text1, fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                          {isSelected && <CheckCircle2 size={14} style={{ color: C.amber, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Drop zone */}
              <div>
                <div style={{ fontSize: '11px', color: C.text2, fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>2</span>
                  Adicione os documentos do processo (PDFs)
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.border2}`, borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? C.amberBg : taggedFiles.length > 0 ? C.greenBg : C.bg2, transition: 'all 200ms ease' }}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Upload size={24} style={{ color: dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.text3 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.text2 }}>
                        {taggedFiles.length > 0 ? `${taggedFiles.length} arquivo(s) — clique para adicionar mais` : 'Arraste PDFs aqui ou clique para selecionar'}
                      </div>
                      <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
                        Aceita múltiplos PDFs — petição inicial + documentos da parte autora
                      </div>
                    </div>
                  </div>
                </div>

                {taggedFiles.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '9px 14px', borderRadius: '8px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: C.amber, fontWeight: 600 }}>
                      <span style={{ fontSize: '14px' }}>⚖️</span>
                      Selecione qual documento é a <strong style={{ fontFamily: 'var(--font-mono)' }}>Petição Inicial</strong>
                      {hasPeticao && <span style={{ marginLeft: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)', color: C.green, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Marcada</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                      {taggedFiles.map(tf => {
                        const showSuggestion = tf.suggested && tf.category !== 'Petição Inicial'
                        return (
                          <div key={tf.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: tf.category === 'Petição Inicial' ? C.amberBg : C.bg2, border: `1px solid ${tf.category === 'Petição Inicial' ? C.amberBorder : showSuggestion ? C.amberBorder + '80' : C.border1}`, transition: 'all 150ms ease' }}>
                            <FileText size={14} style={{ color: tf.category === 'Petição Inicial' ? C.amber : C.text3, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tf.file.name}</div>
                              <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)' }}>{(tf.file.size / 1024).toFixed(0)} KB</div>
                            </div>
                            {showSuggestion && (
                              <button onClick={() => handleCategoryChange(tf.id, 'Petição Inicial')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', background: C.amberBg, border: `1px solid ${C.amber}`, color: C.amber, fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, letterSpacing: '0.02em', animation: 'pulse 2s ease-in-out infinite' }}>
                                ✦ Sugestão: Petição Inicial?
                              </button>
                            )}
                            <CategoryDropdown
                              value={tf.category}
                              onChange={v => handleCategoryChange(tf.id, v as DocumentCategory)}
                              highlighted={showSuggestion}
                              options={DOCUMENT_CATEGORIES}
                              C={C}
                            />
                            <button onClick={() => removeFile(tf.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {taggedFiles.length > 0 && !hasPeticao && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={12} /> Marque um documento como "Petição Inicial" antes de continuar
                  </div>
                )}
              </div>

              <button
                disabled={!canProceed}
                onClick={runExtraction}
                style={{ width: '100%', padding: '13px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: canProceed ? 'pointer' : 'not-allowed', border: `1px solid ${canProceed ? C.amber : C.border1}`, background: canProceed ? C.amber : C.bg3, color: canProceed ? '#fff' : C.text4, transition: 'all 200ms ease', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
              >
                {canProceed ? `Enviar ${taggedFiles.length} documento${taggedFiles.length > 1 ? 's' : ''} para Análise →` : !selectedClient ? 'Selecione o cliente primeiro' : taggedFiles.length === 0 ? 'Adicione ao menos um PDF' : 'Marque a Petição Inicial'}
              </button>
            </div>
          )}

          {/* ══ STEP 2: Extraction log ════════════════════════ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0 8px' }}>
              {globalError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                  <AlertCircle size={48} style={{ color: C.red }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>Falha na extração</div>
                    <div style={{ fontSize: '12px', color: C.text3 }}>{globalError}</div>
                  </div>
                  <button onClick={() => { setStep(1); setGlobalError(null) }} style={{ padding: '10px 24px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', fontSize: '13px' }}>
                    ← Voltar
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.text1, lineHeight: 1.5 }}>
                      Processando <strong style={{ color: C.amber }}>{taggedFiles.length} documento(s)</strong>
                    </div>
                    {selectedClientName && <div style={{ fontSize: '11px', color: C.text3, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{selectedClientName}</div>}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progresso geral</span>
                      <span style={{ fontSize: '11px', color: C.amber, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{overallProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: C.bg3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${overallProgress}%`, borderRadius: '3px', background: `linear-gradient(90deg, ${C.amber}cc, ${C.amber})`, transition: 'width 400ms ease', boxShadow: `0 0 8px ${C.amber}66` }} />
                    </div>
                    <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                      {extractions.filter(e => e.status === 'done' || e.status === 'error').length} de {taggedFiles.length} documentos concluídos
                    </div>
                  </div>
                  <div style={{ borderRadius: '8px', background: C.bg2, border: `1px solid ${C.border1}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Status por documento</div>
                    {extractions.map(e => (
                      <div key={e.taggedFileId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: `1px solid ${C.border1}` }}>
                        <FileStatusIcon status={e.status} C={C} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.fileName}</div>
                          {e.error && <div style={{ fontSize: '10px', color: C.red, marginTop: '1px' }}>{e.error}</div>}
                        </div>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: e.status === 'done' ? C.green : e.status === 'error' ? C.red : e.status === 'processing' ? C.amber : C.text4, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{e.category}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: '8px', background: C.bg0, border: `1px solid ${C.border1}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: overallProgress === 100 ? C.green : C.amber, boxShadow: overallProgress === 100 ? `0 0 6px ${C.green}` : `0 0 6px ${C.amber}`, animation: overallProgress === 100 ? 'none' : 'pulse 1.2s ease-in-out infinite' }} />
                      Log de Extração
                    </div>
                    {logLines.map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '2px 0', animation: 'fadeInRow 200ms ease' }}>
                        <span style={{ color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.amber : C.text3, fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '18px', flexShrink: 0, minWidth: '10px' }}>{line.startsWith('✓') || line.startsWith('✗') || line.startsWith('▸') ? '' : '·'}</span>
                        <span style={{ fontSize: '11px', color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.amber : C.text2, fontFamily: 'var(--font-mono)', lineHeight: '18px' }}>{line}</span>
                      </div>
                    ))}
                    {overallProgress < 100 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
                        <Loader2 size={11} style={{ color: C.amber, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: C.text3, fontFamily: 'var(--font-mono)' }}>Processando...</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ STEP 3: Comprehensive Case File ══════════════ */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {caseAnalysisLoading && !caseAnalysis && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
                  <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${C.border2}` }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid transparent`, borderTopColor: C.amber, animation: 'spin 1s linear infinite' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.text1, marginBottom: '6px' }}>Extraindo dados do processo...</div>
                    <div style={{ fontSize: '12px', color: C.text3, fontFamily: 'var(--font-mono)' }}>Litigator AI analisando todos os documentos em profundidade</div>
                  </div>
                </div>
              )}

              {caseAnalysisError && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                  <AlertCircle size={40} style={{ color: C.red }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>Falha na análise</div>
                    <div style={{ fontSize: '12px', color: C.text3 }}>{caseAnalysisError}</div>
                  </div>
                  <button onClick={() => { setCaseAnalysisError(null); runCaseAnalysis() }} style={{ padding: '10px 24px', borderRadius: '7px', background: C.amber, border: `1px solid ${C.amber}`, color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Tentar Novamente
                  </button>
                </div>
              )}

              {caseAnalysis && (() => {
                const SectionHeader = ({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) => (
                  <div style={{ padding: '11px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {icon}
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                      {sub && <div style={{ fontSize: '10px', color: C.text4, marginTop: '1px' }}>{sub}</div>}
                    </div>
                  </div>
                )

                const Card = ({ children, accent }: { children: React.ReactNode; accent?: string }) => (
                  <div style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${accent || C.border2}`, overflow: 'hidden' }}>
                    {children}
                  </div>
                )

                const LabelValue = ({ label, value }: { label: string; value: string | undefined | null }) =>
                  value && value !== '' && value !== 'Não identificado' ? (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                      <div style={{ fontSize: '12px', color: C.text1, fontWeight: 500, marginTop: '2px', lineHeight: 1.4 }}>{value}</div>
                    </div>
                  ) : null

                return (
                  <>
                    {/* ── Top bar: title + risk + export ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: C.text1 }}>Ficha do Processo</div>
                        <div style={{ fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)', marginTop: '1px' }}>Extração estruturada por IA Jurídica</div>
                      </div>
                      <RiskBadge risco={caseAnalysis.risco_preliminar} C={C} />
                      <button
                        onClick={exportRelatorio}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', background: C.bg2, border: `1px solid ${C.border3}`, color: C.text2, cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', transition: 'all 150ms ease', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border3; e.currentTarget.style.color = C.text2 }}
                      >
                        <Printer size={12} /> Exportar Relatório
                      </button>
                    </div>

                    {/* ── DADOS DO PROCESSO ── */}
                    <Card>
                      <SectionHeader
                        icon={<MapPin size={13} style={{ color: C.blue, flexShrink: 0 }} />}
                        label="Dados do Processo"
                      />
                      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                        <LabelValue label="Número CNJ" value={caseAnalysis.dados_processo?.numero_cnj} />
                        <LabelValue label="Juiz(a)" value={caseAnalysis.dados_processo?.juiz} />
                        <LabelValue label="Comarca" value={caseAnalysis.dados_processo?.comarca} />
                        <LabelValue label="Vara" value={caseAnalysis.dados_processo?.vara} />
                        <LabelValue label="Localização" value={caseAnalysis.dados_processo?.localizacao} />
                        <LabelValue label="Data de Distribuição" value={caseAnalysis.dados_processo?.data_distribuicao} />
                      </div>
                    </Card>

                    {/* ── PARTES ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <ExpandablePartyCard
                        label="Parte Autora"
                        party={caseAnalysis.partes?.autor}
                        accent={C.redBorder}
                        icon={<User size={13} style={{ color: C.red, flexShrink: 0 }} />}
                        C={C}
                      />
                      <ExpandablePartyCard
                        label="Réu — Nosso Cliente"
                        party={caseAnalysis.partes?.reu
                          ? { ...caseAnalysis.partes.reu, nome: caseAnalysis.partes.reu.nome || selectedClientName }
                          : { nome: selectedClientName, cpf_cnpj: '', rg: '', nacionalidade: '', estado_civil: '', profissao: '', data_nascimento: '', email: '', endereco: { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' }, telefone: '', outras_info: '', advogados: [] }
                        }
                        accent={C.greenBorder}
                        icon={<ShieldCheck size={13} style={{ color: C.green, flexShrink: 0 }} />}
                        C={C}
                      />
                    </div>

                    {/* ── OBJETO DA AÇÃO ── */}
                    {caseAnalysis.objeto_da_acao && (
                      <Card>
                        <SectionHeader icon={<List size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Objeto da Ação" sub="Bem, relação jurídica ou objeto central da disputa" />
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* tipo badge + descrição */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                            {caseAnalysis.objeto_da_acao.tipo && caseAnalysis.objeto_da_acao.tipo !== '' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '5px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                {caseAnalysis.objeto_da_acao.tipo}
                              </span>
                            )}
                          </div>
                          {caseAnalysis.objeto_da_acao.descricao && caseAnalysis.objeto_da_acao.descricao !== '' && (
                            <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.6, padding: '10px 12px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                              {caseAnalysis.objeto_da_acao.descricao}
                            </div>
                          )}
                          {/* detail grid */}
                          {(caseAnalysis.objeto_da_acao.detalhes || []).length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 16px' }}>
                              {caseAnalysis.objeto_da_acao.detalhes.map((d, i) => (
                                <div key={i}>
                                  <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d.campo}</div>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.text1, marginTop: '2px', lineHeight: 1.4 }}>{d.valor}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!caseAnalysis.objeto_da_acao.tipo && !caseAnalysis.objeto_da_acao.descricao && (caseAnalysis.objeto_da_acao.detalhes || []).length === 0) && (
                            <div style={{ fontSize: '11px', color: C.text4, fontStyle: 'italic' }}>Objeto da ação não identificado nos documentos</div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* ── VALORES ── */}
                    <Card>
                      <SectionHeader icon={<Banknote size={13} style={{ color: C.amber, flexShrink: 0 }} />} label="Valores Envolvidos" />
                      <div style={{ padding: '0 16px' }}>
                        {(caseAnalysis.valores?.itens || []).filter(it => it.valor && it.valor !== 'Não identificado' && it.valor !== '').map((it, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.border1}`, gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', color: C.text1, fontWeight: 500 }}>{it.descricao}</div>
                              {it.fundamento && it.fundamento !== '' && (
                                <div style={{ fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)', marginTop: '2px', lineHeight: 1.4 }}>{it.fundamento}</div>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: C.text1, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{it.valor}</span>
                          </div>
                        ))}
                        {(caseAnalysis.valores?.itens || []).length === 0 && (
                          <div style={{ padding: '12px 0', fontSize: '11px', color: C.text4, fontStyle: 'italic' }}>Valores não identificados</div>
                        )}
                        {caseAnalysis.valores?.total && caseAnalysis.valores.total !== 'Não identificado' && caseAnalysis.valores.total !== '' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', margin: '8px 0 12px', borderRadius: '7px', background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: C.amber, fontFamily: 'var(--font-mono)' }}>TOTAL PLEITEADO</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: C.amber, fontFamily: 'var(--font-mono)' }}>{caseAnalysis.valores.total}</span>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* ── ALEGAÇÃO PRINCIPAL ── */}
                    <Card>
                      <SectionHeader icon={<Scale size={13} style={{ color: C.amber, flexShrink: 0 }} />} label="Alegação Principal" sub="Resumo da demanda narrada pelo autor" />
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {caseAnalysis.alegacao_principal && (
                          <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.7, padding: '12px 14px', borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border2}` }}>
                            {caseAnalysis.alegacao_principal}
                          </div>
                        )}
                        {(caseAnalysis.fatos_narrados || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Fatos Narrados pelo Autor</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {caseAnalysis.fatos_narrados.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '7px 10px', borderRadius: '6px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                                  <span style={{ color: C.amber, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '2px', minWidth: '18px' }}>{String(i + 1).padStart(2, '0')}</span>
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* ── FUNDAMENTO JURÍDICO ── */}
                    <Card>
                      <SectionHeader icon={<Gavel size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Fundamento Jurídico" sub="Base legal, teses e pedidos do autor" />
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {(caseAnalysis.fundamento_juridico?.base_legal || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Base Legal</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {caseAnalysis.fundamento_juridico.base_legal.map((b, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, fontSize: '11px', color: C.blue, fontFamily: 'var(--font-mono)' }}>
                                  <Link size={9} /> {b}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(caseAnalysis.fundamento_juridico?.teses || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Teses do Autor</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {caseAnalysis.fundamento_juridico.teses.map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '6px 10px', borderRadius: '6px', background: C.bg3 }}>
                                  <span style={{ color: C.blue, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '2px', minWidth: '18px' }}>{String(i + 1).padStart(2, '0')}</span>
                                  <span>{t}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(caseAnalysis.fundamento_juridico?.pedidos || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Pedidos ao Juiz</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {caseAnalysis.fundamento_juridico.pedidos.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '7px 10px', borderRadius: '6px', background: C.redBg, border: `1px solid ${C.redBorder}` }}>
                                  <span style={{ color: C.red, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '2px', minWidth: '18px', fontWeight: 700 }}>{i + 1}.</span>
                                  <span>{p}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* ── PROVAS FORNECIDAS ── */}
                    {(caseAnalysis.provas_fornecidas || []).length > 0 && (
                      <Card>
                        <SectionHeader icon={<FileText size={13} style={{ color: C.blue, flexShrink: 0 }} />} label={`Provas Fornecidas (${caseAnalysis.provas_fornecidas.length})`} sub="Documentos apresentados pela parte autora" />
                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {caseAnalysis.provas_fornecidas.map((prova: ProvaFornecida, i: number) => {
                            const isExp = expandedDocCards.has(String(i))
                            return (
                              <div
                                key={i}
                                style={{ borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border2}`, overflow: 'hidden', transition: 'all 150ms ease' }}
                              >
                                {/* Header — always visible */}
                                <button
                                  onClick={() => setExpandedDocCards(prev => {
                                    const next = new Set(prev)
                                    next.has(String(i)) ? next.delete(String(i)) : next.add(String(i))
                                    return next
                                  })}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <FileText size={12} style={{ color: C.blue, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.text1 }}>📄 {prova.documento}</span>
                                      {prova.tipo && prova.tipo !== '' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '4px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                          {prova.tipo}
                                        </span>
                                      )}
                                    </div>
                                    {/* resumo — always visible */}
                                    {prova.resumo && prova.resumo !== '' && (
                                      <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5, marginTop: '3px', display: '-webkit-box', WebkitLineClamp: isExp ? undefined : 2, WebkitBoxOrient: 'vertical' as const, overflow: isExp ? 'visible' : 'hidden' }}>
                                        {prova.resumo}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight size={12} style={{ color: C.text4, flexShrink: 0, transform: isExp ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
                                </button>
                                {/* Expandable deep analysis */}
                                {isExp && (
                                  <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${C.border1}`, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                                    {prova.conteudo_principal && prova.conteudo_principal !== '' && (
                                      <div>
                                        <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Conteúdo Principal</div>
                                        <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.6 }}>{prova.conteudo_principal}</div>
                                      </div>
                                    )}
                                    {prova.como_autor_usa && prova.como_autor_usa !== '' && (
                                      <div style={{ padding: '8px 10px', borderRadius: '6px', background: C.blueBg, border: `1px solid ${C.blueBorder}` }}>
                                        <div style={{ fontSize: '9px', color: C.blue, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 700 }}>Como o Autor Usa</div>
                                        <div style={{ fontSize: '12px', color: C.blue, lineHeight: 1.6 }}>{prova.como_autor_usa}</div>
                                      </div>
                                    )}
                                    {prova.tese_que_embasa && prova.tese_que_embasa !== '' && (
                                      <div>
                                        <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Tese que Embasa</div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '12px', color: C.text2, lineHeight: 1.6 }}>
                                          <span style={{ color: C.amber, flexShrink: 0 }}>→</span>
                                          <span>{prova.tese_que_embasa}</span>
                                        </div>
                                      </div>
                                    )}
                                    {prova.pontos_de_atencao && prova.pontos_de_atencao !== '' && (
                                      <div style={{ padding: '8px 10px', borderRadius: '6px', background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
                                        <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 700 }}>⚠ Pontos de Atenção</div>
                                        <div style={{ fontSize: '12px', color: C.amber, lineHeight: 1.6 }}>{prova.pontos_de_atencao}</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )}

                    {/* ── DATAS IMPORTANTES ── */}
                    {((caseAnalysis.datas_importantes || []).length > 0 || caseAnalysis.prazo_contestacao) && (
                      <Card>
                        <SectionHeader icon={<Calendar size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Cronologia" sub="Datas relevantes e prazo para contestação" />
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                          {(caseAnalysis.datas_importantes || []).map((d, i) => (
                            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border1}` }}>
                              <div style={{ fontSize: '10px', color: C.blue, fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: '110px', paddingTop: '1px', flexShrink: 0 }}>{d.data}</div>
                              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{d.evento}</div>
                            </div>
                          ))}
                          {caseAnalysis.prazo_contestacao && caseAnalysis.prazo_contestacao !== 'A verificar' && (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 12px', margin: '8px 0 4px', borderRadius: '7px', background: C.redBg, border: `1px solid ${C.redBorder}` }}>
                              <div style={{ fontSize: '10px', color: C.red, fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: '110px', flexShrink: 0 }}>⚠ PRAZO CONTES.</div>
                              <div style={{ fontSize: '12px', color: C.red, fontWeight: 600 }}>{caseAnalysis.prazo_contestacao}</div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* ── CHECKLIST DE DOCUMENTOS (rich grouped) ── */}
                    {caseAnalysis.checklist_documentos
                      ? (
                        <div>
                          <ChecklistDocumentosCard checklist={caseAnalysis.checklist_documentos} C={C} />
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 0' }}>
                            <Users size={13} style={{ color: C.text4, flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ margin: 0, fontSize: '11px', color: C.text4, lineHeight: 1.6 }}>
                              <strong style={{ color: C.text3 }}>Próximo passo:</strong> Solicite os documentos acima ao cliente. Você pode salvar agora e retornar quando tiver os documentos, ou continuar imediatamente.
                            </p>
                          </div>
                        </div>
                      )
                      : (caseAnalysis.documentos_necessarios_cliente || []).length > 0 && (
                        <Card>
                          <SectionHeader
                            icon={<ClipboardList size={13} style={{ color: C.blue, flexShrink: 0 }} />}
                            label="Documentos Necessários do Cliente"
                            sub="Solicite estes documentos antes de prosseguir"
                          />
                          <div style={{ padding: '6px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'var(--font-mono)' }}>
                              {checkedDocs.size}/{caseAnalysis.documentos_necessarios_cliente.length} coletados
                            </span>
                          </div>
                          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {caseAnalysis.documentos_necessarios_cliente.map((doc, i) => {
                              const isChecked = checkedDocs.has(i)
                              return (
                                <div
                                  key={i}
                                  onClick={() => setCheckedDocs(prev => {
                                    const next = new Set(prev)
                                    next.has(i) ? next.delete(i) : next.add(i)
                                    return next
                                  })}
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: isChecked ? C.greenBg : C.bg3, border: `1px solid ${isChecked ? C.greenBorder : C.border1}`, cursor: 'pointer', transition: 'all 150ms ease' }}
                                >
                                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isChecked ? C.green : C.border3}`, background: isChecked ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 150ms ease' }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: isChecked ? C.text3 : C.text1, textDecoration: isChecked ? 'line-through' : 'none' }}>{doc.documento}</span>
                                      <PriorityBadge prioridade={doc.prioridade} C={C} />
                                    </div>
                                    <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5 }}>{doc.motivo}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ padding: '10px 16px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <Users size={13} style={{ color: C.text4, flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ margin: 0, fontSize: '11px', color: C.text4, lineHeight: 1.6 }}>
                              <strong style={{ color: C.text3 }}>Próximo passo:</strong> Solicite os documentos acima ao cliente. Você pode salvar agora e retornar quando tiver os documentos, ou continuar imediatamente.
                            </p>
                          </div>
                        </Card>
                      )
                    }

                    {/* ── Action buttons ── */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        onClick={handleSaveAndWait}
                        disabled={isSavingAndWaiting}
                        style={{ flex: 1, padding: '13px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: isSavingAndWaiting ? 'not-allowed' : 'pointer', border: `1px solid ${C.border3}`, background: isSavingAndWaiting ? C.bg3 : C.bg2, color: isSavingAndWaiting ? C.text4 : C.text2, transition: 'all 200ms ease', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        onMouseEnter={e => { if (!isSavingAndWaiting) { e.currentTarget.style.borderColor = C.border3; e.currentTarget.style.color = C.text1 } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border3; e.currentTarget.style.color = C.text2 }}
                      >
                        {isSavingAndWaiting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={14} /> Salvar e Aguardar Documentos</>}
                      </button>
                      <button
                        onClick={() => setStep(4)}
                        style={{ flex: 1, padding: '13px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', border: `1px solid ${C.amber}`, background: C.amber, color: '#fff', transition: 'all 200ms ease', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <ShieldCheck size={14} />
                        Já Tenho os Documentos — Continuar →
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ══ STEP 4: Client Document Upload ═══════════════ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {clientGlobalError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                  <AlertCircle size={48} style={{ color: C.red }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>Falha no upload</div>
                    <div style={{ fontSize: '12px', color: C.text3 }}>{clientGlobalError}</div>
                  </div>
                  <button onClick={() => setClientGlobalError(null)} style={{ padding: '10px 24px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', fontSize: '13px' }}>
                    Tentar Novamente
                  </button>
                </div>
              ) : clientExtractions.length > 0 ? (
                /* Extraction in progress */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '14px', color: C.text1, lineHeight: 1.5 }}>
                    Processando <strong style={{ color: C.blue }}>{clientTaggedFiles.length} documento(s) do cliente</strong>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progresso</span>
                      <span style={{ fontSize: '11px', color: C.blue, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{clientProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: C.bg3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${clientProgress}%`, borderRadius: '3px', background: `linear-gradient(90deg, ${C.blue}cc, ${C.blue})`, transition: 'width 400ms ease', boxShadow: `0 0 8px ${C.blue}66` }} />
                    </div>
                  </div>
                  <div style={{ borderRadius: '8px', background: C.bg2, border: `1px solid ${C.border1}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {clientExtractions.map(e => (
                      <div key={e.taggedFileId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: `1px solid ${C.border1}` }}>
                        <FileStatusIcon status={e.status} C={C} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.fileName}</div>
                          {e.error && <div style={{ fontSize: '10px', color: C.red }}>{e.error}</div>}
                        </div>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: e.status === 'done' ? C.green : e.status === 'error' ? C.red : e.status === 'processing' ? C.blue : C.text4, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{e.category}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: '8px', background: C.bg0, border: `1px solid ${C.border1}`, padding: '14px 16px', maxHeight: '180px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: clientExtractionsDone ? C.green : C.blue, boxShadow: clientExtractionsDone ? `0 0 6px ${C.green}` : `0 0 6px ${C.blue}`, animation: clientExtractionsDone ? 'none' : 'pulse 1.2s ease-in-out infinite' }} />
                      Log de Extração — Documentos do Cliente
                    </div>
                    {clientLogLines.map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '2px 0' }}>
                        <span style={{ color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.blue : C.text3, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{line.startsWith('✓') || line.startsWith('✗') || line.startsWith('▸') ? '' : '·'}</span>
                        <span style={{ fontSize: '11px', color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.blue : C.text2, fontFamily: 'var(--font-mono)', lineHeight: '18px' }}>{line}</span>
                      </div>
                    ))}
                    {!clientExtractionsDone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}><Loader2 size={11} style={{ color: C.blue, animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '11px', color: C.text3, fontFamily: 'var(--font-mono)' }}>Processando...</span></div>}
                  </div>
                </div>
              ) : (
                /* Upload UI */
                <>
                  {/* Context reminder */}
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <Scale size={16} style={{ color: C.amber, flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: C.amber, marginBottom: '4px' }}>
                        {resumeProject ? `📎 Retomando análise — ${resumeProject.clientName}` : 'Upload dos Documentos do Cliente (Réu)'}
                      </div>
                      <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.6 }}>
                        {resumeProject
                          ? 'A análise inicial já foi concluída e salva. Faça upload dos documentos do seu cliente para iniciar a análise cruzada, pesquisa jurisprudencial e geração da estratégia de defesa.'
                          : 'Faça upload dos documentos fornecidos pelo seu cliente. Eles serão analisados em conjunto com os documentos da parte autora para identificar contradições, confirmar fatos e fortalecer a defesa.'}
                      </div>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div>
                    <div
                      onDragOver={e => { e.preventDefault(); setClientDragOver(true) }}
                      onDragLeave={() => setClientDragOver(false)}
                      onDrop={handleClientDrop}
                      onClick={() => clientFileInputRef.current?.click()}
                      style={{ border: `2px dashed ${clientDragOver ? C.blue : clientTaggedFiles.length > 0 ? C.green : C.border2}`, borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: clientDragOver ? C.blueBg : clientTaggedFiles.length > 0 ? C.greenBg : C.bg2, transition: 'all 200ms ease' }}
                    >
                      <input ref={clientFileInputRef} type="file" accept=".pdf" multiple onChange={handleClientFileChange} style={{ display: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Upload size={24} style={{ color: clientDragOver ? C.blue : clientTaggedFiles.length > 0 ? C.green : C.text3 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: clientDragOver ? C.blue : clientTaggedFiles.length > 0 ? C.green : C.text2 }}>
                            {clientTaggedFiles.length > 0 ? `${clientTaggedFiles.length} arquivo(s) — clique para adicionar mais` : 'Arraste os documentos do cliente aqui'}
                          </div>
                          <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
                            PDFs — contratos, comprovantes, conversas, procuração, etc.
                          </div>
                        </div>
                      </div>
                    </div>

                    {clientTaggedFiles.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                        {clientTaggedFiles.map(tf => (
                          <div key={tf.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: C.bg2, border: `1px solid ${C.border1}`, transition: 'all 150ms ease' }}>
                            <FileText size={14} style={{ color: C.blue, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tf.file.name}</div>
                              <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)' }}>{(tf.file.size / 1024).toFixed(0)} KB</div>
                            </div>
                            <CategoryDropdown
                              value={tf.category}
                              onChange={v => handleClientCategoryChange(tf.id, v as ClientDocCategory)}
                              options={CLIENT_DOCUMENT_CATEGORIES}
                              C={C}
                            />
                            <button onClick={() => removeClientFile(tf.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Nav buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => resumeProject ? onClose() : setStep(3)}
                      style={{ padding: '11px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: `1px solid ${C.border2}`, background: 'transparent', color: C.text3, transition: 'all 200ms ease', fontFamily: 'var(--font-mono)' }}
                    >
                      {resumeProject ? '✕ Fechar' : '← Voltar'}
                    </button>

                    <button
                      disabled={clientTaggedFiles.length === 0}
                      onClick={runClientExtraction}
                      style={{ flex: 1, padding: '13px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: clientTaggedFiles.length > 0 ? 'pointer' : 'not-allowed', border: `1px solid ${clientTaggedFiles.length > 0 ? C.blue : C.border1}`, background: clientTaggedFiles.length > 0 ? C.blue : C.bg3, color: clientTaggedFiles.length > 0 ? '#fff' : C.text4, transition: 'all 200ms ease', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <ShieldCheck size={16} />
                      {clientTaggedFiles.length > 0 ? `Enviar ${clientTaggedFiles.length} documento(s) para Análise Cruzada →` : 'Adicione ao menos um PDF'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ STEP 5: Research Log + Strategy ══════════════ */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: strategyData ? '80px' : '0' }}>

              {/* ─── Research loading phase ─── */}
              {!strategyData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>
                  {researchError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                      <AlertCircle size={48} style={{ color: C.red }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>Falha na pesquisa</div>
                        <div style={{ fontSize: '12px', color: C.text3 }}>{researchError}</div>
                      </div>
                      <button onClick={() => { setStep(4); setResearchError(null) }} style={{ padding: '10px 24px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', fontSize: '13px' }}>
                        ← Voltar
                      </button>
                    </div>
                  ) : (
                    <>
                      {peticaoData && (
                        <div style={{ padding: '10px 14px', borderRadius: '8px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Scale size={16} style={{ color: C.amber, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: C.amber }}>{peticaoData.tipo_acao || 'Ação em análise'}</div>
                            <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                              {[typeof peticaoData.autor === 'object' ? peticaoData.autor?.nome : peticaoData.autor, 'x', typeof peticaoData.reu === 'object' ? peticaoData.reu?.nome : peticaoData.reu].filter(Boolean).join(' ')} — {peticaoData.comarca || 'Comarca não informada'}
                              {clientExtractions.filter(e => e.status === 'done').length > 0 && (
                                <span style={{ color: C.blue, marginLeft: '8px' }}>· {clientExtractions.filter(e => e.status === 'done').length} doc(s) do cliente incluídos</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ borderRadius: '10px', background: C.bg0, border: `1px solid ${C.border1}`, padding: '16px 20px', minHeight: '280px' }}>
                        <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: researchDone ? C.green : C.amber, boxShadow: researchDone ? `0 0 6px ${C.green}` : `0 0 6px ${C.amber}`, animation: researchDone ? 'none' : 'pulse 1.2s ease-in-out infinite' }} />
                          Pesquisa Jurisprudencial — IA{clientExtractions.filter(e => e.status === 'done').length > 0 && ' + Análise Cruzada'}
                        </div>
                        <div ref={researchLogRef} style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '300px', overflowY: 'auto' }}>
                          {researchLogLines.map((line, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '5px 0', borderBottom: i < researchLogLines.length - 1 ? `1px solid ${C.border1}` : 'none', animation: 'fadeInRow 300ms ease' }}>
                              <span style={{ fontSize: '12px', color: C.text4, fontFamily: 'var(--font-mono)', width: '20px', flexShrink: 0 }}>
                                {line.startsWith('✓') ? '✓' : line.startsWith('✗') ? '✗' : line.startsWith('▸') ? '▸' : '·'}
                              </span>
                              <span style={{ fontSize: '13px', color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.amber : i === researchLogLines.length - 1 ? C.text1 : C.text2, fontFamily: 'var(--font-mono)', lineHeight: '22px', fontWeight: line.startsWith('▸') ? 700 : 400 }}>
                                {line.startsWith('✓') || line.startsWith('✗') || line.startsWith('▸') ? line.slice(2) : line}
                              </span>
                              {i === researchLogLines.length - 1 && !researchDone && !line.startsWith('✓') && !line.startsWith('✗') && !line.startsWith('▸') && (
                                <Loader2 size={12} style={{ color: C.amber, animation: 'spin 1s linear infinite', marginTop: '5px', flexShrink: 0 }} />
                              )}
                            </div>
                          ))}
                          {researchLogLines.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Loader2 size={14} style={{ color: C.amber, animation: 'spin 1s linear infinite' }} />
                              <span style={{ fontSize: '13px', color: C.text3, fontFamily: 'var(--font-mono)' }}>Iniciando pesquisa...</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!researchDone && (
                        <div style={{ padding: '12px 16px', borderRadius: '8px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Loader2 size={16} style={{ color: C.amber, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: C.amber }}>Pesquisa em andamento...</div>
                            <div style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>Consultando STJ, STF e tribunais estaduais. Aguarde.</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ─── Strategy display phase ─── */}
              {strategyData && (
                <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
                  {/* Left column: Strategy */}
                  <div style={{ flex: '0 0 58%', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '10px', color: C.amber, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Scale size={12} /> ESTRATÉGIA DE DEFESA
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <ProbabilityDisplay value={strategyData.probabilidade_exito} C={C} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, textAlign: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recomendação</div>
                        <div style={{ padding: '6px 14px', borderRadius: '20px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, fontSize: '13px', fontWeight: 700, color: C.amber, fontFamily: 'var(--font-mono)' }}>{strategyData.recomendacao}</div>
                        {strategyData.valor_risco_estimado && <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'var(--font-mono)' }}>Risco: {strategyData.valor_risco_estimado}</div>}
                      </div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.amberBg, border: `2px solid ${C.amberBorder}` }}>
                      <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={10} /> TESE PRINCIPAL
                      </div>
                      <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.6, fontWeight: 500 }}>{strategyData.tese_principal}</div>
                    </div>

                    {strategyData.teses_subsidiarias?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Teses Subsidiárias ({strategyData.teses_subsidiarias.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.teses_subsidiarias.map((tese, i) => (
                            <button key={i} onClick={() => setExpandedTese(expandedTese === i ? null : i)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', background: C.bg2, border: `1px solid ${C.border2}`, cursor: 'pointer', color: C.text1, display: 'flex', alignItems: 'flex-start', gap: '8px', transition: 'all 150ms ease' }} onMouseEnter={e => (e.currentTarget.style.borderColor = C.border3)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border2)}>
                              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: C.amber, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>{String(i + 1).padStart(2, '0')}</span>
                              <span style={{ fontSize: '12px', color: C.text2, flex: 1, lineHeight: 1.5, textAlign: 'left', display: expandedTese === i ? 'block' : '-webkit-box', WebkitLineClamp: expandedTese === i ? undefined : 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{tese}</span>
                              <ChevronRight size={12} style={{ color: C.text3, flexShrink: 0, marginTop: '2px', transform: expandedTese === i ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {strategyData.jurisprudencia_favoravel?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', color: C.green, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BookOpen size={10} /> JURISPRUDÊNCIA FAVORÁVEL ({strategyData.jurisprudencia_favoravel.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.jurisprudencia_favoravel.map((item, i) => <JurisprudenciaCard key={i} item={item} type="favorable" C={C} />)}
                        </div>
                      </div>
                    )}

                    {strategyData.jurisprudencia_desfavoravel?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', color: C.red, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingDown size={10} /> RISCOS — JURISPRUDÊNCIA DESFAVORÁVEL ({strategyData.jurisprudencia_desfavoravel.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.jurisprudencia_desfavoravel.map((item, i) => <JurisprudenciaCard key={i} item={item} type="unfavorable" C={C} />)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ width: '1px', background: C.border2, flexShrink: 0 }} />

                  {/* Right column: Draft */}
                  <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                    <div style={{ fontSize: '10px', color: C.blue, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <FileText size={12} /> MINUTA DA CONTESTAÇÃO
                    </div>
                    <div ref={draftRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, fontSize: '12px', color: C.text2, lineHeight: '1.7', fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {strategyData.draft}
                    </div>
                  </div>
                </div>
              )}

              {strategyError && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={14} />{strategyError}
                </div>
              )}

              {/* Adjust input */}
              {showAdjustInput && strategyData && (
                <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: C.text2, fontWeight: 600 }}>Instruções para ajuste da estratégia:</div>
                  <textarea value={adjustFeedback} onChange={e => setAdjustFeedback(e.target.value)} placeholder='Ex: "Focar mais na tese de prescrição" ou "Incluir argumento de ilegitimidade passiva"' rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border2}`, color: C.text1, fontSize: '12px', lineHeight: 1.5, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowAdjustInput(false); setAdjustFeedback('') }} style={{ padding: '8px 16px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                    <button onClick={regenerateStrategy} disabled={!adjustFeedback.trim() || strategyLoading} style={{ padding: '8px 16px', borderRadius: '6px', background: adjustFeedback.trim() ? C.amber : C.bg3, border: `1px solid ${adjustFeedback.trim() ? C.amber : C.border2}`, color: adjustFeedback.trim() ? '#fff' : C.text4, cursor: adjustFeedback.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {strategyLoading ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</> : <><Edit3 size={12} /> Regenerar</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step 5 Action Bar ─────────────────────────────── */}
        {step === 5 && strategyData && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 24px', background: C.bg1, borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '0 0 14px 14px' }}>
            <button onClick={() => setStep(4)} style={{ padding: '10px 16px', borderRadius: '7px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ← Voltar
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowAdjustInput(v => !v)} style={{ padding: '10px 16px', borderRadius: '7px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 150ms ease' }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.color = C.amber }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2 }}>
              <Edit3 size={13} /> Ajustar Estratégia
            </button>
            <button onClick={handleApproveAndSave} disabled={isSaving} style={{ padding: '10px 24px', borderRadius: '7px', background: isSaving ? C.bg3 : C.amber, border: `1px solid ${isSaving ? C.border2 : C.amber}`, color: isSaving ? C.text4 : '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 150ms ease' }}>
              {isSaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={14} /> Aprovar e Salvar</>}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: C.green, color: '#fff', padding: '12px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, zIndex: 1002, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 200ms ease' }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
