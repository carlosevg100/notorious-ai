'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Upload, CheckCircle2, Loader2, FileText,
  AlertCircle, Trash2, ChevronDown,
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
                width: '60px', height: '2px', margin: '-14px 0 0',
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

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setSelectedClient(preSelectedClientId || null)
    }
  }, [open, preSelectedClientId])

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

  function updateCategory(id: string, category: DocumentCategory) {
    setTaggedFiles(prev => prev.map(f => {
      if (f.id !== id) return f
      // If setting to Petição Inicial, demote existing one
      return { ...f, category }
    }))
  }

  /* Ensure only one Petição Inicial: when user selects it, demote others */
  function handleCategoryChange(id: string, newCategory: DocumentCategory) {
    setTaggedFiles(prev => prev.map(f => {
      if (f.id === id) return { ...f, category: newCategory }
      if (newCategory === 'Petição Inicial' && f.category === 'Petição Inicial') {
        return { ...f, category: 'Outro' as DocumentCategory }
      }
      return f
    }))
  }

  void updateCategory

  const hasPeticao = taggedFiles.some(f => f.category === 'Petição Inicial')
  const canProceed = selectedClient && taggedFiles.length > 0 && hasPeticao

  /* ── Add log line ────────────────────────────────────────── */
  function addLog(line: string) {
    setLogLines(prev => [...prev, line])
  }

  /* ── Update extraction status ────────────────────────────── */
  function updateExtraction(id: string, patch: Partial<FileExtractionResult>) {
    setExtractions(prev => prev.map(e => e.taggedFileId === id ? { ...e, ...patch } : e))
  }

  /* ── Main extraction flow ────────────────────────────────── */
  const runExtraction = useCallback(async () => {
    if (!firmId || !selectedClient || taggedFiles.length === 0) return

    setStep(2)
    setGlobalError(null)

    // Init extraction state for all files
    const initialExtractions: FileExtractionResult[] = taggedFiles.map(tf => ({
      taggedFileId: tf.id,
      fileName: tf.file.name,
      category: tf.category,
      status: 'pending',
    }))
    setExtractions(initialExtractions)

    const total = taggedFiles.length

    try {
      /* ── 1. Create project ──────────────────────────────── */
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

      /* ── 2. Upload all files to Storage ─────────────────── */
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

      // Map document_id back to tagged file id
      const uploadedDocs = uploadData.documents as {
        field: string; document_id: string; name: string; document_category: string
      }[]

      // Update extractions with document IDs
      setExtractions(prev => prev.map(e => {
        const match = uploadedDocs.find(d => d.name === e.fileName)
        return match ? { ...e, documentId: match.document_id } : e
      }))

      /* ── 3. Extract Petição Inicial first ───────────────── */
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

        // Save extraction
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

        // Update project name if we got metadata
        if (peticaoExtracted.nome_processo) {
          addLog(`  Processo: ${peticaoExtracted.nome_processo}`)
        }
        if (peticaoExtracted.numero_processo) {
          addLog(`  CNJ: ${peticaoExtracted.numero_processo}`)
        }

        setPeticaoData(peticaoExtracted)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro na extração da petição'
        setExtractions(prev => prev.map(e =>
          e.taggedFileId === peticaoTagged.id ? { ...e, status: 'error', error: msg } : e
        ))
        addLog(`✗ Erro na petição inicial: ${msg}`)
      }

      // Update progress: 1 done out of total
      setOverallProgress(Math.round((1 / total) * 100))

      /* ── 4. Extract supporting docs in parallel ─────────── */
      const supportingFiles = taggedFiles.filter(f => f.category !== 'Petição Inicial')

      if (supportingFiles.length > 0) {
        addLog(`Iniciando extração paralela de ${supportingFiles.length} documento(s) de suporte...`)

        // Mark all as processing
        setExtractions(prev => prev.map(e =>
          supportingFiles.some(sf => sf.id === e.taggedFileId)
            ? { ...e, status: 'processing' }
            : e
        ))

        let doneCount = 1 // petição counts as 1
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

            // Save extraction
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

        void doneCount
      }

      setOverallProgress(100)
      addLog('▸ Extração completa. Gerando resumo unificado...')

      // Collect final extraction state for summary
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
        width: 'min(700px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        borderRadius: '14px',
        background: C.bg1,
        border: `1px solid ${C.border2}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        zIndex: 1001,
        animation: 'slideUp 200ms ease',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: C.text1, letterSpacing: '-0.01em' }}>
              Novo Processo
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>
              {step === 1 && 'Etapa 1 de 3 — Upload de documentos'}
              {step === 2 && 'Etapa 2 de 3 — Extração AI em andamento'}
              {step === 3 && 'Etapa 3 de 3 — Resumo unificado'}
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

        <div style={{ height: '1px', background: C.border1, margin: '16px 0' }} />

        {/* Body */}
        <div style={{ padding: '0 24px 24px' }}>
          <StepIndicator step={step} C={C} />

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

                {/* Drop zone */}
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

                {/* File list */}
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

                {/* Validation hint */}
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

              {/* CTA */}
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
                  {/* Client + file count header */}
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

                  {/* Overall progress bar */}
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

                  {/* Per-file status list */}
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

                  {/* Extraction log */}
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

              {/* Case metadata banner */}
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

              {/* Documents processed */}
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

              {/* Key dates */}
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

              {/* Risk flags */}
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

              {/* CTA button */}
              <button
                onClick={() => {
                  setToast('Processo criado com sucesso!')
                  setTimeout(() => {
                    setToast(null)
                    onSuccess()
                    onClose()
                  }, 1500)
                }}
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
                <CheckCircle2 size={16} />
                Prosseguir para Análise e Pesquisa →
              </button>

            </div>
          )}
        </div>
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
