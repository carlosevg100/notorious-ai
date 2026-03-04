"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  valor_causa?: number;
  clients?: { name: string };
  client_id?: string;
  created_at: string;
}

const PIPELINE_FASES = [
  { key: "recebido", label: "Recebido", symbol: "●" },
  { key: "extracao", label: "Extração", symbol: "◉" },
  { key: "docs_solicitados", label: "Docs Solicitados", symbol: "○" },
  { key: "docs_recebidos", label: "Docs Recebidos", symbol: "○" },
  { key: "gerando_contestacao", label: "Gerando Contestação", symbol: "○" },
  { key: "revisao", label: "Revisão", symbol: "○" },
  { key: "protocolado", label: "Protocolado", symbol: "✓" },
];

const riscoBg: Record<string, string> = { alto: "rgba(239,68,68,0.15)", medio: "rgba(245,158,11,0.15)", baixo: "rgba(34,197,94,0.15)" };
const riscoColor: Record<string, string> = { alto: "#ef4444", medio: "#f59e0b", baixo: "#22c55e" };
const riscoLabel: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

const fmtDate = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const daysUntil = (d: string) => d ? Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 86400000) : null;

function getRisco(p: Processo) {
  return (p.risco || "").toLowerCase().replace("é", "e");
}

export default function DashboardPage() {
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

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

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const dayStr = now.toLocaleDateString("pt-BR", { weekday: "long" });

  // KPI counts
  const total = processos.length;
  const riscoAlto = processos.filter(p => getRisco(p) === "alto").length;
  const tutelaUrgente = processos.filter(p => p.tutela_urgencia).length;
  const prazo7 = processos.filter(p => {
    const d = daysUntil(p.prazo_contestacao || "");
    return d !== null && d >= 0 && d <= 7;
  }).length;

  // Upcoming deadlines sorted
  const upcoming = processos
    .filter(p => p.prazo_contestacao)
    .sort((a, b) => new Date(a.prazo_contestacao!).getTime() - new Date(b.prazo_contestacao!).getTime())
    .slice(0, 8);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
            NOTORIOUS AI — OPERAÇÕES
          </h1>
          <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>B/Luz Advogados</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{dateStr}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "capitalize" }}>{dayStr}</div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 600 }}>
            Total de Casos
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>
            {loading ? "..." : total}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>casos ↗</div>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 600 }}>
            Risco Alto
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>
            {loading ? "..." : riscoAlto}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>casos ⚠</div>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 600 }}>
            Tutela Urgente
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>
            {loading ? "..." : tutelaUrgente}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>casos ⚡</div>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 600 }}>
            Prazo — 7 dias
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--gold)" }}>
            {loading ? "..." : prazo7}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>vencendo</div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card" style={{ marginBottom: 24, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Pipeline de Processos
          </span>
        </div>
        <div style={{ display: "flex", overflowX: "auto", gap: 0 }}>
          {PIPELINE_FASES.map((fase, fi) => {
            const casos = processos.filter(p => {
              // Normalize fase keys (handle both contestacao_gerando and gerando_contestacao)
              const pf = p.fase;
              if (fase.key === "gerando_contestacao") return pf === "gerando_contestacao" || pf === "contestacao_gerando";
              if (fase.key === "revisao") return pf === "revisao" || pf === "contestacao_revisao";
              return pf === fase.key;
            });
            return (
              <div key={fase.key} style={{
                minWidth: 200, flex: "0 0 auto",
                borderRight: fi < PIPELINE_FASES.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  padding: "8px 12px", background: "var(--bg-3)",
                  borderBottom: "1px solid var(--border)", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {fase.symbol} {fase.label}
                  </span>
                  {casos.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                      background: "var(--gold-bg)", color: "var(--gold)",
                    }}>{casos.length}</span>
                  )}
                </div>
                <div style={{ minHeight: 60 }}>
                  {casos.length === 0 ? (
                    <div style={{ padding: "16px 12px", fontSize: 11, color: "var(--text-4)", textAlign: "center" }}>—</div>
                  ) : (
                    casos.map(p => {
                      const r = getRisco(p);
                      return (
                        <div
                          key={p.id}
                          onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                          style={{
                            padding: "9px 12px", borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "")}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.clients?.name || "—"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.polo_ativo?.nome || "—"}
                          </div>
                          {r && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                              background: riscoBg[r] || "var(--bg-3)", color: riscoColor[r] || "var(--text-3)",
                            }}>
                              {riscoLabel[r] || r}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      {!loading && upcoming.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Prazos Próximos
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-3)" }}>
                  {["Processo", "Cliente", "Polo Ativo", "Prazo", "Dias restantes", "Risco"].map(col => (
                    <th key={col} style={{
                      padding: "8px 14px", fontWeight: 600, textAlign: "left", fontSize: 10,
                      color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--border)",
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcoming.map(p => {
                  const d = daysUntil(p.prazo_contestacao || "");
                  const r = getRisco(p);
                  const diasColor = d !== null && d <= 3 ? "#ef4444" : d !== null && d <= 7 ? "#f59e0b" : "var(--text-2)";
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--text-2)", fontSize: 11 }}>
                        {p.numero_processo || <span style={{ color: "var(--text-4)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{p.clients?.name || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-2)" }}>{p.polo_ativo?.nome || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-2)" }}>{fmtDate(p.prazo_contestacao || "")}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: diasColor }}>
                        {d === null ? "—" : d <= 0 ? "Vencido" : `${d}d`}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {r ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                            background: riscoBg[r] || "var(--bg-3)", color: riscoColor[r] || "var(--text-3)",
                          }}>
                            {riscoLabel[r] || r}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
    </div>
  );
}
