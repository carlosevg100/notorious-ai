'use client'

import { X } from 'lucide-react'

interface DeleteModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteModal({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  loading = false,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: '100%', maxWidth: '440px',
        padding: '28px', borderRadius: '12px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginRight: '12px',
          }}>
            <span style={{ fontSize: '18px' }}>🗑️</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px', marginLeft: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        <p style={{
          fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)',
          margin: '0 0 24px', padding: '12px 14px',
          borderRadius: '8px',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
        }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, height: '40px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, height: '40px', borderRadius: '6px',
              background: loading ? 'rgba(239,68,68,0.6)' : '#EF4444',
              color: '#fff', fontWeight: 700, fontSize: '14px',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#DC2626' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#EF4444' }}
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
