'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Upload, CheckCircle2, Loader2, FileText, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { getColors } from '@/lib/theme-colors'

/* ─── Types ──────────────────────────────────────────────────── */
interface Client {
  id: string
  name: string
}

interface ExtractedData {
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
    { n: 3, label: 'Confirmação' },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, marginBottom: '24px',
    }}>
      {steps.map((s, idx) => {
        const isActive   = s.n === step
        const isDone     = s.n < step
        const isInactive = s.n > step

        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                fontFamily: 'IBM Plex Mono, monospace',
                background: isDone    ? C.green
                          : isActive  ? C.amber
                          : C.bg3,
                color:  isDone    ? '#fff'
                      : isActive  ? '#fff'
                      : C.text3,
                border: `2px solid ${
                  isDone   ? C.green
                : isActive ? C.amber
                : C.border2}`,
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

            {/* Connector line */}
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

/* ─── Field row for step 3 ───────────────────────────────────── */
function FieldRow({
  label, field, value, onChange, C, multiline,
}: {
  label: string
  field: keyof ExtractedData
  value: string
  onChange: (f: keyof ExtractedData, v: string) => void
  C: ReturnType<typeof getColors>
  multiline?: boolean
}) {
  const base: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    borderRadius: '6px', background: C.bg3,
    border: `1px solid ${C.border2}`,
    color: C.text1, fontSize: '12px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  }

  return (
    <div>
      <div style={{
        fontSize: '9px', color: C.text3,
        fontFamily: 'IBM Plex Mono, monospace',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: '5px',
      }}>
        {label}
      </div>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(field, e.target.value)}
          style={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(field, e.target.value)}
          style={{ ...base, height: '34px' }}
        />
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
}: NovoProcessoModalProps) {
  const { firmId } = useAuth()
  const { theme } = useTheme()
  const C = getColors(theme)

  const [step,           setStep]           = useState(1)
  const [clients,        setClients]        = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [file,           setFile]           = useState<File | null>(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [extracting,     setExtracting]     = useState(false)
  const [extracted,      setExtracted]      = useState<ExtractedData | null>(null)
  const [extractError,   setExtractError]   = useState<string | null>(null)
  const [editedData,     setEditedData]     = useState<ExtractedData | null>(null)
  const [creating,       setCreating]       = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setStep(1)
      setFile(null)
      setExtracted(null)
      setExtractError(null)
      setEditedData(null)
      setCreating(false)
      setSelectedClient(preSelectedClientId || null)
    }
  }, [open, preSelectedClientId])

  /* Load clients */
  useEffect(() => {
    if (!open || !firmId) return
    supabase
      .from('clients')
      .select('id, name')
      .eq('firm_id', firmId)
      .order('name')
      .then(({ data }) => setClients(data || []))
  }, [open, firmId])

  const canProceed = selectedClient && file

  /* ── Step 2: extraction ──────────────────────────────────── */
  const runExtraction = useCallback(async () => {
    if (!file) return
    setStep(2)
    setExtracting(true)
    setExtractError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok || !data.extracted) {
        throw new Error(data.error || 'Falha na extração')
      }

      setExtracted(data.extracted)
      setEditedData(data.extracted)
      setStep(3)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setExtractError(msg)
    } finally {
      setExtracting(false)
    }
  }, [file])

  /* ── Step 3: create project ──────────────────────────────── */
  async function handleCreate() {
    if (!editedData || !selectedClient || !firmId) return
    setCreating(true)

    try {
      const projectName = editedData.nome_processo
        || editedData.tipo_acao
        || `Processo ${editedData.numero_processo || 'Novo'}`

      const { error } = await supabase.from('projects').insert({
        firm_id:          firmId,
        client_id:        selectedClient,
        name:             projectName,
        numero_processo:  editedData.numero_processo || null,
        tipo:             editedData.tipo || 'contencioso',
        area:             editedData.area || 'Cível',
        fase:             'analise',
        status:           'ativo',
        vara:             editedData.vara || null,
        comarca:          editedData.comarca || null,
        valor_causa:      editedData.valor_causa || null,
        autor:            editedData.autor || null,
        reu:              editedData.reu || null,
        pedidos:          editedData.pedidos || null,
      })

      if (error) throw new Error(error.message)

      setToast('Processo criado com sucesso!')
      setTimeout(() => {
        setToast(null)
        onSuccess()
        onClose()
      }, 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar processo'
      setExtractError(msg)
    } finally {
      setCreating(false)
    }
  }

  /* ── Drag & drop ─────────────────────────────────────────── */
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  function updateField(field: keyof ExtractedData, value: string) {
    setEditedData(prev => prev ? { ...prev, [field]: value } : prev)
  }

  if (!open) return null

  /* ─── Overlay ───────────────────────────────────────────── */
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

      {/* Modal card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(660px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        borderRadius: '14px',
        background: C.bg1,
        border: `1px solid ${C.border2}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        zIndex: 1001,
        animation: 'slideUp 200ms ease',
      }}>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: '18px', fontWeight: 700,
              color: C.text1, letterSpacing: '-0.01em',
            }}>
              Novo Processo
            </h2>
            <p style={{
              margin: '4px 0 0', fontSize: '11px', color: C.text3,
              fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
            }}>
              {step === 1 && 'Etapa 1 de 3 — Upload da petição inicial'}
              {step === 2 && 'Etapa 2 de 3 — Extração AI'}
              {step === 3 && 'Etapa 3 de 3 — Confirmação'}
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
            onMouseEnter={e => {
              e.currentTarget.style.background = C.bg3
              e.currentTarget.style.color = C.text1
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = C.text3
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: C.border1, margin: '16px 0' }} />

        {/* ── Body ─────────────────────────────────────────── */}
        <div style={{ padding: '0 24px 24px' }}>

          <StepIndicator step={step} C={C} />

          {/* ══ STEP 1: Upload ════════════════════════════════ */}
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
                    justifyContent: 'center', fontSize: '10px', fontWeight: 700,
                    flexShrink: 0,
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
                    maxHeight: '180px', overflowY: 'auto',
                    paddingRight: '4px',
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

              {/* PDF upload */}
              <div>
                <div style={{
                  fontSize: '11px', color: C.text2, fontWeight: 600,
                  marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                    color: C.amber, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', fontWeight: 700,
                    flexShrink: 0,
                  }}>2</span>
                  Faça upload da petição inicial (PDF)
                </div>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? C.amber : file ? C.green : C.border2}`,
                    borderRadius: '10px',
                    padding: '28px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? C.amberBg : file ? C.greenBg : C.bg2,
                    transition: 'all 200ms ease',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  {file ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <FileText size={28} style={{ color: C.green }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: C.green }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: '11px', color: C.text3, marginTop: '3px' }}>
                          {(file.size / 1024).toFixed(0)} KB · Clique para trocar
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Upload size={28} style={{ color: dragOver ? C.amber : C.text3 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: dragOver ? C.amber : C.text2 }}>
                          Arraste o PDF aqui ou clique para selecionar
                        </div>
                        <div style={{ fontSize: '11px', color: C.text3, marginTop: '5px' }}>
                          A AI extrai automaticamente: CNJ, partes, comarca, valor, pedidos, prazos
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA button */}
              <button
                disabled={!canProceed}
                onClick={runExtraction}
                style={{
                  width: '100%', padding: '13px',
                  borderRadius: '8px', fontWeight: 700,
                  fontSize: '13px', cursor: canProceed ? 'pointer' : 'not-allowed',
                  border: `1px solid ${canProceed ? C.amber : C.border1}`,
                  background: canProceed ? C.amber : C.bg3,
                  color: canProceed ? '#fff' : C.text4,
                  transition: 'all 200ms ease',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.06em',
                }}
              >
                {canProceed
                  ? 'Enviar para Extração AI →'
                  : 'Selecione o cliente e faça upload de PDF'}
              </button>
            </div>
          )}

          {/* ══ STEP 2: Extraction ════════════════════════════ */}
          {step === 2 && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '24px', padding: '20px 0 10px',
            }}>
              {extracting ? (
                <>
                  {/* Spinner */}
                  <div style={{ position: 'relative', width: '72px', height: '72px' }}>
                    <Loader2
                      size={72}
                      style={{ color: C.amber, animation: 'spin 1s linear infinite' }}
                    />
                    <span style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '20px',
                    }}>🤖</span>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.text1, marginBottom: '8px' }}>
                      Analisando documento...
                    </div>
                    <div style={{ fontSize: '12px', color: C.text3, lineHeight: '1.6' }}>
                      A AI está lendo a petição e extraindo automaticamente:<br />
                      <span style={{ color: C.amber }}>
                        CNJ · partes · vara · comarca · valor · pedidos · prazos
                      </span>
                    </div>
                  </div>

                  {/* Animated dots */}
                  <div style={{
                    width: '100%', height: '4px', borderRadius: '2px',
                    background: C.bg3, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: '40%', borderRadius: '2px',
                      background: C.amber,
                      animation: 'slideProgress 1.4s ease-in-out infinite',
                    }} />
                  </div>
                </>
              ) : extractError ? (
                <>
                  <AlertCircle size={48} style={{ color: C.red }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.red, marginBottom: '8px' }}>
                      Falha na extração
                    </div>
                    <div style={{ fontSize: '12px', color: C.text3 }}>{extractError}</div>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      padding: '10px 24px', borderRadius: '7px',
                      background: C.bg3, border: `1px solid ${C.border2}`,
                      color: C.text2, cursor: 'pointer', fontSize: '13px',
                    }}
                  >
                    ← Voltar
                  </button>
                </>
              ) : null}
            </div>
          )}

          {/* ══ STEP 3: Confirmação ═══════════════════════════ */}
          {step === 3 && editedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {extractError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '6px',
                  background: C.redBg, border: `1px solid ${C.redBorder}`,
                  color: C.red, fontSize: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <AlertCircle size={14} />
                  {extractError}
                </div>
              )}

              <div style={{
                fontSize: '12px', color: C.text3,
                padding: '8px 12px', borderRadius: '6px',
                background: C.amberBg, border: `1px solid ${C.amberBorder}`,
              }}>
                ✎ Revise e edite os campos antes de criar o processo
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FieldRow label="Número do Processo (CNJ)" field="numero_processo" value={editedData.numero_processo || ''} onChange={updateField} C={C} />
                <FieldRow label="Tipo de Ação" field="tipo_acao" value={editedData.tipo_acao || ''} onChange={updateField} C={C} />
                <FieldRow label="Nome do Processo" field="nome_processo" value={editedData.nome_processo || ''} onChange={updateField} C={C} />
                <FieldRow label="Área do Direito" field="area" value={editedData.area || ''} onChange={updateField} C={C} />
                <FieldRow label="Autor / Requerente" field="autor" value={editedData.autor || ''} onChange={updateField} C={C} />
                <FieldRow label="Réu / Requerido" field="reu" value={editedData.reu || ''} onChange={updateField} C={C} />
                <FieldRow label="Vara" field="vara" value={editedData.vara || ''} onChange={updateField} C={C} />
                <FieldRow label="Comarca" field="comarca" value={editedData.comarca || ''} onChange={updateField} C={C} />
                <FieldRow label="Valor da Causa" field="valor_causa" value={editedData.valor_causa || ''} onChange={updateField} C={C} />
                <div />
              </div>

              <FieldRow label="Pedidos" field="pedidos" value={editedData.pedidos || ''} onChange={updateField} C={C} multiline />
              <FieldRow label="Prazos Identificados" field="prazos" value={editedData.prazos || ''} onChange={updateField} C={C} multiline />

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  onClick={() => { setStep(1); setExtractError(null) }}
                  style={{
                    flex: 1, padding: '12px',
                    borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                    cursor: 'pointer', border: `1px solid ${C.border2}`,
                    background: C.bg3, color: C.text2, transition: 'all 150ms ease',
                  }}
                >
                  ← Reiniciar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{
                    flex: 2, padding: '12px',
                    borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                    cursor: creating ? 'wait' : 'pointer',
                    border: `1px solid ${C.amber}`,
                    background: C.amber, color: '#fff',
                    transition: 'all 150ms ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
                  }}
                >
                  {creating ? (
                    <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</>
                  ) : '✓ Criar Processo'}
                </button>
              </div>
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
        @keyframes slideProgress {
          0%   { margin-left: -40%; }
          100% { margin-left: 100%; }
        }
      `}</style>
    </>
  )
}
