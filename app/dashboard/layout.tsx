'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { LayoutDashboard, Users, CalendarClock, FileText, LogOut, Sun, Moon } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',         label: 'Painel de Controle', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/clients', label: 'Clientes',  icon: Users },
  { href: '/dashboard/prazos',  label: 'Prazos',    icon: CalendarClock },
  { href: '/dashboard/pecas',   label: 'Peças',     icon: FileText },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            userSelect: 'none',
          }}>
            Litigator<span style={{ color: 'var(--accent)' }}>AI</span>
          </span>
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1,
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflowY: 'auto',
        }}>
          {NAV_ITEMS.map(item => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: active ? '8px 12px 8px 10px' : '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 150ms ease',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <item.icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom controls */}
        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            {theme === 'dark'
              ? <Sun size={16} strokeWidth={1.5} />
              : <Moon size={16} strokeWidth={1.5} />
            }
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>

          <div style={{
            padding: '4px 12px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
          }}>
            {user?.email}
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <LogOut size={16} strokeWidth={1.5} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {children}
      </main>
    </div>
  )
}
