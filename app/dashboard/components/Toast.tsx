'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onDismiss: () => void
  durationMs?: number
}

export default function Toast({ message, type = 'success', onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(t)
  }, [onDismiss, durationMs])

  const isSuccess = type === 'success'

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '8px',
      background: isSuccess ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${isSuccess ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      color: isSuccess ? '#22C55E' : '#EF4444',
      fontSize: '14px', fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      animation: 'fadeInUp 200ms ease',
      backdropFilter: 'blur(8px)',
    }}>
      {isSuccess
        ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
        : <XCircle size={16} style={{ flexShrink: 0 }} />
      }
      <span style={{ color: 'var(--text-primary)' }}>{message}</span>
    </div>
  )
}
