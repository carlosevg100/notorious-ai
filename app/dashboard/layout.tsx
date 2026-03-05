'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import { LogOut, Sun, Moon } from 'lucide-react'

/* ─── Colors ─────────────────────────────────────────────────── */
const C = {
  bg0: '#08080A', bg1: '#0F0F12', bg2: '#141418', bg3: '#1A1A20',
  border1: '#1F1F26', border2: '#252530',
  text1: '#F4F4F6', text2: '#A0A0B0', text3: '#606070',
  amber: '#F0A500', amberBg: '#F0A50015', amberBorder: '#F0A50030',
  red: '#EF4444',
}

const AVATAR_COLORS = ['#3B82F6','#EF4444','#22C55E','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316']

function getInitials(name: string): string {
  return name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface SidebarClient {
  id: string
  name: string
  urgentCount: number
}

const NAV_ITEMS = [
  { href: '/dashboard',         label: 'Dashboard',  icon: '▣', exact: true },
  { href: '/dashboard/clients', label: 'Clientes',   icon: '◈' },
  { href: '/dashboard/prazos',  label: 'Prazos',     icon: '◷' },
  { href: '/dashboard/pecas',   label: 'Peças',      icon: '◧' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, signOut, firmId, userName } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [sidebarClients, setSidebarClients] = useState<SidebarClient[]>([])

  useEffect(() => {
    if (!firmId) return
    async function fetchSidebarData() {
      // Fetch clients
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('firm_id', firmId)
        .order('name')
        .limit(10)

      if (!clientData || clientData.length === 0) return

      // Fetch overdue/today prazos
      const today = new Date().toISOString().split('T')[0]
      const { data: urgentPrazos } = await supabase
        .from('prazos')
        .select('project_id')
        .eq('firm_id', firmId)
        .eq('status', 'pendente')
        .lte('data_prazo', today)

      // Fetch projects to map project_id → client_id
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, client_id')
        .eq('firm_id', firmId)

      // Build project → client map
      const projectClientMap = new Map<string, string>()
      ;(projectData || []).forEach((p: { id: string; client_id: string | null }) => {
        if (p.client_id) projectClientMap.set(p.id, p.client_id)
      })

      // Count urgent prazos per client
      const urgentMap = new Map<string, number>()
      ;(urgentPrazos || []).forEach((p: { project_id: string }) => {
        const clientId = projectClientMap.get(p.project_id)
        if (clientId) urgentMap.set(clientId, (urgentMap.get(clientId) || 0) + 1)
      })

      setSidebarClients(
        clientData.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
          urgentCount: urgentMap.get(c.id) || 0,
        }))
      )
    }
    fetchSidebarData()
  }, [firmId])

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  const userInitials = userName
    ? getInitials(userName)
    : (user?.email?.[0]?.toUpperCase() ?? '?')
  const userDisplay = userName || user?.email?.split('@')[0] || 'Admin'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg0 }}>
      <style>{`
        .nav-link:hover  { color: ${C.text1} !important; background: ${C.bg2} !important; }
        .sb-client:hover { background: ${C.bg3} !important; }
        .bot-btn:hover   { background: ${C.bg2} !important; color: ${C.text1} !important; }
        .logout-btn:hover { color: #EF4444 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 2px; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: C.bg1,
        borderRight: `1px solid ${C.border1}`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 18px 16px',
          borderBottom: `1px solid ${C.border1}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em',
            color: C.text1, userSelect: 'none',
          }}>
            Litigator<span style={{ color: C.amber }}>AI</span>
          </div>
          <div style={{
            fontSize: '9px', color: C.text3, fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px',
          }}>
            Escritório de Advocacia
          </div>
        </div>

        {/* Scrollable section */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* NAVEGAÇÃO */}
          <div style={{ padding: '14px 8px 8px' }}>
            <div style={{
              fontSize: '8px', color: C.text3, letterSpacing: '0.12em',
              fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
              padding: '0 10px', marginBottom: '6px',
            }}>
              Navegação
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {NAV_ITEMS.map(item => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: active ? 600 : 400,
                      textDecoration: 'none',
                      transition: 'all 150ms ease',
                      borderLeft: `2px solid ${active ? C.amber : 'transparent'}`,
                      background: active ? C.amberBg : 'transparent',
                      color: active ? C.amber : C.text2,
                    }}
                  >
                    <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* CLIENTES */}
          {sidebarClients.length > 0 && (
            <div style={{ padding: '6px 8px 12px', marginTop: '4px' }}>
              <div style={{
                fontSize: '8px', color: C.text3, letterSpacing: '0.12em',
                fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
                padding: '0 10px', marginBottom: '6px',
              }}>
                Clientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {sidebarClients.map(c => {
                  const ac = avatarColor(c.name)
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/clients/${c.id}`}
                      className="sb-client"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 10px', borderRadius: '6px',
                        textDecoration: 'none', transition: 'background 150ms ease',
                      }}
                    >
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '5px',
                        background: ac + '20', border: `1px solid ${ac}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px', fontWeight: 700, color: ac, flexShrink: 0,
                        fontFamily: 'IBM Plex Mono, monospace',
                      }}>
                        {getInitials(c.name)}
                      </span>
                      <span style={{
                        fontSize: '12px', color: C.text2, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.name}
                      </span>
                      {c.urgentCount > 0 && (
                        <span style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: C.red,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '8px', fontWeight: 700, color: '#fff',
                          flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {c.urgentCount > 9 ? '9+' : c.urgentCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom: controls + user profile */}
        <div style={{
          padding: '8px',
          borderTop: `1px solid ${C.border1}`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="bot-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px', borderRadius: '6px',
              fontSize: '12px', color: C.text3,
              background: 'transparent', border: 'none', cursor: 'pointer',
              width: '100%', textAlign: 'left', transition: 'all 150ms ease',
            }}
          >
            {theme === 'dark'
              ? <Sun size={14} strokeWidth={1.5} />
              : <Moon size={14} strokeWidth={1.5} />
            }
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>

          {/* User profile card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px', borderRadius: '6px',
            background: C.bg2, border: `1px solid ${C.border1}`,
            margin: '4px 0',
          }}>
            <span style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: C.amberBg, border: `1px solid ${C.amberBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: C.amber, flexShrink: 0,
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              {userInitials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11px', fontWeight: 600, color: C.text1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {userDisplay}
              </div>
              <div style={{
                fontSize: '9px', color: C.text3,
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em',
              }}>
                ADMIN
              </div>
            </div>
            <span style={{ fontSize: '14px', color: C.text3, cursor: 'pointer', flexShrink: 0 }}>⋯</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="bot-btn logout-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px', borderRadius: '6px',
              fontSize: '12px', color: C.text3,
              background: 'transparent', border: 'none', cursor: 'pointer',
              width: '100%', textAlign: 'left', transition: 'all 150ms ease',
            }}
          >
            <LogOut size={14} strokeWidth={1.5} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        background: C.bg0,
      }}>
        {children}
      </main>
    </div>
  )
}
