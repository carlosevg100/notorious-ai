"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/casos", label: "Casos", icon: "⚖" },
  { href: "/dashboard/chat", label: "Chat IA", icon: "◈" },
  { href: "/dashboard/documentos", label: "Documentos", icon: "▦" },
  { href: "/dashboard/elaboracao", label: "Elaboração", icon: "✦" },
  { href: "/dashboard/pesquisa", label: "Pesquisa", icon: "◎" },
  { href: "/dashboard/biblioteca", label: "Biblioteca", icon: "▤" },
  { href: "/dashboard/prazos", label: "Prazos", icon: "◷" },
  { href: "/dashboard/configuracoes", label: "Config.", icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0A' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? '56px' : '220px', minHeight: '100vh',
        background: '#0d0d0d', borderRight: '1px solid #1a1a1a',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
        transition: 'width 0.2s'
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
          onClick={() => setCollapsed(!collapsed)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: '800', color: '#000'
            }}>N</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', lineHeight: 1 }}>Notorious AI</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>B/Luz Advogados</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}
                style={{ marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '16px', minWidth: '20px', textAlign: 'center' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #C9A84C40, #C9A84C20)',
                border: '1px solid #C9A84C40', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '13px', color: '#C9A84C', fontWeight: '600'
              }}>CG</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dr. Cristiano</div>
                <div style={{ fontSize: '11px', color: '#444' }}>Sócio Senior</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: collapsed ? '56px' : '220px', minHeight: '100vh', transition: 'margin-left 0.2s' }}>
        {children}
      </main>
    </div>
  );
}
