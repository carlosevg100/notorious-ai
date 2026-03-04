'use client'
import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/dashboard/clients', label: 'Clientes', icon: '◈' },
  { href: '/dashboard/prazos', label: 'Prazos', icon: '◷' },
  { href: '/dashboard/pecas', label: 'Peças', icon: '◻' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--gold)' }} />
    </div>
  )

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0
      }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: '#000'
            }}>N</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Notorious <span style={{ color: 'var(--gold)' }}>AI</span>
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 6, marginBottom: 2, textDecoration: 'none',
                background: active ? 'var(--gold-light)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--text-3)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s'
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </a>
            )
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 12px', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Sessão</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
          <button onClick={signOut} className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
