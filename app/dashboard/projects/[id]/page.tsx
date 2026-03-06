'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'
import { formatDate, formatFileSize, statusLabel, diasUteisRestantes } from '@/lib/utils'
import type { Project, Document, Client } from '@/lib/types'
import type {
  CaseAnalysis, DocumentoNecessario, ProvaFornecida, ParteDetalhada,
  ChecklistDocumentos, ChecklistGrupo, ChecklistDocumento, ObservacaoEstrategica,
} from '@/app/api/analyze-case/route'
import Link from 'next/link'
import {
  ArrowLeft, FileText, BarChart3, Loader2,
  CheckCircle2, XCircle, Clock, Upload, Trash2, Printer,
  Scale, ClipboardList, ShieldCheck, Calendar, Gavel, MapPin,
  User, Banknote, List, Link as LinkIcon, ChevronRight,
  AlertCircle, RefreshCw, Plus, BookOpen,
} from 'lucide-react'
import DeleteModal from '@/app/dashboard/components/DeleteModal'
import Toast from '@/app/dashboard/components/Toast'

type Tab = 'analise_inicial' | 'documentos' | 'analise_cruzada' | 'estrategia'

/* ─── Helpers ──────────────────────────────────────────────────── */
const FASE_LABELS: Record<string, string> = {
  analise: 'Análise', contestacao: 'Contestação', recurso: 'Recurso',
  execucao: 'Execução', encerrado: 'Encerrado',
}
const FASE_COLORS: Record<string, string> = {
  analise: '#3B82F6', contestacao: '#F59E0B', recurso: '#EF4444',
  execucao: '#22C55E', encerrado: '#71717A',
}

/* ─── Shared UI Atoms (use C-color system) ─────────────────────── */

function DetailField({ label, value, C, span }: {
  label: string; value: string | null | undefined
  C: ReturnType<typeof getColors>; span?: boolean
}) {
  const empty = !value || value.trim() === ''
  return (
    <div style={{ marginBottom: '8px', gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: empty ? 400 : 500, marginTop: '2px', lineHeight: 1.4, color: empty ? C.text4 : C.text1, fontStyle: empty ? 'italic' : 'normal' }}>
        {empty ? 'Não informado' : value}
      </div>
    </div>
  )
}

function ExpandablePartyCard({ label, party, accent, icon, C }: {
  label: string; party: ParteDetalhada | undefined | null
  accent: string; icon: React.ReactNode; C: ReturnType<typeof getColors>
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedAdvs, setExpandedAdvs] = useState<Set<number>>(new Set())
  const p = party || ({} as ParteDetalhada)

  const addr = p.endereco
  const addrParts = addr ? [
    addr.rua && addr.numero ? `${addr.rua}, ${addr.numero}` : (addr.rua || addr.numero || ''),
    addr.bairro,
    addr.cidade && addr.estado ? `${addr.cidade}/${addr.estado}` : (addr.cidade || addr.estado || ''),
    addr.cep,
  ].filter(Boolean) : []
  const addrStr = addrParts.length > 0 ? addrParts.join(' — ') : null

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
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
          <div style={{ fontSize: '13px', color: C.text1, fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.nome || <span style={{ color: C.text4, fontStyle: 'italic', fontWeight: 400 }}>Não identificado</span>}
          </div>
        </div>
        {p.cpf_cnpj && (
          <span style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>{p.cpf_cnpj}</span>
        )}
        <ChevronRight size={12} style={{ color: C.text4, transform: expanded ? 'rotate(90deg)' : 'none', transition: '200ms', flexShrink: 0, marginLeft: '4px' }} />
      </button>

      {!expanded && (
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {p.estado_civil && <span style={{ fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace' }}>{p.estado_civil}</span>}
          {p.profissao && <span style={{ fontSize: '11px', color: C.text3 }}>{p.profissao}</span>}
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace' }}>
            {(p.advogados || []).length > 0 ? `${p.advogados.length} adv.` : 'sem advogado'}
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ padding: '14px 16px' }}>
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
          <DetailField label="Endereço" value={addrStr} C={C} span />
          {p.outras_info && p.outras_info.trim() !== '' && (
            <div style={{ marginTop: '4px', marginBottom: '8px', padding: '8px 10px', borderRadius: '6px', background: C.bg3, border: `1px solid ${C.border1}` }}>
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Outras Informações</div>
              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{p.outras_info}</div>
            </div>
          )}
          <div style={{ marginTop: '12px', borderTop: `1px solid ${C.border1}`, paddingTop: '12px' }}>
            <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>
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
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: C.text1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.nome || '—'}</div>
                      {oabLabel && <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '1px' }}>{oabLabel}</div>}
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

function PriorityBadge({ prioridade, C }: { prioridade: DocumentoNecessario['prioridade']; C: ReturnType<typeof getColors> }) {
  const config = {
    alta:  { color: C.red,   bg: C.redBg,   border: C.redBorder,   label: 'Alta' },
    media: { color: C.amber, bg: C.amberBg, border: C.amberBorder, label: 'Média' },
    baixa: { color: C.text3, bg: C.bg3,     border: C.border2,     label: 'Baixa' },
  }
  const s = config[prioridade] || config.baixa
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '4px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '10px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.05em', flexShrink: 0 }}>
      {s.label}
    </span>
  )
}

function RiskBadge({ risco, C }: { risco: string; C: ReturnType<typeof getColors> }) {
  const lower = (risco || '').toLowerCase()
  const color = lower === 'alto' ? C.red : lower === 'medio' ? C.amber : C.green
  const bg    = lower === 'alto' ? C.redBg : lower === 'medio' ? C.amberBg : C.greenBg
  const border = lower === 'alto' ? C.redBorder : lower === 'medio' ? C.amberBorder : C.greenBorder
  const label = lower === 'alto' ? '⚠ Risco Alto' : lower === 'medio' ? '◈ Risco Médio' : '✓ Risco Baixo'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '6px', background: bg, border: `1px solid ${border}`, color, fontSize: '11px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>
      {label}
    </span>
  )
}

/* ─── Checklist HTML helpers ─── */
function classifBadgeStyle(classificacao: string): string {
  switch (classificacao) {
    case 'OBRIGATÓRIO': return 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5'
    case 'IMPORTANTE': return 'background:#fef3c7;color:#d97706;border:1px solid #fcd34d'
    case 'COMPLEMENTAR': return 'background:#dbeafe;color:#2563eb;border:1px solid #93c5fd'
    case 'REQUERIMENTO JUDICIAL': return 'background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd'
    default: return 'background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db'
  }
}

function obsStyle(tipo: string): string {
  if (tipo.includes('IMEDIATA') || tipo.includes('IMEDIATAMENTE') || tipo.includes('URGENTE') || tipo.includes('PRAZO'))
    return 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5'
  if (tipo.includes('CONTRADIÇÃO') || tipo.includes('FRACO'))
    return 'background:#fef3c7;color:#d97706;border:1px solid #fcd34d'
  if (tipo.includes('JURISPRUDÊNCIA'))
    return 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'
  return 'background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd'
}

function buildChecklistSection(checklist: ChecklistDocumentos): string {
  const grupos = (checklist.grupos || []).filter(g => g.documentos && g.documentos.length > 0)
  if (grupos.length === 0) return ''
  const totalDocs = grupos.reduce((s, g) => s + g.documentos.length, 0)
  return `
  <h2>CHECKLIST DE DOCUMENTOS — ${checklist.subtitulo || ''}</h2>
  <div style="font-size:11px;color:#555;margin-bottom:12px;font-family:monospace">
    Total: ${totalDocs} documentos em ${grupos.length} grupos
  </div>
  ${grupos.map(g => `
  <div class="card" style="margin-bottom:14px;page-break-inside:avoid">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace">${g.nome}</div>
      <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace;letter-spacing:0.06em;${classifBadgeStyle(g.classificacao)}">${g.classificacao}</span>
    </div>
    ${g.documentos.map(d => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f5f5f5">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:3px">${d.nome}</div>
        <div style="font-size:11px;color:#555;line-height:1.5">${d.justificativa}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span class="badge badge-${d.prioridade}">${d.prioridade}</span>
        <div style="display:flex;gap:4px;font-size:10px;font-family:monospace;color:#888">
          <span style="border:1px solid #ccc;border-radius:3px;padding:1px 6px">Rec ☐</span>
          <span style="border:1px solid #ccc;border-radius:3px;padding:1px 6px">Dig ☐</span>
          <span style="border:1px solid #ccc;border-radius:3px;padding:1px 6px">Jun ☐</span>
        </div>
      </div>
    </div>`).join('')}
  </div>`).join('')}
  ${(checklist.observacoes_estrategicas || []).length > 0 ? `
  <div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb">
    <div class="card-header" style="color:#92400e">OBSERVAÇÕES ESTRATÉGICAS DO ADVOGADO</div>
    ${(checklist.observacoes_estrategicas || []).map(o => `
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
      <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace;flex-shrink:0;${obsStyle(o.tipo)}">${o.tipo}</span>
      <div style="font-size:12px;color:#333;line-height:1.6">${o.descricao}</div>
    </div>`).join('')}
  </div>` : ''}`
}

function buildChecklistHTML(
  checklist: ChecklistDocumentos,
  clientName: string,
  caseRef: string,
  dateStr: string,
  timeStr: string,
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Checklist de Documentos — ${caseRef}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 13px; }
  .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 18px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
  .header p { font-size: 11px; color: #555; margin-top: 6px; font-family: monospace; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #1a1a1a; margin: 22px 0 10px; }
  .card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; }
  .card-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 10px; font-family: monospace; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; font-family: monospace; letter-spacing: 0.05em; }
  .badge-alta { background: #fee2e2; color: #dc2626; }
  .badge-media { background: #fef3c7; color: #d97706; }
  .badge-baixa { background: #f3f4f6; color: #6b7280; }
  .footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; font-family: monospace; }
  @media print { body { padding: 20px; } .card { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <h1>LITIGATOR AI — CHECKLIST DE DOCUMENTOS DO CLIENTE</h1>
    <p>${checklist.subtitulo || ''} &nbsp;|&nbsp; Processo: ${caseRef} &nbsp;|&nbsp; Cliente: ${clientName} &nbsp;|&nbsp; Gerado em: ${dateStr}</p>
  </div>
  ${buildChecklistSection(checklist)}
  <div class="footer">Gerado por Litigator AI em ${dateStr} às ${timeStr} — Uso interno do escritório</div>
</body>
</html>`
}

/* ─── Export report function (standalone, called from page) ─── */
function buildExportHTML(
  caseAnalysis: CaseAnalysis,
  clientName: string,
  caseRef: string,
  dateStr: string,
  timeStr: string,
): string {
  const field = (label: string, value: string | undefined | null) =>
    value && value !== 'Não identificado' && value !== ''
      ? `<div class="field"><div class="label">${label}</div><div class="value">${value}</div></div>`
      : ''

  const renderParte = (parte: ParteDetalhada | null | undefined, titulo: string, fallbackNome?: string) => {
    if (!parte && !fallbackNome) return `<div class="card"><div class="card-header">${titulo}</div><div class="prose" style="color:#aaa;font-style:italic">Não identificado</div></div>`
    const p = parte || { nome: fallbackNome || '', cpf_cnpj: '', rg: '', nacionalidade: '', estado_civil: '', profissao: '', data_nascimento: '', email: '', endereco: null, telefone: '', outras_info: '', advogados: [] } as unknown as ParteDetalhada
    const enderecoStr = p.endereco
      ? [p.endereco.rua, p.endereco.numero, p.endereco.bairro, p.endereco.cidade, p.endereco.estado, p.endereco.cep].filter(Boolean).join(', ')
      : ''
    const advCards = (p.advogados || []).map((a, idx) => `
      <div style="border:1px solid #e5e5e5;border-radius:4px;padding:10px 12px;margin-top:10px">
        <div class="card-header">ADVOGADO(A) ${idx + 1}</div>
        <div class="grid-2">
          ${field('Nome', a.nome)}
          ${field('OAB / Seccional', [a.oab, a.seccional].filter(Boolean).join(' — '))}
          ${field('Escritório', a.escritorio)}
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
        ${advCards}
      </div>`
  }

  return `<!DOCTYPE html>
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
  ol { padding-left: 20px; }
  ol li { font-size: 12px; color: #444; margin-bottom: 6px; line-height: 1.5; }
  .row-value { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f5f5f5; }
  .row-value:last-child { border-bottom: none; }
  .row-label { font-size: 12px; color: #666; }
  .row-amount { font-size: 13px; font-weight: 700; font-family: monospace; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; font-family: monospace; letter-spacing: 0.05em; margin-right: 8px; }
  .badge-alta { background: #fee2e2; color: #dc2626; }
  .badge-media { background: #fef3c7; color: #d97706; }
  .badge-baixa { background: #f3f4f6; color: #6b7280; }
  .timeline-item { display: flex; gap: 14px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
  .timeline-item:last-child { border-bottom: none; }
  .timeline-date { font-size: 10px; font-family: monospace; color: #2563eb; font-weight: 600; min-width: 120px; padding-top: 1px; }
  .timeline-event { font-size: 12px; color: #333; line-height: 1.5; }
  .doc-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
  .doc-item:last-child { border-bottom: none; }
  .footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; font-family: monospace; }
  @media print { body { padding: 20px; } }
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
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">
    ${renderParte(caseAnalysis.partes?.autor, 'PARTE AUTORA')}
    ${renderParte(caseAnalysis.partes?.reu, 'RÉU — NOSSO CLIENTE', clientName)}
  </div>

  <h2>OBJETO DA AÇÃO</h2>
  ${caseAnalysis.objeto_da_acao ? `
  <div class="card">
    <div style="margin-bottom:10px"><span class="badge" style="background:#dbeafe;color:#1d4ed8">${caseAnalysis.objeto_da_acao.tipo || 'Não identificado'}</span></div>
    <div class="prose">${caseAnalysis.objeto_da_acao.descricao || ''}</div>
  </div>` : ''}

  <h2>VALORES ENVOLVIDOS</h2>
  <div class="card">
    ${(caseAnalysis.valores?.itens || []).filter(it => it.valor && it.valor !== 'Não identificado').map(it =>
      `<div class="row-value"><span class="row-label"><strong>${it.descricao}</strong></span><span class="row-amount">${it.valor}</span></div>`
    ).join('')}
    ${caseAnalysis.valores?.total && caseAnalysis.valores.total !== 'Não identificado'
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
    <ul>${(caseAnalysis.fundamento_juridico.base_legal).map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
    ${(caseAnalysis.fundamento_juridico?.teses || []).length > 0 ? `
    <div class="card-header" style="margin-top:14px">TESES DO AUTOR</div>
    <ul>${(caseAnalysis.fundamento_juridico.teses).map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    ${(caseAnalysis.fundamento_juridico?.pedidos || []).length > 0 ? `
    <div class="card-header" style="margin-top:14px">PEDIDOS AO JUIZ</div>
    <ol>${(caseAnalysis.fundamento_juridico.pedidos).map(p => `<li>${p}</li>`).join('')}</ol>` : ''}
  </div>

  <h2>DATAS IMPORTANTES</h2>
  <div class="card">
    ${(caseAnalysis.datas_importantes || []).map(d => `
    <div class="timeline-item">
      <div class="timeline-date">${d.data}</div>
      <div class="timeline-event">${d.evento}</div>
    </div>`).join('')}
    ${caseAnalysis.prazo_contestacao ? `
    <div style="display:flex;gap:12px;align-items:center;padding:10px 12px;margin-top:8px;border-radius:6px;background:#fff5f5;border:1px solid #fecaca">
      <div style="font-size:10px;font-family:monospace;color:#dc2626;font-weight:700">⚠ PRAZO CONTESTAÇÃO</div>
      <div style="font-size:12px;color:#dc2626;font-weight:600">${caseAnalysis.prazo_contestacao}</div>
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

  ${caseAnalysis.checklist_documentos ? buildChecklistSection(caseAnalysis.checklist_documentos) : ''}

  <div class="footer">Gerado por Litigator AI em ${dateStr} às ${timeStr}</div>
</body>
</html>`
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const router = useRouter()
  const { firmId } = useAuth()
  const { theme } = useTheme()
  const C = getColors(theme)

  const [project, setProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<Tab>('analise_inicial')
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Case Analysis state (loaded from case_strategies)
  const [caseAnalysis, setCaseAnalysis] = useState<CaseAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [checkedDocs, setCheckedDocs] = useState<Set<number>>(new Set())
  const [expandedDocCards, setExpandedDocCards] = useState<Set<string>>(new Set())

  // Strategy state
  const [strategyRecord, setStrategyRecord] = useState<Record<string, unknown> | null>(null)

  async function handleDeleteProject() {
    if (!project) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir')
      setToast({ message: 'Processo excluído com sucesso', type: 'success' })
      setShowDeleteModal(false)
      setTimeout(() => router.push('/dashboard/clients'), 1000)
    } catch {
      setToast({ message: 'Erro ao excluir processo', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    async function load() {
      const projRes = await supabase
        .from('projects')
        .select('*, clients(name, cnpj)')
        .eq('id', projectId)
        .single()

      if (projRes.data) {
        setProject({
          ...projRes.data,
          client: projRes.data.clients as unknown as Client,
        } as unknown as Project)
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  // Load case analysis from case_strategies
  useEffect(() => {
    if (!projectId) return
    setAnalysisLoading(true)
    async function loadAnalysis() {
      const { data } = await supabase
        .from('case_strategies')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        // Find the analise_inicial record
        const analise = data.find((r: Record<string, unknown>) => r.status === 'analise_inicial' || r.draft_tipo === 'analise_inicial')
        if (analise?.draft_peca) {
          try {
            const parsed = JSON.parse(analise.draft_peca as string) as { caseAnalysis?: CaseAnalysis }
            if (parsed.caseAnalysis) setCaseAnalysis(parsed.caseAnalysis)
          } catch { /* ignore parse errors */ }
        }

        // Find strategy record
        const strategy = data.find((r: Record<string, unknown>) => r.status === 'aprovado' || r.draft_tipo === 'contestacao')
        if (strategy) setStrategyRecord(strategy as Record<string, unknown>)
      }
      setAnalysisLoading(false)
    }
    loadAnalysis()
  }, [projectId])

  const exportRelatorio = useCallback(() => {
    if (!caseAnalysis || !project) return
    const clientName = project.client?.name || ''
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR')
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const caseRef = caseAnalysis.dados_processo?.numero_cnj || project.numero_processo || 'Processo não identificado'
    const html = buildExportHTML(caseAnalysis, clientName, caseRef, dateStr, timeStr)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    }
  }, [caseAnalysis, project])

  const exportChecklist = useCallback(() => {
    if (!caseAnalysis?.checklist_documentos || !project) return
    const clientName = project.client?.name || ''
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR')
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const caseRef = caseAnalysis.dados_processo?.numero_cnj || project.numero_processo || 'Processo não identificado'
    const html = buildChecklistHTML(caseAnalysis.checklist_documentos, clientName, caseRef, dateStr, timeStr)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    }
  }, [caseAnalysis, project])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
      <div className="spinner" />
    </div>
  )
  if (!project) return <p style={{ color: 'var(--text-muted)' }}>Processo não encontrado.</p>

  const faseColor = FASE_COLORS[project.fase] || '#71717A'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'analise_inicial', label: '📋 Análise Inicial' },
    { key: 'documentos',      label: '📄 Documentos' },
    { key: 'analise_cruzada', label: '🔍 Análise Cruzada' },
    { key: 'estrategia',      label: '⚖️ Estratégia & Defesa' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minHeight: '100vh', background: C.bg1 }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '16px', width: 'fit-content' }}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* ── Case Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: C.bg1,
        paddingBottom: '0',
        marginBottom: '24px',
      }}>
        <div style={{
          padding: '16px 20px',
          borderRadius: '10px',
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          marginBottom: '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: C.text1 }}>{project.name}</h1>
                <span style={{
                  padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                  background: `${faseColor}18`, color: faseColor, border: `1px solid ${faseColor}30`,
                  textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  {FASE_LABELS[project.fase] || project.fase}
                </span>
                {project.status === 'aguardando_documentos' && (
                  <span style={{
                    padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                    background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}`,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    📎 Aguardando Docs do Cliente
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: C.text3, flexWrap: 'wrap' }}>
                {project.client?.name && (
                  <Link href={`/dashboard/clients/${project.client_id}`} style={{ color: C.blue, textDecoration: 'none' }}>
                    {project.client.name}
                  </Link>
                )}
                {project.numero_processo && (
                  <span style={{ color: C.text3, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                    CNJ: {project.numero_processo}
                  </span>
                )}
                {project.vara && <span>{project.vara}</span>}
                {project.comarca && <span>{project.comarca}</span>}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              {caseAnalysis?.checklist_documentos && (
                <button
                  onClick={exportChecklist}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '7px',
                    background: C.bg3, border: `1px solid ${C.border3}`,
                    color: C.text2, cursor: 'pointer', fontSize: '12px',
                    fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border3; e.currentTarget.style.color = C.text2 }}
                >
                  <ClipboardList size={13} /> Exportar Checklist
                </button>
              )}
              {caseAnalysis && (
                <button
                  onClick={exportRelatorio}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '7px',
                    background: C.bg3, border: `1px solid ${C.border3}`,
                    color: C.text2, cursor: 'pointer', fontSize: '12px',
                    fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border3; e.currentTarget.style.color = C.text2 }}
                >
                  <Printer size={13} /> Exportar Relatório
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Excluir processo"
                style={{
                  width: '34px', height: '34px', borderRadius: '6px',
                  background: 'transparent', border: `1px solid ${C.border2}`,
                  color: C.text3, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms ease', flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = C.redBg
                  e.currentTarget.style.borderColor = C.redBorder
                  e.currentTarget.style.color = C.red
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = C.border2
                  e.currentTarget.style.color = C.text3
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border2}`, gap: '0', marginTop: '16px' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px',
                fontSize: '13px', fontWeight: 500,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? `2px solid ${C.amber}` : '2px solid transparent',
                color: tab === t.key ? C.amber : C.text3,
                marginBottom: '-1px',
                transition: 'color 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: '0' }}>
        {tab === 'analise_inicial' && (
          <AnaliseInicialTab
            projectId={projectId}
            firmId={firmId}
            caseAnalysis={caseAnalysis}
            loading={analysisLoading}
            C={C}
            clientName={project.client?.name || ''}
            checkedDocs={checkedDocs}
            setCheckedDocs={setCheckedDocs}
            expandedDocCards={expandedDocCards}
            setExpandedDocCards={setExpandedDocCards}
            onAnalysisUpdated={setCaseAnalysis}
            setToast={setToast}
          />
        )}
        {tab === 'documentos' && (
          <DocumentosTab
            projectId={projectId}
            firmId={firmId}
            C={C}
            onAnalysisRerun={(analysis) => {
              setCaseAnalysis(analysis)
              setTab('analise_inicial')
              setToast({ message: 'Análise regenerada com sucesso!', type: 'success' })
            }}
            setToast={setToast}
          />
        )}
        {tab === 'analise_cruzada' && (
          <AnaliseCruzadaTab C={C} />
        )}
        {tab === 'estrategia' && (
          <EstratégiaTab C={C} strategyRecord={strategyRecord} />
        )}
      </div>

      {/* Delete modal */}
      <DeleteModal
        open={showDeleteModal}
        title="Excluir Processo"
        message={project
          ? `Tem certeza que deseja excluir o processo "${project.name}"? Esta ação não pode ser desfeita.`
          : ''}
        confirmLabel="Excluir Processo"
        loading={deleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISE INICIAL TAB
   ═══════════════════════════════════════════════════════════════ */
function AnaliseInicialTab({
  projectId, firmId, caseAnalysis, loading, C, clientName,
  checkedDocs, setCheckedDocs, expandedDocCards, setExpandedDocCards,
  onAnalysisUpdated, setToast,
}: {
  projectId: string
  firmId: string
  caseAnalysis: CaseAnalysis | null
  loading: boolean
  C: ReturnType<typeof getColors>
  clientName: string
  checkedDocs: Set<number>
  setCheckedDocs: (s: Set<number>) => void
  expandedDocCards: Set<string>
  setExpandedDocCards: (s: Set<string>) => void
  onAnalysisUpdated: (a: CaseAnalysis) => void
  setToast: (t: { message: string; type: 'success' | 'error' } | null) => void
}) {

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
      <Loader2 size={28} style={{ color: C.amber, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (!caseAnalysis) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <BarChart3 size={48} style={{ margin: '0 auto 16px', color: C.text4, display: 'block' }} />
      <p style={{ fontSize: '16px', fontWeight: 600, color: C.text2, margin: '0 0 8px' }}>Análise não encontrada</p>
      <p style={{ fontSize: '13px', color: C.text4, margin: 0, lineHeight: 1.6, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
        A análise inicial ainda não foi gerada para este processo.<br />
        Crie um novo processo para iniciar a extração e análise dos documentos.
      </p>
    </div>
  )

  const SectionHeader = ({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) => (
    <div style={{ padding: '11px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
      {icon}
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
        {sub && <div style={{ fontSize: '10px', color: C.text4, marginTop: '1px' }}>{sub}</div>}
      </div>
    </div>
  )

  const Card = ({ children, accent }: { children: React.ReactNode; accent?: string }) => (
    <div style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${accent || C.border2}`, overflow: 'hidden', marginBottom: '12px' }}>
      {children}
    </div>
  )

  const LabelValue = ({ label, value }: { label: string; value: string | undefined | null }) =>
    value && value !== '' && value !== 'Não identificado' ? (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
        <div style={{ fontSize: '12px', color: C.text1, fontWeight: 500, marginTop: '2px', lineHeight: 1.4 }}>{value}</div>
      </div>
    ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Risk + export header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.text1 }}>Ficha do Processo</div>
          <div style={{ fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', marginTop: '1px' }}>Extração e análise estruturada por IA Jurídica</div>
        </div>
        {caseAnalysis.risco_preliminar && <RiskBadge risco={caseAnalysis.risco_preliminar} C={C} />}
      </div>

      {/* DADOS DO PROCESSO */}
      <Card>
        <SectionHeader icon={<MapPin size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Dados do Processo" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <LabelValue label="Número CNJ" value={caseAnalysis.dados_processo?.numero_cnj} />
          <LabelValue label="Juiz(a)" value={caseAnalysis.dados_processo?.juiz} />
          <LabelValue label="Comarca" value={caseAnalysis.dados_processo?.comarca} />
          <LabelValue label="Vara" value={caseAnalysis.dados_processo?.vara} />
          <LabelValue label="Localização" value={caseAnalysis.dados_processo?.localizacao} />
          <LabelValue label="Data de Distribuição" value={caseAnalysis.dados_processo?.data_distribuicao} />
        </div>
      </Card>

      {/* PARTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
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
            ? { ...caseAnalysis.partes.reu, nome: caseAnalysis.partes.reu.nome || clientName }
            : { nome: clientName, cpf_cnpj: '', rg: '', nacionalidade: '', estado_civil: '', profissao: '', data_nascimento: '', email: '', endereco: { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' }, telefone: '', outras_info: '', advogados: [] }
          }
          accent={C.greenBorder}
          icon={<ShieldCheck size={13} style={{ color: C.green, flexShrink: 0 }} />}
          C={C}
        />
      </div>

      {/* OBJETO DA AÇÃO */}
      {caseAnalysis.objeto_da_acao && (
        <Card>
          <SectionHeader icon={<List size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Objeto da Ação" sub="Bem, relação jurídica ou objeto central da disputa" />
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {caseAnalysis.objeto_da_acao.tipo && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '5px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: '11px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', width: 'fit-content' }}>
                {caseAnalysis.objeto_da_acao.tipo}
              </span>
            )}
            {caseAnalysis.objeto_da_acao.descricao && caseAnalysis.objeto_da_acao.descricao !== '' && (
              <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.6, padding: '10px 12px', borderRadius: '7px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                {caseAnalysis.objeto_da_acao.descricao}
              </div>
            )}
            {(caseAnalysis.objeto_da_acao.detalhes || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 16px' }}>
                {caseAnalysis.objeto_da_acao.detalhes.map((d, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d.campo}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.text1, marginTop: '2px', lineHeight: 1.4 }}>{d.valor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* VALORES */}
      <Card>
        <SectionHeader icon={<Banknote size={13} style={{ color: C.amber, flexShrink: 0 }} />} label="Valores Envolvidos" />
        <div style={{ padding: '0 16px' }}>
          {(caseAnalysis.valores?.itens || []).filter(it => it.valor && it.valor !== 'Não identificado' && it.valor !== '').map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.border1}`, gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: C.text1, fontWeight: 500 }}>{it.descricao}</div>
                {it.fundamento && it.fundamento !== '' && (
                  <div style={{ fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>{it.fundamento}</div>
                )}
              </div>
              <span style={{ fontSize: '12px', color: C.text1, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>{it.valor}</span>
            </div>
          ))}
          {(caseAnalysis.valores?.itens || []).length === 0 && (
            <div style={{ padding: '12px 0', fontSize: '11px', color: C.text4, fontStyle: 'italic' }}>Valores não identificados</div>
          )}
          {caseAnalysis.valores?.total && caseAnalysis.valores.total !== 'Não identificado' && caseAnalysis.valores.total !== '' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', margin: '8px 0 12px', borderRadius: '7px', background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: C.amber, fontFamily: 'IBM Plex Mono, monospace' }}>TOTAL PLEITEADO</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: C.amber, fontFamily: 'IBM Plex Mono, monospace' }}>{caseAnalysis.valores.total}</span>
            </div>
          )}
        </div>
      </Card>

      {/* ALEGAÇÃO PRINCIPAL */}
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
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Fatos Narrados pelo Autor</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {caseAnalysis.fatos_narrados.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '7px 10px', borderRadius: '6px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                    <span style={{ color: C.amber, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', marginTop: '2px', minWidth: '18px' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* FUNDAMENTO JURÍDICO */}
      <Card>
        <SectionHeader icon={<Gavel size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Fundamento Jurídico" sub="Base legal, teses e pedidos do autor" />
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(caseAnalysis.fundamento_juridico?.base_legal || []).length > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Base Legal</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {caseAnalysis.fundamento_juridico.base_legal.map((b, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, fontSize: '11px', color: C.blue, fontFamily: 'IBM Plex Mono, monospace' }}>
                    <LinkIcon size={9} /> {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(caseAnalysis.fundamento_juridico?.teses || []).length > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Teses do Autor</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {caseAnalysis.fundamento_juridico.teses.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '6px 10px', borderRadius: '6px', background: C.bg3 }}>
                    <span style={{ color: C.blue, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', marginTop: '2px', minWidth: '18px' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(caseAnalysis.fundamento_juridico?.pedidos || []).length > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Pedidos ao Juiz</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {caseAnalysis.fundamento_juridico.pedidos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text2, lineHeight: 1.5, padding: '7px 10px', borderRadius: '6px', background: C.redBg, border: `1px solid ${C.redBorder}` }}>
                    <span style={{ color: C.red, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', marginTop: '2px', minWidth: '18px', fontWeight: 700 }}>{i + 1}.</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* PROVAS FORNECIDAS */}
      {(caseAnalysis.provas_fornecidas || []).length > 0 && (
        <Card>
          <SectionHeader
            icon={<FileText size={13} style={{ color: C.blue, flexShrink: 0 }} />}
            label={`Provas Fornecidas (${caseAnalysis.provas_fornecidas.length})`}
            sub="Documentos apresentados pela parte autora"
          />
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {caseAnalysis.provas_fornecidas.map((prova: ProvaFornecida, i: number) => {
              const isExp = expandedDocCards.has(String(i))
              return (
                <div key={i} style={{ borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border2}`, overflow: 'hidden' }}>
                  <button
                    onClick={() => {
                      const next = new Set(expandedDocCards)
                      next.has(String(i)) ? next.delete(String(i)) : next.add(String(i))
                      setExpandedDocCards(next)
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <FileText size={12} style={{ color: C.blue, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: C.text1 }}>📄 {prova.documento}</span>
                        {prova.tipo && prova.tipo !== '' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '4px', background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
                            {prova.tipo}
                          </span>
                        )}
                      </div>
                      {prova.resumo && (
                        <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5, marginTop: '3px' }}>
                          {prova.resumo}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={12} style={{ color: C.text4, flexShrink: 0, transform: isExp ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
                  </button>
                  {isExp && (
                    <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${C.border1}`, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                      {prova.conteudo_principal && (
                        <div>
                          <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Conteúdo Principal</div>
                          <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.6 }}>{prova.conteudo_principal}</div>
                        </div>
                      )}
                      {prova.como_autor_usa && (
                        <div style={{ padding: '8px 10px', borderRadius: '6px', background: C.blueBg, border: `1px solid ${C.blueBorder}` }}>
                          <div style={{ fontSize: '9px', color: C.blue, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 700 }}>Como o Autor Usa</div>
                          <div style={{ fontSize: '12px', color: C.blue, lineHeight: 1.6 }}>{prova.como_autor_usa}</div>
                        </div>
                      )}
                      {prova.tese_que_embasa && (
                        <div>
                          <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Tese que Embasa</div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '12px', color: C.text2, lineHeight: 1.6 }}>
                            <span style={{ color: C.amber, flexShrink: 0 }}>→</span>
                            <span>{prova.tese_que_embasa}</span>
                          </div>
                        </div>
                      )}
                      {prova.pontos_de_atencao && (
                        <div style={{ padding: '8px 10px', borderRadius: '6px', background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
                          <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 700 }}>⚠ Pontos de Atenção</div>
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

      {/* CRONOLOGIA */}
      {((caseAnalysis.datas_importantes || []).length > 0 || caseAnalysis.prazo_contestacao) && (
        <Card>
          <SectionHeader icon={<Calendar size={13} style={{ color: C.blue, flexShrink: 0 }} />} label="Cronologia" sub="Datas relevantes e prazo para contestação" />
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            {(caseAnalysis.datas_importantes || []).map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border1}` }}>
                <div style={{ fontSize: '10px', color: C.blue, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, minWidth: '110px', paddingTop: '1px', flexShrink: 0 }}>{d.data}</div>
                <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{d.evento}</div>
              </div>
            ))}
            {caseAnalysis.prazo_contestacao && caseAnalysis.prazo_contestacao !== 'A verificar' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 12px', margin: '8px 0 4px', borderRadius: '7px', background: C.redBg, border: `1px solid ${C.redBorder}` }}>
                <div style={{ fontSize: '10px', color: C.red, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, minWidth: '110px', flexShrink: 0 }}>⚠ PRAZO CONTES.</div>
                <div style={{ fontSize: '12px', color: C.red, fontWeight: 600 }}>{caseAnalysis.prazo_contestacao}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CHECKLIST RICO DE DOCUMENTOS (novo — agrupado por categoria) */}
      {caseAnalysis.checklist_documentos
        ? <ChecklistDocumentosCard checklist={caseAnalysis.checklist_documentos} C={C} />
        : /* fallback: old simple list */
        (caseAnalysis.documentos_necessarios_cliente || []).length > 0 && (
          <Card>
            <SectionHeader
              icon={<ClipboardList size={13} style={{ color: C.blue, flexShrink: 0 }} />}
              label="Documentos Necessários do Cliente"
              sub="Solicite estes documentos antes de prosseguir"
            />
            <div style={{ padding: '6px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace' }}>
                {checkedDocs.size}/{caseAnalysis.documentos_necessarios_cliente.length} coletados
              </span>
            </div>
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {caseAnalysis.documentos_necessarios_cliente.map((doc, i) => {
                const isChecked = checkedDocs.has(i)
                return (
                  <div
                    key={i}
                    onClick={() => {
                      const next = new Set(checkedDocs)
                      next.has(i) ? next.delete(i) : next.add(i)
                      setCheckedDocs(next)
                    }}
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
          </Card>
        )
      }
    </div>
  )
}

/* ─── Classification badge colors ─── */
function classifBadgeColors(classificacao: string): { bg: string; color: string; border: string } {
  switch (classificacao) {
    case 'OBRIGATÓRIO':          return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' }
    case 'IMPORTANTE':           return { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' }
    case 'COMPLEMENTAR':         return { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' }
    case 'REQUERIMENTO JUDICIAL': return { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' }
    default:                     return { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' }
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

/* ─── Rich grouped checklist card ─── */
function ChecklistDocumentosCard({
  checklist, C,
}: {
  checklist: ChecklistDocumentos
  C: ReturnType<typeof getColors>
}) {
  const grupos = (checklist.grupos || []).filter(g => g.documentos && g.documentos.length > 0)
  const totalDocs = grupos.reduce((s, g) => s + g.documentos.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{
        borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '11px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <ClipboardList size={13} style={{ color: C.blue, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {checklist.titulo || 'CHECKLIST DE DOCUMENTOS DO CLIENTE'}
              </div>
              {checklist.subtitulo && (
                <div style={{ fontSize: '10px', color: C.text4, marginTop: '1px' }}>{checklist.subtitulo}</div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
            {totalDocs} documentos · {grupos.length} grupos
          </span>
        </div>
      </div>

      {/* Groups */}
      {grupos.map((grupo, gi) => {
        const bc = classifBadgeColors(grupo.classificacao)
        return (
          <div key={gi} style={{
            borderRadius: '10px', background: C.bg2,
            border: `1px solid ${C.border2}`,
            overflow: 'hidden',
          }}>
            {/* Group header */}
            <div style={{
              padding: '10px 14px', background: C.bg3,
              borderBottom: `1px solid ${C.border2}`,
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text1, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                {grupo.nome}
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                background: bc.bg, color: bc.color, border: `1px solid ${bc.border}`,
                flexShrink: 0,
              }}>
                {grupo.classificacao}
              </span>
              <span style={{ fontSize: '10px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
                {grupo.documentos.length} doc{grupo.documentos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Documents */}
            <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {grupo.documentos.map((doc, di) => (
                <div key={di} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px',
                  background: C.bg3, border: `1px solid ${C.border1}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.text1 }}>{doc.nome}</span>
                      <PriorityBadge prioridade={doc.prioridade} C={C} />
                    </div>
                    <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5 }}>{doc.justificativa}</div>
                  </div>
                  {/* Status checkboxes */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', marginTop: '2px' }}>
                    {(['Rec', 'Dig', 'Jun'] as const).map(label => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '3px',
                          border: `1.5px solid ${C.border3}`, background: C.bg2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }} />
                        <span style={{ fontSize: '8px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Strategic observations */}
      {(checklist.observacoes_estrategicas || []).length > 0 && (
        <div style={{
          borderRadius: '10px', background: C.amberBg,
          border: `2px solid ${C.amberBorder}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.amberBorder}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <AlertCircle size={13} style={{ color: C.amber, flexShrink: 0 }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: C.amber, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Observações Estratégicas do Advogado
            </div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {checklist.observacoes_estrategicas.map((obs, oi) => {
              const obc = obsBadgeColors(obs.tipo)
              return (
                <div key={oi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                    padding: '3px 9px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                    fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.05em', marginTop: '1px',
                    background: obc.bg, color: obc.color, border: `1px solid ${obc.border}`,
                  }}>
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

/* ═══════════════════════════════════════════════════════════════
   DOCUMENTOS TAB — REDESIGNED
   Split: Parte Autora (plaintiff) | Cliente (our side)
   ═══════════════════════════════════════════════════════════════ */

const CLIENT_CATEGORIES = [
  'Contrato Assinado',
  'Correspondência (WhatsApp/Email)',
  'Comprovante de Pagamento',
  'Recibo',
  'Gravação/Áudio',
  'Documento de Identidade',
  'Procuração',
  'Outro',
]

function DocStatusIcon({ status, C }: { status: string; C: ReturnType<typeof getColors> }) {
  switch (status) {
    case 'pending': return <Clock size={14} style={{ color: C.text3 }} />
    case 'processing': return <Loader2 size={14} style={{ color: C.blue, animation: 'spin 1s linear infinite' }} />
    case 'completed': return <CheckCircle2 size={14} style={{ color: C.green }} />
    case 'error': return <XCircle size={14} style={{ color: C.red }} />
    default: return <Clock size={14} style={{ color: C.text3 }} />
  }
}

function DocStatusBadge({ status, C }: { status: string; C: ReturnType<typeof getColors> }): React.CSSProperties {
  switch (status) {
    case 'pending': return { background: C.bg3, color: C.text3, border: `1px solid ${C.border2}` }
    case 'processing': return { background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}` }
    case 'completed': return { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }
    case 'error': return { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }
    default: return { background: C.bg3, color: C.text3, border: `1px solid ${C.border2}` }
  }
}

function DocRow({ doc, C }: { doc: Document; C: ReturnType<typeof getColors> }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 14px', borderRadius: '7px',
      background: C.bg1, border: `1px solid ${C.border1}`,
    }}>
      <DocStatusIcon status={doc.processing_status} C={C} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 500, margin: 0, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.name}
        </p>
        <p style={{ fontSize: '10px', color: C.text4, margin: '2px 0 0', fontFamily: 'IBM Plex Mono, monospace' }}>
          {doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : ''}
          {doc.document_category && (
            <span style={{ marginLeft: '8px', color: C.text3 }}>{doc.document_category}</span>
          )}
          {doc.created_at && (
            <span style={{ marginLeft: '8px' }}>{formatDate(doc.created_at)}</span>
          )}
          {doc.processing_error && <span style={{ color: C.red }}> — {doc.processing_error}</span>}
        </p>
      </div>
      <span style={{
        padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
        flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace',
        ...DocStatusBadge({ status: doc.processing_status, C }),
      }}>
        {statusLabel(doc.processing_status)}
      </span>
    </div>
  )
}

function DocumentosTab({
  projectId, firmId, C, onAnalysisRerun, setToast,
}: {
  projectId: string
  firmId: string
  C: ReturnType<typeof getColors>
  onAnalysisRerun: (analysis: CaseAnalysis) => void
  setToast: (t: { message: string; type: 'success' | 'error' } | null) => void
}) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [clientDragOver, setClientDragOver] = useState(false)
  const [plaintiffDragOver, setPlaintiffDragOver] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [clientCategory, setClientCategory] = useState('Contrato Assinado')
  const clientFileRef = useRef<HTMLInputElement>(null)
  const plaintiffFileRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    setDocuments((data || []) as Document[])
    setLoading(false)
  }, [projectId])

  useEffect(() => { loadDocs() }, [loadDocs])

  // Determine doc source: prefer doc_source column, fall back to category heuristic
  const isClientDoc = (doc: Document): boolean => {
    if (doc.doc_source === 'cliente') return true
    if (doc.doc_source === 'parte_autora') return false
    // Fallback: if category exactly matches a client-only category
    const clientOnlyCategories = ['Contrato Assinado', 'Correspondência (WhatsApp/Email)', 'Comprovante de Pagamento', 'Recibo', 'Gravação/Áudio', 'Documento de Identidade']
    return clientOnlyCategories.includes(doc.document_category || '')
  }

  const plaintiffDocs = documents.filter(d => !isClientDoc(d))
  const clientDocs = documents.filter(d => isClientDoc(d))

  const uploadFiles = useCallback(async (files: FileList | File[], source: 'parte_autora' | 'cliente', category: string) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('project_id', projectId)
    formData.append('firm_id', firmId)
    formData.append('doc_source', source)
    Array.from(files).forEach((file, i) => {
      formData.append(`file_${i}`, file)
      formData.append(`category_${i}`, category)
      formData.append(`doc_source_${i}`, source)
    })
    await fetch('/api/upload-documents', { method: 'POST', body: formData })
    await loadDocs()
    setUploading(false)
    setToast({ message: `${files.length} documento(s) enviados com sucesso`, type: 'success' })
  }, [projectId, firmId, loadDocs, setToast])

  const handleReanalyze = useCallback(async () => {
    setReanalyzing(true)
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*, document_extractions(*)')
        .eq('project_id', projectId)

      if (!docs || docs.length === 0) {
        setToast({ message: 'Nenhum documento encontrado para reanálise', type: 'error' })
        return
      }

      const peticaoDoc = docs.find((d: Record<string, unknown>) =>
        (d.document_category as string | null) === 'Petição Inicial'
      )
      const peticaoExts = (peticaoDoc?.document_extractions || []) as { raw_extraction: Record<string, unknown> }[]
      const peticaoExtracted = peticaoExts?.[0]?.raw_extraction || {}

      const supportingDocs = docs
        .filter((d: Record<string, unknown>) =>
          (d.document_category as string | null) !== 'Petição Inicial' &&
          (d.document_extractions as unknown[])?.length > 0
        )
        .map((d: Record<string, unknown>) => {
          const exts = d.document_extractions as { raw_extraction: Record<string, unknown> }[]
          return {
            fileName: d.name as string,
            category: (d.document_category as string) || 'Outro',
            extracted: exts?.[0]?.raw_extraction || {},
          }
        })

      const res = await fetch('/api/analyze-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          peticao_extracted: peticaoExtracted,
          supporting_docs: supportingDocs,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.analysis) throw new Error(data.error || 'Falha na análise')

      const newAnalysis = data.analysis as CaseAnalysis
      await supabase.from('case_strategies').delete().eq('project_id', projectId).eq('status', 'analise_inicial')
      await supabase.from('case_strategies').insert({
        project_id: projectId,
        firm_id: firmId,
        status: 'analise_inicial',
        draft_tipo: 'analise_inicial',
        draft_peca: JSON.stringify({ caseAnalysis: newAnalysis }),
        tese_principal: 'Análise inicial re-executada',
        teses_subsidiarias: [],
        jurisprudencia_favoravel: [],
        jurisprudencia_desfavoravel: [],
        risco_estimado: newAnalysis.risco_preliminar || 'medio',
        recomendacao: 'Análise atualizada',
      })

      onAnalysisRerun(newAnalysis)
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Erro ao reanalisar', type: 'error' })
    } finally {
      setReanalyzing(false)
    }
  }, [projectId, firmId, onAnalysisRerun, setToast])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <Loader2 size={24} style={{ color: C.amber, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const hasPlaintiffDocs = plaintiffDocs.length > 0
  const hasClientDocs = clientDocs.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ──────────────────────────────────────────────────────────
          SECTION 1: Documentos da Parte Autora
          ────────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: '10px',
        background: C.bg2,
        border: `1px solid ${C.border2}`,
        borderLeft: `4px solid #EF4444`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          background: '#EF444408',
          borderBottom: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📁</span>
              <span>Documentos da Parte Autora</span>
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                background: '#EF444415', color: '#EF4444', border: '1px solid #EF444430',
                fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
              }}>
                {plaintiffDocs.length} doc{plaintiffDocs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: C.text4, marginTop: '3px' }}>
              Petição inicial + anexos recebidos da parte adversa
            </div>
          </div>
          {/* Small "add more" link for court additional docs */}
          <button
            onClick={() => plaintiffFileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: C.text3, background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 8px', borderRadius: '5px',
              transition: 'color 150ms', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444' }}
            onMouseLeave={e => { e.currentTarget.style.color = C.text3 }}
          >
            <Plus size={11} />+ Adicionar
          </button>
          <input
            ref={plaintiffFileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
            onChange={e => e.target.files && uploadFiles(e.target.files, 'parte_autora', 'Petição Inicial')}
          />
        </div>

        {/* Doc list */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {plaintiffDocs.length === 0 ? (
            <p style={{ fontSize: '12px', color: C.text4, fontStyle: 'italic', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Nenhum documento da parte autora encontrado.
            </p>
          ) : (
            plaintiffDocs.map(doc => <DocRow key={doc.id} doc={doc} C={C} />)
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          SECTION 2: Documentos do Cliente (Polo Passivo)
          ────────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: '10px',
        background: C.bg2,
        border: `1px solid ${C.border2}`,
        borderLeft: `4px solid #22C55E`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          background: '#22C55E08',
          borderBottom: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📁</span>
              <span>Documentos do Nosso Cliente</span>
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                background: '#22C55E15', color: '#22C55E', border: '1px solid #22C55E30',
                fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
              }}>
                {clientDocs.length} doc{clientDocs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: C.text4, marginTop: '3px' }}>
              Documentos fornecidos pelo cliente para embasar a defesa
            </div>
          </div>
        </div>

        {/* Upload area for client docs */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border1}` }}>
          {/* Category selector */}
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
              Tipo de documento:
            </label>
            <select
              value={clientCategory}
              onChange={e => setClientCategory(e.target.value)}
              style={{
                fontSize: '12px', color: C.text1, background: C.bg3,
                border: `1px solid ${C.border2}`, borderRadius: '6px',
                padding: '5px 10px', flex: 1, maxWidth: '280px',
                cursor: 'pointer', outline: 'none',
              }}
            >
              {CLIENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Drag-and-drop upload zone */}
          <div
            onDragOver={e => { e.preventDefault(); setClientDragOver(true) }}
            onDragLeave={() => setClientDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setClientDragOver(false)
              if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files, 'cliente', clientCategory)
            }}
            onClick={() => clientFileRef.current?.click()}
            style={{
              padding: '28px 20px',
              borderRadius: '10px',
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'border-color 200ms ease, background 200ms ease',
              background: clientDragOver ? '#22C55E10' : C.bg3,
              border: `2px dashed ${clientDragOver ? '#22C55E' : '#22C55E50'}`,
            }}
          >
            <Upload size={26} style={{ margin: '0 auto 10px', color: clientDragOver ? '#22C55E' : '#22C55E80', display: 'block' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: clientDragOver ? '#22C55E' : C.text2, margin: 0 }}>
              {uploading ? 'Enviando...' : '⬆ Enviar Documentos do Cliente'}
            </p>
            <p style={{ fontSize: '11px', color: C.text4, marginTop: '5px', margin: '5px 0 0' }}>
              PDF, DOCX, TXT — arraste aqui ou clique para selecionar
            </p>
            <input
              ref={clientFileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              style={{ display: 'none' }}
              onChange={e => e.target.files && uploadFiles(e.target.files, 'cliente', clientCategory)}
            />
          </div>
        </div>

        {/* Client doc list */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {clientDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: '12px', color: C.text4, margin: 0 }}>
                {hasPlaintiffDocs
                  ? '⏳ Aguardando documentos do cliente para iniciar análise cruzada'
                  : 'Nenhum documento do cliente enviado ainda.'}
              </p>
            </div>
          ) : (
            clientDocs.map(doc => <DocRow key={doc.id} doc={doc} C={C} />)
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          SECTION 3: Action Buttons
          ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        background: C.bg2,
        border: `1px solid ${C.border2}`,
        display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {hasPlaintiffDocs && hasClientDocs ? (
          <>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '7px',
                background: reanalyzing ? C.bg3 : C.amberBg,
                border: `1px solid ${reanalyzing ? C.border2 : C.amberBorder}`,
                color: reanalyzing ? C.text4 : C.amber,
                cursor: reanalyzing ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace',
                transition: 'all 150ms ease',
              }}
            >
              {reanalyzing
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={14} />}
              {reanalyzing ? 'Reanalisando...' : '🔄 Rodar Análise Completa'}
            </button>
            <button
              disabled
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '7px',
                background: C.blueBg,
                border: `1px solid ${C.blueBorder}`,
                color: C.blue,
                cursor: 'not-allowed',
                fontWeight: 600, fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace',
                opacity: 0.7,
              }}
              title="Em breve — conectará os documentos do cliente com os da parte autora"
            >
              <BookOpen size={14} />
              🔍 Iniciar Análise Cruzada
            </button>
            <span style={{ fontSize: '11px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', marginLeft: 'auto' }}>
              {documents.length} doc(s) total · {plaintiffDocs.length} autora · {clientDocs.length} cliente
            </span>
          </>
        ) : (
          <>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing || documents.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '7px',
                background: reanalyzing ? C.bg3 : C.amberBg,
                border: `1px solid ${reanalyzing ? C.border2 : C.amberBorder}`,
                color: reanalyzing ? C.text4 : C.amber,
                cursor: (reanalyzing || documents.length === 0) ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace',
                transition: 'all 150ms ease',
              }}
            >
              {reanalyzing
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={14} />}
              {reanalyzing ? 'Reanalisando...' : '🔄 Rodar Análise Novamente'}
            </button>
            {hasPlaintiffDocs && !hasClientDocs && (
              <span style={{
                fontSize: '11px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                ⏳ Aguardando documentos do cliente para iniciar análise cruzada
              </span>
            )}
            <span style={{ fontSize: '11px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', marginLeft: 'auto' }}>
              {documents.length} doc(s)
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISE CRUZADA TAB
   ═══════════════════════════════════════════════════════════════ */
function AnaliseCruzadaTab({ C }: { C: ReturnType<typeof getColors> }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <BookOpen size={48} style={{ margin: '0 auto 16px', color: C.text4, display: 'block' }} />
      <p style={{ fontSize: '16px', fontWeight: 600, color: C.text2, margin: '0 0 8px' }}>Análise Cruzada</p>
      <p style={{ fontSize: '13px', color: C.text4, margin: 0, lineHeight: 1.6, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
        A análise cruzada compara os documentos da parte autora com os documentos do seu cliente,
        identificando contradições e inconsistências.<br /><br />
        Para gerar a análise cruzada, use o modal <strong style={{ color: C.amber }}>"📎 Enviar Docs do Cliente"</strong> e execute a fase 2 do processo.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ESTRATÉGIA & DEFESA TAB
   ═══════════════════════════════════════════════════════════════ */
function EstratégiaTab({
  C, strategyRecord,
}: {
  C: ReturnType<typeof getColors>
  strategyRecord: Record<string, unknown> | null
}) {
  if (!strategyRecord) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Scale size={48} style={{ margin: '0 auto 16px', color: C.text4, display: 'block' }} />
        <p style={{ fontSize: '16px', fontWeight: 600, color: C.text2, margin: '0 0 8px' }}>Estratégia & Defesa</p>
        <p style={{ fontSize: '13px', color: C.text4, margin: 0, lineHeight: 1.6, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
          A estratégia de defesa ainda não foi gerada.<br /><br />
          Para gerar a estratégia, execute as fases 2 e 3 do processo: envie os documentos do cliente e
          aguarde a pesquisa jurisprudencial e geração da contestação.
        </p>
      </div>
    )
  }

  const tese = strategyRecord.tese_principal as string | undefined
  const tesesSub = (strategyRecord.teses_subsidiarias || []) as string[]
  const risco = strategyRecord.risco_estimado as string | undefined
  const recomendacao = strategyRecord.recomendacao as string | undefined
  const valorRisco = strategyRecord.valor_risco_estimado as string | number | undefined
  const draft = (strategyRecord.draft_peca || strategyRecord.draft) as string | undefined
  const prob = strategyRecord.probabilidade_exito as number | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '12px', alignItems: 'stretch' }}>
        {/* Probability */}
        {prob !== undefined && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 20px', borderRadius: '10px',
            background: C.bg2, border: `1px solid ${C.border2}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Êxito</div>
            <div style={{ fontSize: '40px', fontWeight: 800, color: prob >= 70 ? C.green : prob >= 40 ? C.amber : C.red, lineHeight: 1, fontFamily: 'IBM Plex Mono, monospace' }}>
              {prob}%
            </div>
          </div>
        )}
        {/* Recomendação */}
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}` }}>
          <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Recomendação</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.amber }}>{recomendacao || '—'}</div>
        </div>
        {/* Risco */}
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}` }}>
          <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Risco Estimado</div>
          {risco && <RiskBadge risco={risco} C={C} />}
          {valorRisco && <div style={{ fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '6px' }}>Valor: {String(valorRisco)}</div>}
        </div>
      </div>

      {/* Tese principal */}
      {tese && (
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.amberBg, border: `2px solid ${C.amberBorder}` }}>
          <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>Tese Principal de Defesa</div>
          <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.6, fontWeight: 500 }}>{tese}</div>
        </div>
      )}

      {/* Teses subsidiárias */}
      {tesesSub.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}` }}>
          <div style={{ fontSize: '9px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700 }}>Teses Subsidiárias ({tesesSub.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tesesSub.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: C.bg3, border: `1px solid ${C.border1}` }}>
                <span style={{ color: C.amber, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
                <span style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minuta da contestação */}
      {draft && draft !== 'analise_inicial' && (
        <div style={{ borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border2}`, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', background: C.bg3, borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Gavel size={13} style={{ color: C.blue, flexShrink: 0 }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: C.text2, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Minuta da Contestação</div>
          </div>
          <div style={{
            padding: '20px 24px',
            maxHeight: '480px', overflowY: 'auto',
            fontSize: '13px', lineHeight: 1.7, color: C.text1,
            whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
          }}>
            {draft}
          </div>
        </div>
      )}
    </div>
  )
}
