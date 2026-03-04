"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Processo {
  id: string;
  numero_processo?: string;
  tribunal?: string;
  polo_ativo?: { nome?: string };
  polo_passivo?: { nome?: string };
  fase: string;
  prazo_contestacao?: string;
  risco?: string;
  tutela_urgencia?: boolean;
  clients?: { name: string };
  client_id?: string;
  created_at: string;
}

const FASES = [
  { key: "recebido", label: "Recebido", color: "#3b82f6" },
  { key: "extracao", label: "Extração", color: "#8b5cf6" },
  { key: "docs_solicitados", label: "Docs Solicitados", color: "#f97316" },
  { key: "docs_recebidos", label: "Docs Recebidos", color: "#10b981" },
  { key: "contestacao_gerando", label: "Gerando Contestação", color: "#C9A84C" },
  { key: "contestacao_revisao", label: "Revisão", color: "#ec4899" },
  { key: "protocolado", label: "Protocolado", color: "#22c55e" },
  { key: "aguardando_replica", label: "Aguard. Réplica", color: "#06b6d4" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function diasRestantes(prazo?: string) {
  if (!prazo) return null;
  const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
  return diff;
}

function riscoBadge(risco?: string) {
  const r = risco?.toLowerCase();
  if (r === "alto") return { color: "#ef4444", label: "Alto" };
  if (r === "medio" || r === "médio") return { color: "#f59e0b", label: "Médio" };
  return { color: "#22c55e", label: "Baixo" };
}

function faseCor(fase: string) {
  return FASES.find(f => f.key === fase)?.color || "#888";
}

function faseLabel(fase: string) {
  return FASES.find(f => f.key === fase)?.label || fase;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [faseFilter, setFaseFilter] = useState<string | null>(null);
  const [riscoFilter, setRiscoFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/processos");
      if (res.ok) setProcessos(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pipeline counters
  const pipelineCounts = FASES.reduce((acc, f) => {
    acc[f.key] = processos.filter(p => p.fase === f.key).length;
    return acc;
  }, {} as Record<string, number>);

  // Critical cases: prazo ≤5 days OR tutela_urgencia
  const criticos = processos.filter(p => {
    const dias = diasRestantes(p.prazo_contestacao);
    return (dias !== null && dias <= 5) || p.tutela_urgencia;
  });

  // Filtered list
  const filtered = processos.filter(p => {
    if (faseFilter && p.fase !== faseFilter) return false;
    if (riscoFilter && p.risco?.toLowerCase() !== riscoFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const clientName = p.clients?.name?.toLowerCase() || "";
      const polo = p.polo_ativo?.nome?.toLowerCase() || "";
      const num = p.numero_processo?.toLowerCase() || "";
      if (!clientName.includes(s) && !polo.includes(s) && !num.includes(s)) return false;
    }
    return true;
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {getGreeting()}, {profile?.name?.split(" ")[0] || "Advogado"}
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: 13, margin: "4px 0 0" }}>
            {processos.length} processo{processos.length !== 1 ? "s" : ""} no sistema
          </p>
        </div>
        <Link href="/dashboard/processos/new">
          <button className="btn-gold">+ Novo Processo</button>
        </Link>
      </div>

      {/* Pipeline */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pipeline de Processos
        </h2>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {FASES.map(f => (
            <div
              key={f.key}
              onClick={() => setFaseFilter(faseFilter === f.key ? null : f.key)}
              style={{
                flex: "0 0 auto", minWidth: 100, padding: "10px 12px", borderRadius: 8,
                background: faseFilter === f.key ? f.color + "22" : "var(--bg-2)",
                border: `1px solid ${faseFilter === f.key ? f.color : "var(--border)"}`,
                cursor: "pointer", textAlign: "center", transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: f.color }}>
                {pipelineCounts[f.key] || 0}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3, lineHeight: 1.3 }}>
                {f.label}
              </div>
            </div>
          ))}
        </div>
        {faseFilter && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)" }}>
            Filtrando por fase: <strong style={{ color: faseCor(faseFilter) }}>{faseLabel(faseFilter)}</strong>
            <button onClick={() => setFaseFilter(null)} style={{ marginLeft: 8, color: "var(--text-4)", cursor: "pointer", background: "none", border: "none", fontSize: 11 }}>✕ limpar</button>
          </div>
        )}
      </div>

      {/* Casos Críticos */}
      {criticos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ⚠ Casos Críticos ({criticos.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticos.map(p => {
              const dias = diasRestantes(p.prazo_contestacao);
              const badge = riscoBadge(p.risco);
              return (
                <div
                  key={p.id}
                  className="card"
                  onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                  style={{
                    padding: "12px 16px", borderColor: "#ef444440", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#ef444408",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {p.clients?.name || "Cliente"} — {p.polo_ativo?.nome || "Sem autor"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                      {p.numero_processo || "Sem número"} · {p.tribunal || ""}
                      {p.tutela_urgencia && <span style={{ color: "#ef4444", marginLeft: 8 }}>⚡ Tutela urgência</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", gap: 12, alignItems: "center" }}>
                    {dias !== null && (
                      <span style={{ fontSize: 12, color: dias <= 0 ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>
                        {dias <= 0 ? "VENCIDO" : `${dias}d`}
                      </span>
                    )}
                    <span style={{ fontSize: 11, background: badge.color + "22", color: badge.color, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Processos */}
      <div className="card">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, flex: 1 }}>Todos os Processos</h2>
          <input
            placeholder="Buscar por cliente, polo ativo, número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)",
              borderRadius: 6, padding: "6px 12px", fontSize: 12, width: 260,
            }}
          />
          <select
            value={faseFilter || ""}
            onChange={e => setFaseFilter(e.target.value || null)}
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}
          >
            <option value="">Todas as fases</option>
            {FASES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select
            value={riscoFilter}
            onChange={e => setRiscoFilter(e.target.value)}
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}
          >
            <option value="">Todos os riscos</option>
            <option value="alto">Alto</option>
            <option value="medio">Médio</option>
            <option value="baixo">Baixo</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            Nenhum processo encontrado.{" "}
            <Link href="/dashboard/processos/new" style={{ color: "var(--gold)" }}>+ Criar novo</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-2)", color: "var(--text-3)", textAlign: "left" }}>
                  {["Cliente", "Processo", "Polo Ativo", "Fase", "Prazo", "Risco", "Ações"].map(col => (
                    <th key={col} style={{ padding: "8px 14px", fontWeight: 500, borderBottom: "1px solid var(--border)" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const dias = diasRestantes(p.prazo_contestacao);
                  const badge = riscoBadge(p.risco);
                  const fColor = faseCor(p.fase);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{p.clients?.name || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-2)", fontFamily: "monospace" }}>
                        {p.numero_processo || <span style={{ color: "var(--text-4)" }}>Sem número</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>{p.polo_ativo?.nome || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: fColor + "20", color: fColor, padding: "2px 8px", borderRadius: 99, fontWeight: 500, fontSize: 11 }}>
                          {faseLabel(p.fase)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {dias !== null ? (
                          <span style={{ color: dias <= 0 ? "#ef4444" : dias <= 5 ? "#f59e0b" : "var(--text-2)", fontWeight: dias <= 5 ? 700 : 400 }}>
                            {dias <= 0 ? "Vencido" : `${dias}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: badge.color + "22", color: badge.color, padding: "2px 8px", borderRadius: 99, fontWeight: 600, fontSize: 11 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          onClick={e => { e.stopPropagation(); router.push(`/dashboard/processos/${p.id}`); }}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
