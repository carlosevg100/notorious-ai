'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SuspendedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 32px',
        borderRadius: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 12px',
        }}>
          Conta Suspensa
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}>
          Sua conta foi desativada pelo administrador do escritório.
          Entre em contato com o administrador para reativar o acesso.
        </p>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 24px',
            borderRadius: '6px',
            background: 'var(--accent)',
            color: '#000',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Voltar ao Login
        </button>
      </div>
    </div>
  )
}
