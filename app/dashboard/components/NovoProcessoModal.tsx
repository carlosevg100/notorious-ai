'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Upload, CheckCircle2, Loader2, FileText,
  AlertCircle, Trash2, ChevronDown, ChevronRight,
  Scale, BookOpen, TrendingUp, TrendingDown, Edit3, Save,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'

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

type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]

interface TaggedFile {
  id: string
  file: File
  category: DocumentCategory
}

interface Client {
  id: string
  name: string
}

interface PeticaoExtracted {
  numero_processo: string | null
  nome_processo: string | null
  tipo_acao: string | null
  autor: string | null
  reu: string | null
  vara: string | null
  comarca: string | null
  valor_causa: string | null
  pedidos: string | null
  prazos: string | null
  tipo: string | null
  area: string | null
}

interface SupportingExtracted {
  doc_type: string | null
  summary: string | null
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
  category: DocumentCategory
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

interface NovoProcessoModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  preSelectedClientId?: string | null
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
    { n: 4, label: 'Pesquisa' },
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
                fontFamily: 'IBM Plex Mono, monospace',
                background: isDone ? C.green : isActive ? C.amber : C.bg3,
                color: isDone ? '#fff' : isActive ? '#fff' : C.text3,
                border: `2px solid ${isDone ? C.green : isActive ? C.amber : C.border2}`,
                transition: 'all 300ms ease',
              }}>
                {isDone ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
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
  value, onChange, disabled, C,
}: {
  value: DocumentCategory
  onChange: (v: DocumentCategory) => void
  disabled?: boolean
  C: ReturnType<typeof getColors>
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as DocumentCategory)}
        style={{
          appearance: 'none',
          padding: '5px 28px 5px 10px',
          borderRadius: '6px',
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          color: disabled ? C.text3 : C.text1,
          fontSize: '11px',
          fontFamily: 'IBM Plex Mono, monospace',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          minWidth: '140px',
        }}
      >
        {DOCUMENT_CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: 'absolute', right: '8px', pointerEvents: 'none',
          color: disabled ? C.text4 : C.text3,
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
      fontFamily: 'IBM Plex Mono, monospace',
      letterSpacing: '0.06em', flexShrink: 0,
    }}>
      {tribunal}
    </span>
  )
}

/* ─── Jurisprudência card ────────────────────────────────────── */
function JurisprudenciaCard({
  item, type, C,
}: {
  item: JurisprudenciaItem
  type: 'favorable' | 'unfavorable'
  C: ReturnType<typeof getColors>
}) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = type === 'favorable' ? C.greenBorder : C.redBorder
  const badgeBg = type === 'favorable' ? C.greenBg : C.redBg

  return (
    <div style={{
      borderRadius: '8px',
      background: C.bg2,
      border: `1px solid ${borderColor}`,
      padding: '10px 12px',
      transition: 'all 150ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <TribunalBadge tribunal={item.tribunal} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: C.text1,
            fontFamily: 'IBM Plex Mono, monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.numero}
          </div>
          <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '1px' }}>
            {item.data}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: badgeBg, border: 'none', color: type === 'favorable' ? C.green : C.red,
            cursor: 'pointer', padding: '2px 4px', borderRadius: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronRight size={12} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '200ms' }} />
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border1}` }}>
          <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.5, marginBottom: '6px' }}>
            {item.ementa}
          </div>
          {(item.relevancia || item.risco) && (
            <div style={{
              fontSize: '10px', color: type === 'favorable' ? C.green : C.red,
              background: badgeBg, padding: '4px 8px', borderRadius: '4px',
              lineHeight: 1.4,
            }}>
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px', borderRadius: '10px',
      background: C.bg2, border: `1px solid ${C.border2}`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
      }}>
        Probabilidade de Êxito
      </div>
      <div style={{
        fontSize: '48px', fontWeight: 800, color, lineHeight: 1,
        fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em',
      }}>
        {value}%
      </div>
      <div style={{
        marginTop: '6px', padding: '3px 12px', borderRadius: '20px',
        background: color + '20', border: `1px solid ${color}50`,
        fontSize: '11px', fontWeight: 700, color,
      }}>
        {label}
      </div>
      {/* Progress bar */}
      <div style={{
        width: '100%', height: '4px', borderRadius: '2px',
        background: C.bg3, overflow: 'hidden', marginTop: '10px',
      }}>
        <div style={{
          height: '100%', width: `${value}%`, borderRadius: '2px',
          background: color, transition: 'width 800ms ease',
          boxShadow: `0 0 6px ${color}66`,
        }} />
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */

export default function NovoProcessoModal({
  open,
  onClose,
  onSuccess,
  preSelectedClientId,
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

  /* Step 3 state */
  const [peticaoData,    setPeticaoData]    = useState<PeticaoExtracted | null>(null)
  const [allExtractions, setAllExtractions] = useState<FileExtractionResult[]>([])

  /* Step 4 — Research state */
  const [researchLogLines,  setResearchLogLines]  = useState<string[]>([])
  const [researchDone,      setResearchDone]      = useState(false)
  const [researchResults,   setResearchResults]   = useState<ResearchResults | null>(null)
  const [researchError,     setResearchError]     = useState<string | null>(null)

  /* Step 5 — Strategy state */
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
      setStep(1)
      setTaggedFiles([])
      setExtractions([])
      setLogLines([])
      setOverallProgress(0)
      setProjectId(null)
      setGlobalError(null)
      setPeticaoData(null)
      setAllExtractions([])
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
      setSelectedClient(preSelectedClientId || null)
    }
  }, [open, preSelectedClientId])

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

  /* ── Unique ID generator ─────────────────────────────────── */
  function genId() {
    return Math.random().toString(36).slice(2, 10)
  }

  /* ── File drop handler ───────────────────────────────────── */
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

  function addFiles(files: File[]) {
    setTaggedFiles(prev => {
      const existing = [...prev]
      const hasPeticao = existing.some(f => f.category === 'Petição Inicial')
      const newTagged = files.map((file, i) => ({
        id: genId(),
        file,
        category: (!hasPeticao && i === 0)
          ? ('Petição Inicial' as DocumentCategory)
          : ('Outro' as DocumentCategory),
      }))
      return [...existing, ...newTagged]
    })
  }

  function removeFile(id: string) {
    setTaggedFiles(prev => prev.filter(f => f.id !== id))
  }

  function handleCategoryChange(id: string, newCategory: DocumentCategory) {
    setTaggedFiles(prev => prev.map(f => {
      if (f.id === id) return { ...f, category: newCategory }
      if (newCategory === 'Petição Inicial' && f.category === 'Petição Inicial') {
        return { ...f, category: 'Outro' as DocumentCategory }
      }
      return f
    }))
  }

  const hasPeticao = taggedFiles.some(f => f.category === 'Petição Inicial')
  const canProceed = selectedClient && taggedFiles.length > 0 && hasPeticao

  /* ── Add log line ────────────────────────────────────────── */
  function addLog(line: string) {
    setLogLines(prev => [...prev, line])
  }

  function addResearchLog(line: string) {
    setResearchLogLines(prev => [...prev, line])
  }

  /* ── Update extraction status ────────────────────────────── */
  function updateExtraction(id: string, patch: Partial<FileExtractionResult>) {
    setExtractions(prev => prev.map(e => e.taggedFileId === id ? { ...e, ...patch } : e))
  }
  void updateExtraction

  /* ── Main extraction flow ────────────────────────────────── */
  const runExtraction = useCallback(async () => {
    if (!firmId || !selectedClient || taggedFiles.length === 0) return

    setStep(2)
    setGlobalError(null)

    const initialExtractions: FileExtractionResult[] = taggedFiles.map(tf => ({
      taggedFileId: tf.id,
      fileName: tf.file.name,
      category: tf.category,
      status: 'pending',
    }))
    setExtractions(initialExtractions)

    const total = taggedFiles.length

    try {
      addLog('Criando processo no sistema...')

      const projectName = `Novo Processo — ${clients.find(c => c.id === selectedClient)?.name || 'Cliente'}`
      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .insert({
          firm_id: firmId,
          client_id: selectedClient,
          name: projectName,
          fase: 'analise',
          status: 'ativo',
          risk_level: 'medio',
          tipo: 'contencioso',
          area: 'civel',
        })
        .select('id')
        .single()

      if (projectError || !projectRow) {
        throw new Error(`Falha ao criar processo: ${projectError?.message}`)
      }

      const newProjectId = projectRow.id
      setProjectId(newProjectId)
      addLog(`✓ Processo criado [${newProjectId.slice(0, 8)}...]`)

      addLog(`Enviando ${total} documento(s) para armazenamento...`)

      const uploadFormData = new FormData()
      uploadFormData.append('project_id', newProjectId)
      uploadFormData.append('firm_id', firmId)

      taggedFiles.forEach((tf, i) => {
        uploadFormData.append(`file_${i}`, tf.file)
        uploadFormData.append(`category_${i}`, tf.category)
      })

      const uploadRes = await fetch('/api/upload-documents', {
        method: 'POST',
        body: uploadFormData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok || !uploadData.documents) {
        throw new Error(uploadData.error || 'Falha no upload de documentos')
      }

      addLog(`✓ ${total} documento(s) enviados com sucesso`)

      const uploadedDocs = uploadData.documents as {
        field: string; document_id: string; name: string; document_category: string
      }[]

      setExtractions(prev => prev.map(e => {
        const match = uploadedDocs.find(d => d.name === e.fileName)
        return match ? { ...e, documentId: match.document_id } : e
      }))

      const peticaoTagged = taggedFiles.find(f => f.category === 'Petição Inicial')!
      const peticaoUploaded = uploadedDocs.find(d => d.document_category === 'Petição Inicial')!

      addLog(`Extraindo petição inicial: ${peticaoTagged.file.name}...`)
      setExtractions(prev => prev.map(e =>
        e.taggedFileId === peticaoTagged.id ? { ...e, status: 'processing' } : e
      ))

      let peticaoExtracted: PeticaoExtracted | null = null

      try {
        const peticaoFd = new FormData()
        peticaoFd.append('file', peticaoTagged.file)
        peticaoFd.append('document_category', 'Petição Inicial')

        const pRes = await fetch('/api/extract-pdf', { method: 'POST', body: peticaoFd })
        const pData = await pRes.json()

        if (!pRes.ok || !pData.extracted) throw new Error(pData.error || 'Falha na extração')

        peticaoExtracted = pData.extracted as PeticaoExtracted

        await fetch('/api/save-extraction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: peticaoUploaded.document_id,
            project_id: newProjectId,
            document_category: 'Petição Inicial',
            extracted: peticaoExtracted,
            is_peticao: true,
          }),
        })

        setExtractions(prev => prev.map(e =>
          e.taggedFileId === peticaoTagged.id
            ? { ...e, status: 'done', extracted: peticaoExtracted!, documentId: peticaoUploaded.document_id }
            : e
        ))
        addLog(`✓ Petição inicial extraída — ${peticaoExtracted.tipo_acao || 'Tipo identificado'}`)
        if (peticaoExtracted.nome_processo) addLog(`  Processo: ${peticaoExtracted.nome_processo}`)
        if (peticaoExtracted.numero_processo) addLog(`  CNJ: ${peticaoExtracted.numero_processo}`)

        setPeticaoData(peticaoExtracted)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro na extração da petição'
        setExtractions(prev => prev.map(e =>
          e.taggedFileId === peticaoTagged.id ? { ...e, status: 'error', error: msg } : e
        ))
        addLog(`✗ Erro na petição inicial: ${msg}`)
      }

      setOverallProgress(Math.round((1 / total) * 100))

      const supportingFiles = taggedFiles.filter(f => f.category !== 'Petição Inicial')

      if (supportingFiles.length > 0) {
        addLog(`Iniciando extração paralela de ${supportingFiles.length} documento(s) de suporte...`)

        setExtractions(prev => prev.map(e =>
          supportingFiles.some(sf => sf.id === e.taggedFileId)
            ? { ...e, status: 'processing' }
            : e
        ))

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

            await fetch('/api/save-extraction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                document_id: uploaded.document_id,
                project_id: newProjectId,
                document_category: sf.category,
                extracted,
                is_peticao: false,
              }),
            })

            setExtractions(prev => prev.map(e =>
              e.taggedFileId === sf.id
                ? { ...e, status: 'done', extracted, documentId: uploaded.document_id }
                : e
            ))

            totalDone.count++
            addLog(`✓ ${sf.category} extraído (${totalDone.count}/${total}): ${sf.file.name}`)
            setOverallProgress(Math.round((totalDone.count / total) * 100))
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro'
            setExtractions(prev => prev.map(e =>
              e.taggedFileId === sf.id ? { ...e, status: 'error', error: msg } : e
            ))
            totalDone.count++
            addLog(`✗ Erro em ${sf.file.name} (${sfIdx + 2}/${total}): ${msg}`)
            setOverallProgress(Math.round((totalDone.count / total) * 100))
          }
        }))
      }

      setOverallProgress(100)
      addLog('▸ Extração completa. Gerando resumo unificado...')

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

  /* ── Research flow ───────────────────────────────────────── */
  const runResearch = useCallback(async () => {
    if (!firmId || !projectId || !peticaoData) return

    setStep(4)
    setResearchError(null)
    setResearchLogLines([])
    setResearchDone(false)

    const RESEARCH_LOG_STEPS = [
      'Analisando contexto do caso...',
      'Identificando teses de defesa...',
      'Pesquisando jurisprudência no STJ...',
      'Pesquisando jurisprudência nos TJs estaduais...',
      'Analisando precedentes favoráveis...',
      'Identificando riscos e precedentes desfavoráveis...',
      'Calculando probabilidade de êxito...',
    ]

    // Build supporting summaries
    const supportingSummaries = allExtractions
      .filter(e => e.status === 'done' && e.category !== 'Petição Inicial')
      .map(e => {
        const sup = e.extracted as SupportingExtracted
        return sup?.summary ? `[${e.category}] ${sup.summary}` : null
      })
      .filter(Boolean) as string[]

    // Start animated log in background while API runs
    const logPromise = (async () => {
      for (const step_text of RESEARCH_LOG_STEPS) {
        addResearchLog(step_text)
        await new Promise(r => setTimeout(r, 800))
      }
    })()

    // Start research API in parallel
    const apiPromise = fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        firm_id: firmId,
        case_context: {
          tipo_acao: peticaoData.tipo_acao,
          autor: peticaoData.autor,
          reu: peticaoData.reu,
          vara: peticaoData.vara,
          comarca: peticaoData.comarca,
          valor_causa: peticaoData.valor_causa,
          pedidos: peticaoData.pedidos,
          area: peticaoData.area,
          supporting_summaries: supportingSummaries,
        },
      }),
    })

    // Wait for both (log animation + API)
    const [, researchRes] = await Promise.all([logPromise, apiPromise])
    const researchJson = await researchRes.json()

    if (!researchRes.ok || !researchJson.results) {
      setResearchError(researchJson.error || 'Falha na pesquisa jurisprudencial')
      addResearchLog(`✗ Erro na pesquisa: ${researchJson.error || 'Falha desconhecida'}`)
      return
    }

    const results = researchJson.results as ResearchResults
    setResearchResults(results)

    addResearchLog('Elaborando estratégia de defesa...')
    await new Promise(r => setTimeout(r, 600))
    addResearchLog('Gerando minuta da contestação...')

    // Now call strategy API
    setStrategyLoading(true)
    try {
      const stratRes = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          case_context: {
            tipo_acao: peticaoData.tipo_acao,
            autor: peticaoData.autor,
            reu: peticaoData.reu,
            vara: peticaoData.vara,
            comarca: peticaoData.comarca,
            valor_causa: peticaoData.valor_causa,
            pedidos: peticaoData.pedidos,
            area: peticaoData.area,
            numero_processo: peticaoData.numero_processo,
            nome_processo: peticaoData.nome_processo,
            supporting_summaries: supportingSummaries,
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
      addResearchLog('▸ Pesquisa concluída.')
      await new Promise(r => setTimeout(r, 400))
      setResearchDone(true)
      await new Promise(r => setTimeout(r, 600))
      setStep(5)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setStrategyError(msg)
      addResearchLog(`✗ Erro: ${msg}`)
    } finally {
      setStrategyLoading(false)
    }
  }, [firmId, projectId, peticaoData, allExtractions])

  /* ── Re-generate strategy (feedback loop) ────────────────── */
  const regenerateStrategy = useCallback(async () => {
    if (!firmId || !projectId || !researchResults || !peticaoData) return

    setStrategyLoading(true)
    setStrategyError(null)

    const supportingSummaries = allExtractions
      .filter(e => e.status === 'done' && e.category !== 'Petição Inicial')
      .map(e => {
        const sup = e.extracted as SupportingExtracted
        return sup?.summary ? `[${e.category}] ${sup.summary}` : null
      })
      .filter(Boolean) as string[]

    try {
      const stratRes = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          case_context: {
            tipo_acao: peticaoData.tipo_acao,
            autor: peticaoData.autor,
            reu: peticaoData.reu,
            vara: peticaoData.vara,
            comarca: peticaoData.comarca,
            valor_causa: peticaoData.valor_causa,
            pedidos: peticaoData.pedidos,
            area: peticaoData.area,
            numero_processo: peticaoData.numero_processo,
            nome_processo: peticaoData.nome_processo,
            supporting_summaries: supportingSummaries,
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
      const msg = err instanceof Error ? err.message : 'Erro'
      setStrategyError(msg)
    } finally {
      setStrategyLoading(false)
    }
  }, [firmId, projectId, researchResults, peticaoData, allExtractions, adjustFeedback])

  /* ── Save approved strategy ──────────────────────────────── */
  const handleApproveAndSave = useCallback(async () => {
    if (!firmId || !projectId || !strategyData) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/strategy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          firm_id: firmId,
          ...strategyData,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setStrategyError(json.error || 'Falha ao salvar')
        return
      }

      setToast('Estratégia e minuta aprovadas e salvas com sucesso!')
      setTimeout(() => {
        setToast(null)
        onSuccess()
        onClose()
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setStrategyError(msg)
    } finally {
      setIsSaving(false)
    }
  }, [firmId, projectId, strategyData, onSuccess, onClose])

  /* ── Helpers for summary screen ──────────────────────────── */
  function getAllKeyDates(): { date: string | null; description: string; source: string }[] {
    const dates: { date: string | null; description: string; source: string }[] = []
    allExtractions.forEach(e => {
      if (e.status !== 'done' || !e.extracted) return
      const ext = e.extracted as SupportingExtracted
      if (ext.key_dates) {
        ext.key_dates.forEach(d => dates.push({ ...d, source: e.fileName }))
      }
    })
    return dates
  }

  function getAllRiskFlags(): { severity: string; description: string; source: string }[] {
    const flags: { severity: string; description: string; source: string }[] = []
    allExtractions.forEach(e => {
      if (e.status !== 'done' || !e.extracted) return
      const ext = e.extracted as SupportingExtracted
      if (ext.risk_flags) {
        ext.risk_flags.forEach(f => flags.push({ ...f, source: e.fileName }))
      }
    })
    return flags
  }

  function severityColor(sev: string) {
    if (sev === 'alto') return C.red
    if (sev === 'medio') return C.amber
    return C.green
  }

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || ''

  /* ── Modal width based on step ───────────────────────────── */
  const modalWidth = step === 5
    ? 'min(1120px, calc(100vw - 32px))'
    : 'min(700px, calc(100vw - 32px))'

  if (!open) return null

  /* ─── Render ────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          animation: 'fadeIn 150ms ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: modalWidth,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: step === 5 ? 'hidden' : 'auto',
        borderRadius: '14px',
        background: C.bg1,
        border: `1px solid ${C.border2}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        zIndex: 1001,
        animation: 'slideUp 200ms ease',
        transition: 'width 400ms ease',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: C.text1, letterSpacing: '-0.01em' }}>
              Novo Processo
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>
              {step === 1 && 'Etapa 1 de 5 — Upload de documentos'}
              {step === 2 && 'Etapa 2 de 5 — Extração AI em andamento'}
              {step === 3 && 'Etapa 3 de 5 — Resumo unificado'}
              {step === 4 && 'Etapa 4 de 5 — Pesquisa Jurisprudencial'}
              {step === 5 && 'Etapa 5 de 5 — Estratégia de Defesa + Minuta'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'transparent', border: `1px solid ${C.border2}`,
              color: C.text3, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.color = C.text1 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ height: '1px', background: C.border1, margin: '16px 0', flexShrink: 0 }} />

        {/* Body */}
        <div style={{
          padding: step === 5 ? '0 24px' : '0 24px 24px',
          flex: 1,
          overflowY: step === 5 ? 'hidden' : 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flexShrink: 0 }}>
            <StepIndicator step={step} C={C} />
          </div>

          {/* ══ STEP 1: Multi-file upload ══════════════════════ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Client selector */}
              <div>
                <div style={{
                  fontSize: '11px', color: C.text2, fontWeight: 600,
                  marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                    color: C.amber, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0,
                  }}>1</span>
                  Selecione o cliente
                </div>
                {clients.length === 0 ? (
                  <div style={{
                    padding: '16px', borderRadius: '8px',
                    background: C.bg2, border: `1px dashed ${C.border2}`,
                    textAlign: 'center', color: C.text3, fontSize: '12px',
                  }}>
                    Nenhum cliente cadastrado. Crie um cliente primeiro.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '8px',
                    maxHeight: '180px', overflowY: 'auto', paddingRight: '4px',
                  }}>
                    {clients.map(c => {
                      const ac = avatarColor(c.name)
                      const isSelected = selectedClient === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedClient(c.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '8px',
                            background: isSelected ? C.amberBg : C.bg2,
                            border: `2px solid ${isSelected ? C.amber : C.border1}`,
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'all 150ms ease',
                          }}
                        >
                          <span style={{
                            width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                            background: ac + '25', border: `1px solid ${ac}50`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 700, color: ac,
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>
                            {getInitials(c.name)}
                          </span>
                          <span style={{
                            fontSize: '12px', color: isSelected ? C.amber : C.text1,
                            fontWeight: isSelected ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {c.name}
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={14} style={{ color: C.amber, marginLeft: 'auto', flexShrink: 0 }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Multi-file drop zone */}
              <div>
                <div style={{
                  fontSize: '11px', color: C.text2, fontWeight: 600,
                  marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                    color: C.amber, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0,
                  }}>2</span>
                  Adicione os documentos do processo (PDFs)
                </div>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.border2}`,
                    borderRadius: '10px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? C.amberBg : taggedFiles.length > 0 ? C.greenBg : C.bg2,
                    transition: 'all 200ms ease',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Upload size={24} style={{ color: dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.text3 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: dragOver ? C.amber : taggedFiles.length > 0 ? C.green : C.text2 }}>
                        {taggedFiles.length > 0
                          ? `${taggedFiles.length} arquivo(s) — clique para adicionar mais`
                          : 'Arraste PDFs aqui ou clique para selecionar'}
                      </div>
                      <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
                        Aceita múltiplos PDFs — petição inicial + documentos de suporte
                      </div>
                    </div>
                  </div>
                </div>

                {taggedFiles.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    maxHeight: '240px', overflowY: 'auto',
                  }}>
                    {taggedFiles.map(tf => (
                      <div key={tf.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: tf.category === 'Petição Inicial' ? C.amberBg : C.bg2,
                        border: `1px solid ${tf.category === 'Petição Inicial' ? C.amberBorder : C.border1}`,
                        transition: 'all 150ms ease',
                      }}>
                        <FileText size={14} style={{ color: tf.category === 'Petição Inicial' ? C.amber : C.text3, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '12px', fontWeight: 500, color: C.text1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {tf.file.name}
                          </div>
                          <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace' }}>
                            {(tf.file.size / 1024).toFixed(0)} KB
                          </div>
                        </div>
                        <CategoryDropdown
                          value={tf.category}
                          onChange={v => handleCategoryChange(tf.id, v)}
                          C={C}
                        />
                        <button
                          onClick={() => removeFile(tf.id)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            background: 'transparent', border: `1px solid ${C.border2}`,
                            color: C.text3, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 150ms ease', flexShrink: 0,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {taggedFiles.length > 0 && !hasPeticao && (
                  <div style={{
                    marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
                    background: C.redBg, border: `1px solid ${C.redBorder}`,
                    color: C.red, fontSize: '11px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <AlertCircle size={12} />
                    Marque um documento como "Petição Inicial" antes de continuar
                  </div>
                )}
              </div>

              <button
                disabled={!canProceed}
                onClick={runExtraction}
                style={{
                  width: '100%', padding: '13px',
                  borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  border: `1px solid ${canProceed ? C.amber : C.border1}`,
                  background: canProceed ? C.amber : C.bg3,
                  color: canProceed ? '#fff' : C.text4,
                  transition: 'all 200ms ease',
                  fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                }}
              >
                {canProceed
                  ? `Enviar ${taggedFiles.length} documento${taggedFiles.length > 1 ? 's' : ''} para Extração AI →`
                  : !selectedClient
                    ? 'Selecione o cliente primeiro'
                    : taggedFiles.length === 0
                      ? 'Adicione ao menos um PDF'
                      : 'Marque a Petição Inicial'}
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
                  <button
                    onClick={() => { setStep(1); setGlobalError(null) }}
                    style={{
                      padding: '10px 24px', borderRadius: '7px',
                      background: C.bg3, border: `1px solid ${C.border2}`,
                      color: C.text2, cursor: 'pointer', fontSize: '13px',
                    }}
                  >
                    ← Voltar
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.text1, lineHeight: 1.5 }}>
                      Processando <strong style={{ color: C.amber }}>{taggedFiles.length} documento(s)</strong>
                    </div>
                    {selectedClientName && (
                      <div style={{ fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>
                        {selectedClientName}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Progresso geral
                      </span>
                      <span style={{ fontSize: '11px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>
                        {overallProgress}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: C.bg3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${overallProgress}%`, borderRadius: '3px',
                        background: `linear-gradient(90deg, ${C.amber}cc, ${C.amber})`,
                        transition: 'width 400ms ease',
                        boxShadow: `0 0 8px ${C.amber}66`,
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '4px' }}>
                      {extractions.filter(e => e.status === 'done' || e.status === 'error').length} de {taggedFiles.length} documentos concluídos
                    </div>
                  </div>

                  <div style={{
                    borderRadius: '8px', background: C.bg2, border: `1px solid ${C.border1}`,
                    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{
                      fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px',
                    }}>
                      Status por documento
                    </div>
                    {extractions.map(e => (
                      <div key={e.taggedFileId} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '5px 0',
                        borderBottom: `1px solid ${C.border1}`,
                      }}>
                        <FileStatusIcon status={e.status} C={C} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11px', color: C.text1, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {e.fileName}
                          </div>
                          {e.error && (
                            <div style={{ fontSize: '10px', color: C.red, marginTop: '1px' }}>{e.error}</div>
                          )}
                        </div>
                        <span style={{
                          fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                          color: e.status === 'done' ? C.green : e.status === 'error' ? C.red : e.status === 'processing' ? C.amber : C.text4,
                          textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                        }}>
                          {e.category}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    borderRadius: '8px', background: C.bg0, border: `1px solid ${C.border1}`,
                    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '0',
                    maxHeight: '200px', overflowY: 'auto',
                  }}>
                    <div style={{
                      fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <span style={{
                        display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                        background: overallProgress === 100 ? C.green : C.amber,
                        boxShadow: overallProgress === 100 ? `0 0 6px ${C.green}` : `0 0 6px ${C.amber}`,
                        animation: overallProgress === 100 ? 'none' : 'pulse 1.2s ease-in-out infinite',
                      }} />
                      Log de Extração
                    </div>
                    {logLines.map((line, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '2px 0', animation: 'fadeInRow 200ms ease',
                      }}>
                        <span style={{
                          color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.amber : C.text3,
                          fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px',
                          lineHeight: '18px', flexShrink: 0, minWidth: '10px',
                        }}>
                          {line.startsWith('✓') || line.startsWith('✗') || line.startsWith('▸') ? '' : '·'}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: line.startsWith('✓') ? C.green : line.startsWith('✗') ? C.red : line.startsWith('▸') ? C.amber : C.text2,
                          fontFamily: 'IBM Plex Mono, monospace', lineHeight: '18px',
                        }}>
                          {line}
                        </span>
                      </div>
                    ))}
                    {overallProgress < 100 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
                        <Loader2 size={11} style={{ color: C.amber, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace' }}>
                          Processando...
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ STEP 3: Unified Context Summary ══════════════ */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {peticaoData && (
                <div style={{
                  padding: '14px 16px', borderRadius: '10px',
                  background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                }}>
                  <div style={{
                    fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700,
                  }}>
                    Dados do Processo
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[
                      { label: 'Número CNJ',   value: peticaoData.numero_processo },
                      { label: 'Tipo de Ação', value: peticaoData.tipo_acao },
                      { label: 'Autor',        value: peticaoData.autor },
                      { label: 'Réu',          value: peticaoData.reu },
                      { label: 'Vara',         value: peticaoData.vara },
                      { label: 'Comarca',      value: peticaoData.comarca },
                      { label: 'Valor da Causa', value: peticaoData.valor_causa },
                      { label: 'Área',         value: peticaoData.area },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '12px', color: value ? C.text1 : C.text4, fontStyle: value ? 'normal' : 'italic' }}>
                          {value || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {peticaoData.pedidos && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                        Pedidos
                      </div>
                      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>
                        {peticaoData.pedidos}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div style={{
                  fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                }}>
                  Documentos processados ({allExtractions.length || extractions.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(allExtractions.length > 0 ? allExtractions : extractions).map(e => {
                    const sup = e.extracted as SupportingExtracted | undefined
                    return (
                      <div key={e.taggedFileId} style={{
                        padding: '10px 12px', borderRadius: '8px',
                        background: C.bg2, border: `1px solid ${e.status === 'error' ? C.redBorder : C.border1}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: sup?.summary ? '6px' : 0 }}>
                          <FileStatusIcon status={e.status} C={C} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: '12px', fontWeight: 600, color: C.text1,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                            }}>
                              {e.fileName}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                            color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                          }}>
                            {e.category}
                          </span>
                        </div>
                        {sup?.summary && (
                          <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.5, paddingLeft: '22px' }}>
                            {sup.summary}
                          </div>
                        )}
                        {e.error && (
                          <div style={{ fontSize: '11px', color: C.red, paddingLeft: '22px', marginTop: '4px' }}>
                            {e.error}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {getAllKeyDates().length > 0 && (
                <div>
                  <div style={{
                    fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                  }}>
                    Datas-chave identificadas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {getAllKeyDates().slice(0, 8).map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '6px 10px', borderRadius: '6px',
                        background: C.bg2, border: `1px solid ${C.border1}`,
                        fontSize: '11px',
                      }}>
                        <span style={{ color: C.blue, fontFamily: 'IBM Plex Mono, monospace', minWidth: '80px', flexShrink: 0 }}>
                          {d.date || '—'}
                        </span>
                        <span style={{ color: C.text2, flex: 1 }}>{d.description}</span>
                        <span style={{ color: C.text4, fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', flexShrink: 0 }}>
                          {d.source.slice(0, 20)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getAllRiskFlags().length > 0 && (
                <div>
                  <div style={{
                    fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                  }}>
                    Alertas de risco ({getAllRiskFlags().length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {getAllRiskFlags().slice(0, 6).map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '7px 10px', borderRadius: '6px',
                        background: C.bg2, border: `1px solid ${C.border1}`,
                        fontSize: '11px',
                      }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px',
                          borderRadius: '50%', background: severityColor(f.severity),
                          marginTop: '3px', flexShrink: 0,
                        }} />
                        <span style={{ color: C.text2, flex: 1, lineHeight: 1.5 }}>{f.description}</span>
                        <span style={{
                          fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace',
                          color: severityColor(f.severity), textTransform: 'uppercase',
                          letterSpacing: '0.04em', flexShrink: 0,
                        }}>
                          {f.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={runResearch}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer',
                  border: `1px solid ${C.amber}`,
                  background: C.amber, color: '#fff',
                  transition: 'all 200ms ease',
                  fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '4px',
                }}
              >
                <Scale size={16} />
                Prosseguir para Análise e Pesquisa →
              </button>
            </div>
          )}

          {/* ══ STEP 4: Research log ══════════════════════════ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>

              {researchError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                  <AlertCircle size={48} style={{ color: C.red }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>Falha na pesquisa</div>
                    <div style={{ fontSize: '12px', color: C.text3 }}>{researchError}</div>
                  </div>
                  <button
                    onClick={() => { setStep(3); setResearchError(null) }}
                    style={{
                      padding: '10px 24px', borderRadius: '7px',
                      background: C.bg3, border: `1px solid ${C.border2}`,
                      color: C.text2, cursor: 'pointer', fontSize: '13px',
                    }}
                  >
                    ← Voltar ao Resumo
                  </button>
                </div>
              ) : (
                <>
                  {/* Case context reminder */}
                  {peticaoData && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '8px',
                      background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <Scale size={16} style={{ color: C.amber, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: C.amber }}>
                          {peticaoData.tipo_acao || 'Ação em análise'}
                        </div>
                        <div style={{ fontSize: '10px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>
                          {[peticaoData.autor, 'x', peticaoData.reu].filter(Boolean).join(' ')} — {peticaoData.comarca || 'Comarca não informada'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Research log */}
                  <div style={{
                    borderRadius: '10px', background: C.bg0, border: `1px solid ${C.border1}`,
                    padding: '16px 20px', minHeight: '280px',
                  }}>
                    <div style={{
                      fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <span style={{
                        display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                        background: researchDone ? C.green : C.amber,
                        boxShadow: researchDone ? `0 0 6px ${C.green}` : `0 0 6px ${C.amber}`,
                        animation: researchDone ? 'none' : 'pulse 1.2s ease-in-out infinite',
                      }} />
                      Pesquisa Jurisprudencial — IA
                    </div>

                    <div
                      ref={researchLogRef}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {researchLogLines.map((line, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '5px 0',
                          borderBottom: i < researchLogLines.length - 1 ? `1px solid ${C.border1}` : 'none',
                          animation: 'fadeInRow 300ms ease',
                        }}>
                          <span style={{ fontSize: '12px', color: C.text4, fontFamily: 'IBM Plex Mono, monospace', width: '20px', flexShrink: 0 }}>
                            {line.startsWith('✓') ? '✓' : line.startsWith('✗') ? '✗' : line.startsWith('▸') ? '▸' : '·'}
                          </span>
                          <span style={{
                            fontSize: '13px',
                            color: line.startsWith('✓') ? C.green
                              : line.startsWith('✗') ? C.red
                              : line.startsWith('▸') ? C.amber
                              : i === researchLogLines.length - 1 ? C.text1 : C.text2,
                            fontFamily: 'IBM Plex Mono, monospace', lineHeight: '22px',
                            fontWeight: line.startsWith('▸') ? 700 : 400,
                          }}>
                            {line.startsWith('✓') || line.startsWith('✗') || line.startsWith('▸')
                              ? line.slice(2)
                              : line}
                          </span>
                          {i === researchLogLines.length - 1 && !researchDone && !line.startsWith('✓') && !line.startsWith('✗') && !line.startsWith('▸') && (
                            <Loader2 size={12} style={{ color: C.amber, animation: 'spin 1s linear infinite', marginTop: '5px', flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                      {researchLogLines.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Loader2 size={14} style={{ color: C.amber, animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '13px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace' }}>
                            Iniciando pesquisa...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Loading state */}
                  {!researchDone && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '8px',
                      background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <Loader2 size={16} style={{ color: C.amber, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: C.amber }}>
                          Pesquisa em andamento...
                        </div>
                        <div style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>
                          Consultando STJ, STF e tribunais estaduais. Aguarde.
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ STEP 5: Strategy + Draft ══════════════════════ */}
          {step === 5 && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              flex: 1, minHeight: 0,
              paddingBottom: '80px', /* space for action bar */
            }}>
              {strategyLoading && !strategyData && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '16px', padding: '60px 0',
                }}>
                  <Loader2 size={40} style={{ color: C.amber, animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '14px', color: C.text2, fontFamily: 'IBM Plex Mono, monospace' }}>
                    Gerando estratégia e minuta...
                  </div>
                </div>
              )}

              {strategyError && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px',
                  background: C.redBg, border: `1px solid ${C.redBorder}`,
                  color: C.red, fontSize: '12px', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <AlertCircle size={14} />
                  {strategyError}
                </div>
              )}

              {strategyData && (
                <div style={{
                  display: 'flex', gap: '16px', flex: 1, minHeight: 0,
                }}>
                  {/* ── Left column: Strategy ── */}
                  <div style={{
                    flex: '0 0 58%', overflowY: 'auto',
                    paddingRight: '8px',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                  }}>
                    <div style={{
                      fontSize: '10px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <Scale size={12} />
                      ESTRATÉGIA DE DEFESA
                    </div>

                    {/* Probabilidade + Recomendação */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <ProbabilityDisplay value={strategyData.probabilidade_exito} C={C} />

                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '16px', borderRadius: '10px',
                        background: C.bg2, border: `1px solid ${C.border2}`,
                        textAlign: 'center', justifyContent: 'center', gap: '8px',
                      }}>
                        <div style={{
                          fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                        }}>
                          Recomendação
                        </div>
                        <div style={{
                          padding: '6px 14px', borderRadius: '20px',
                          background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                          fontSize: '13px', fontWeight: 700, color: C.amber,
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {strategyData.recomendacao}
                        </div>
                        {strategyData.valor_risco_estimado && (
                          <div style={{
                            fontSize: '10px', color: C.text3,
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>
                            Risco: {strategyData.valor_risco_estimado}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tese Principal */}
                    <div style={{
                      padding: '14px 16px', borderRadius: '10px',
                      background: C.amberBg, border: `2px solid ${C.amberBorder}`,
                    }}>
                      <div style={{
                        fontSize: '9px', color: C.amber, fontFamily: 'IBM Plex Mono, monospace',
                        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <TrendingUp size={10} />
                        TESE PRINCIPAL
                      </div>
                      <div style={{ fontSize: '13px', color: C.text1, lineHeight: 1.6, fontWeight: 500 }}>
                        {strategyData.tese_principal}
                      </div>
                    </div>

                    {/* Teses Subsidiárias */}
                    {strategyData.teses_subsidiarias?.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
                          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                        }}>
                          Teses Subsidiárias ({strategyData.teses_subsidiarias.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.teses_subsidiarias.map((tese, i) => (
                            <div key={i}>
                              <button
                                onClick={() => setExpandedTese(expandedTese === i ? null : i)}
                                style={{
                                  width: '100%', textAlign: 'left',
                                  padding: '10px 12px', borderRadius: '8px',
                                  background: C.bg2, border: `1px solid ${C.border2}`,
                                  cursor: 'pointer', color: C.text1,
                                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                                  transition: 'all 150ms ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = C.border3)}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border2)}
                              >
                                <span style={{
                                  fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace',
                                  color: C.amber, fontWeight: 700, flexShrink: 0, marginTop: '1px',
                                }}>
                                  {String(i + 1).padStart(2, '0')}
                                </span>
                                <span style={{
                                  fontSize: '12px', color: C.text2, flex: 1,
                                  lineHeight: 1.5, textAlign: 'left',
                                  display: expandedTese === i ? 'block' : '-webkit-box',
                                  WebkitLineClamp: expandedTese === i ? undefined : 2,
                                  WebkitBoxOrient: 'vertical' as const,
                                  overflow: 'hidden',
                                }}>
                                  {tese}
                                </span>
                                <ChevronRight size={12} style={{
                                  color: C.text3, flexShrink: 0, marginTop: '2px',
                                  transform: expandedTese === i ? 'rotate(90deg)' : 'none',
                                  transition: '200ms',
                                }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jurisprudência Favorável */}
                    {strategyData.jurisprudencia_favoravel?.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '9px', color: C.green, fontFamily: 'IBM Plex Mono, monospace',
                          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <BookOpen size={10} />
                          JURISPRUDÊNCIA FAVORÁVEL ({strategyData.jurisprudencia_favoravel.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.jurisprudencia_favoravel.map((item, i) => (
                            <JurisprudenciaCard key={i} item={item} type="favorable" C={C} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jurisprudência Desfavorável */}
                    {strategyData.jurisprudencia_desfavoravel?.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '9px', color: C.red, fontFamily: 'IBM Plex Mono, monospace',
                          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <TrendingDown size={10} />
                          RISCOS — JURISPRUDÊNCIA DESFAVORÁVEL ({strategyData.jurisprudencia_desfavoravel.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {strategyData.jurisprudencia_desfavoravel.map((item, i) => (
                            <JurisprudenciaCard key={i} item={item} type="unfavorable" C={C} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ width: '1px', background: C.border2, flexShrink: 0 }} />

                  {/* ── Right column: Draft ── */}
                  <div style={{
                    flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0,
                  }}>
                    <div style={{
                      fontSize: '10px', color: C.blue, fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                    }}>
                      <FileText size={12} />
                      MINUTA DA CONTESTAÇÃO
                    </div>

                    <div
                      ref={draftRef}
                      style={{
                        flex: 1, overflowY: 'auto',
                        padding: '16px',
                        borderRadius: '10px',
                        background: C.bg2,
                        border: `1px solid ${C.border2}`,
                        fontSize: '12px',
                        color: C.text2,
                        lineHeight: '1.7',
                        fontFamily: 'Georgia, serif',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {strategyData.draft}
                    </div>
                  </div>
                </div>
              )}

              {/* Adjust input */}
              {showAdjustInput && (
                <div style={{
                  marginTop: '12px',
                  padding: '14px 16px', borderRadius: '10px',
                  background: C.bg2, border: `1px solid ${C.border2}`,
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '12px', color: C.text2, fontWeight: 600 }}>
                    Instruções para ajuste da estratégia:
                  </div>
                  <textarea
                    value={adjustFeedback}
                    onChange={e => setAdjustFeedback(e.target.value)}
                    placeholder='Ex: "Focar mais na tese de prescrição" ou "Remover argumento sobre dano moral" ou "Incluir argumento de ilegitimidade passiva"'
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      borderRadius: '7px', background: C.bg3,
                      border: `1px solid ${C.border2}`,
                      color: C.text1, fontSize: '12px',
                      lineHeight: 1.5, resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setShowAdjustInput(false); setAdjustFeedback('') }}
                      style={{
                        padding: '8px 16px', borderRadius: '6px',
                        background: 'transparent', border: `1px solid ${C.border2}`,
                        color: C.text3, cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={regenerateStrategy}
                      disabled={!adjustFeedback.trim() || strategyLoading}
                      style={{
                        padding: '8px 16px', borderRadius: '6px',
                        background: adjustFeedback.trim() ? C.amber : C.bg3,
                        border: `1px solid ${adjustFeedback.trim() ? C.amber : C.border2}`,
                        color: adjustFeedback.trim() ? '#fff' : C.text4,
                        cursor: adjustFeedback.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      {strategyLoading
                        ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                        : <><Edit3 size={12} /> Regenerar</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step 5 Action Bar ─────────────────────────────── */}
        {step === 5 && strategyData && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '14px 24px',
            background: C.bg1,
            borderTop: `1px solid ${C.border2}`,
            display: 'flex', alignItems: 'center', gap: '10px',
            borderRadius: '0 0 14px 14px',
          }}>
            <button
              onClick={() => setStep(4)}
              style={{
                padding: '10px 16px', borderRadius: '7px',
                background: 'transparent', border: `1px solid ${C.border2}`,
                color: C.text3, cursor: 'pointer', fontSize: '12px',
                fontFamily: 'IBM Plex Mono, monospace', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              ← Voltar para Pesquisa
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setShowAdjustInput(v => !v)}
              style={{
                padding: '10px 16px', borderRadius: '7px',
                background: C.bg2, border: `1px solid ${C.border2}`,
                color: C.text2, cursor: 'pointer', fontSize: '12px',
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.color = C.amber }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2 }}
            >
              <Edit3 size={13} />
              Ajustar Estratégia
            </button>

            <button
              onClick={handleApproveAndSave}
              disabled={isSaving}
              style={{
                padding: '10px 24px', borderRadius: '7px',
                background: isSaving ? C.bg3 : C.amber,
                border: `1px solid ${isSaving ? C.border2 : C.amber}`,
                color: isSaving ? C.text4 : '#fff',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700,
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 150ms ease',
              }}
            >
              {isSaving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                : <><Save size={14} /> Aprovar e Salvar</>}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: C.green, color: '#fff',
          padding: '12px 24px', borderRadius: '8px',
          fontSize: '13px', fontWeight: 600,
          zIndex: 1002, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 200ms ease',
        }}>
          <CheckCircle2 size={16} />
          {toast}
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
