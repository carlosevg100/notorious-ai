"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", icon: "⚡", label: "Dashboard" },
  { href: "/dashboard/clientes", icon: "🏢", label: "Clientes" },
  { href: "/dashboard/pesquisa", icon: "🔍", label: "Jurisprudência" },
  { href: "/dashboard/prazos", icon: "📅", label: "Prazos" },
  { href: "/dashboard/configuracoes", icon: "⚙", label: "Configurações" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  
  useEffect(() => {
    const saved = localStorage.getItem('notorious-theme') as 'dark'|'light' || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('notorious-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        width: 220, minHeight: "100vh", background: "var(--bg-2)",
        borderRight: "1px solid var(--border)", display: "flex",
        flexDirection: "column", padding: "16px 12px", position: "fixed",
        top: 0, left: 0, bottom: 0, zIndex: 50,
      }}>
        <div style={{ padding: "8px 4px 16px", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--gold)", letterSpacing: "0.05em" }}>
            NOTORIOUS AI
          </span>
        </div>

        <Link href="/dashboard/processos/new" style={{ textDecoration: "none", marginBottom: 12 }}>
          <button className="btn-gold" style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "8px 12px" }}>
            + Novo Processo
          </button>
        </Link>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ href, icon, label }) => {
            const isActive = href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`sidebar-link${isActive ? " active" : ""}`}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.name || profile?.email || "—"}
          </div>
          <button
            onClick={toggleTheme}
            style={{ width: "100%", marginBottom: 6, padding: "6px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-4)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
          </button>
          <button
            onClick={handleLogout}
            className="btn-ghost"
            style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "6px 12px" }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, minHeight: "100vh", background: "var(--bg)" }}>
        {children}
      </main>
    </div>
  );
}
