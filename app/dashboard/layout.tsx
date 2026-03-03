"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "../theme-context";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard",                label: "Dashboard",   icon: "⊞" },
  { href: "/dashboard/clientes",       label: "Clientes",    icon: "◉" },
  { href: "/dashboard/pesquisa",       label: "Pesquisa",    icon: "◎" },
  { href: "/dashboard/prazos",         label: "Prazos",      icon: "◷" },
  { href: "/dashboard/contratos",      label: "Contratos",   icon: "▤" },
  { href: "/dashboard/configuracoes",  label: "Config.",     icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();
  const { user, profile, loading, signOut } = useAuth();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return null;

  const initials = profile?.name ? profile.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : '?';

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        width: collapsed ? "56px" : "220px", minHeight: "100vh",
        background: "var(--bg-2)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50,
        transition: "width 0.2s"
      }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
          onClick={() => setCollapsed(!collapsed)}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
            <div style={{
              width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px",
              background: "linear-gradient(135deg, #C9A84C, #8B6914)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "15px", fontWeight: "800", color: "#000"
            }}>N</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)", lineHeight: 1 }}>Notorious AI</div>
                <div style={{ fontSize: "10px", color: "var(--text-4)", marginTop: "2px" }}>{profile?.firms?.name || '...'}</div>
              </div>
            )}
          </div>
        </div>

        <nav style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                style={{ marginBottom: "2px", overflow: "hidden", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: "16px", minWidth: "20px", textAlign: "center" }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "var(--gold-bg)", border: "1px solid var(--gold-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", color: "var(--gold)", fontWeight: "600"
              }}>{initials}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name || 'Usuário'}</div>
                <div style={{ fontSize: "11px", color: "var(--text-4)" }}>{profile?.role || 'Advogado'}</div>
              </div>
            </div>
            <button onClick={signOut} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '11px', padding: '6px' }}>Sair</button>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, marginLeft: collapsed ? "56px" : "220px", minHeight: "100vh", transition: "margin-left 0.2s", background: "var(--bg)" }}>
        <div style={{ position: "fixed", top: "12px", right: "16px", zIndex: 100, display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: "13px" }}>{isDark ? "🌙" : "☀️"}</span>
          <button onClick={toggle} style={{ position: "relative", width: "44px", height: "24px", borderRadius: "12px", background: isDark ? "#C9A84C" : "#D0D0D0", border: "none", cursor: "pointer", padding: 0, transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: isDark ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </button>
          <span style={{ fontSize: "11px", color: "var(--text-4)", fontWeight: "500", minWidth: "36px" }}>{isDark ? "Escuro" : "Claro"}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
