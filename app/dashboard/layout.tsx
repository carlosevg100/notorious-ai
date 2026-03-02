"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../theme-context";

const NAV = [
  { href: "/dashboard",                  label: "Dashboard",   icon: "⊞" },
  { href: "/dashboard/casos",            label: "Casos",       icon: "⚖" },
  { href: "/dashboard/chat",             label: "Chat IA",     icon: "◈" },
  { href: "/dashboard/documentos",       label: "Documentos",  icon: "▦" },
  { href: "/dashboard/elaboracao",       label: "Elaboração",  icon: "✦" },
  { href: "/dashboard/pesquisa",         label: "Pesquisa",    icon: "◎" },
  { href: "/dashboard/biblioteca",       label: "Biblioteca",  icon: "▤" },
  { href: "/dashboard/prazos",           label: "Prazos",      icon: "◷" },
  { href: "/dashboard/configuracoes",    label: "Config.",     icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();

  const isDark = theme === "dark";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? "56px" : "220px", minHeight: "100vh",
        background: "var(--bg-2)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50,
        transition: "width 0.2s"
      }}>
        {/* Logo */}
        <div
          style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
          onClick={() => setCollapsed(!collapsed)}
        >
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
                <div style={{ fontSize: "10px", color: "var(--text-4)", marginTop: "2px" }}>B/Luz Advogados</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                style={{ marginBottom: "2px", overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <span style={{ fontSize: "16px", minWidth: "20px", textAlign: "center" }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle in sidebar footer */}
        {!collapsed && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "var(--gold-bg)", border: "1px solid var(--gold-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", color: "var(--gold)", fontWeight: "600"
              }}>CG</div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>Dr. Cristiano</div>
                <div style={{ fontSize: "11px", color: "var(--text-4)" }}>Sócio Senior</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: collapsed ? "56px" : "220px", minHeight: "100vh", transition: "margin-left 0.2s", background: "var(--bg)" }}>
        {/* Top theme toggle bar — always visible */}
        <div style={{
          position: "fixed",
          top: "12px",
          right: "16px",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "5px 10px",
          boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.08)"
        }}>
          <span style={{ fontSize: "13px" }}>{isDark ? "🌙" : "☀️"}</span>
          <button
            onClick={toggle}
            title="Alternar tema"
            style={{
              position: "relative",
              width: "44px", height: "24px",
              borderRadius: "12px",
              background: isDark ? "#C9A84C" : "#D0D0D0",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.2s",
              flexShrink: 0
            }}
            aria-label="Alternar tema claro/escuro"
          >
            <div style={{
              position: "absolute",
              top: "3px",
              left: isDark ? "23px" : "3px",
              width: "18px", height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }} />
          </button>
          <span style={{ fontSize: "11px", color: "var(--text-4)", fontWeight: "500", minWidth: "36px" }}>
            {isDark ? "Escuro" : "Claro"}
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
