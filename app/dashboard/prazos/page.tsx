"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Processo {
  id: string;
  numero_processo?: string;
  polo_ativo?: { nome?: string };
  polo_passivo?: { nome?: string };
  valor_causa?: number;
  risco?: string;
  prazo_contestacao?: string;
  clients?: { name: string };
  client_id?: string;
}

type FilterPeriod = "todos" | "vencidos" | "semana" | "30dias";
type FilterRisco = "" | "alto" | "medio" | "baixo";

const riscoBg: Record<string, string> = { alto: "rgba(239,68,68,0.15)", medio: "rgba(245,158,11,0.15)", baixo: "rgba(34,197,94,0.15)" };
const riscoColor: Record<string, string> = { alto: "#ef4444", medio: "#f59e0b", baixo: "#22c55e" };
const riscoLabel: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

const fmtDate = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const fmtMoney = (v?: number) => v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v) : "—";

function daysUntil(d?: string) {
  if (!d) return null;
  return Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 86400000);
}

function getRisco(r?: string) {
  return (r || "").toLowerCase().replace("é", "e");
}

function getStatus(days: number | null): { label: string; color: string } {
  if (days === null) return { label: "—", color: "var(--text-3)" };
  if (days < 0) return { label: "Vencido", color: "#ef4444" };
  if (days <= 3) return { label: "Crítico", color: "#f97316" };
  if (days <= 7) return { label: "Próximo", color: "#f59e0b" };
  return { label: "Normal", color: "var(--text-3)" };
}

export default function PrazosPage() {
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("todos");
  const [filterRisco, setFilterRisco] = useState<FilterRisco>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/processos");
      if (res.ok) {
        const all: Processo[] = await res.json();
        // Only processos with prazo set
        setProcessos(all.filter(p => p.prazo_contestacao));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = processos
    .filter(p => {
      const d = daysUntil(p.prazo_contestacao);
      if (filterPeriod === "vencidos" && (d === null || d >= 0)) return false;
      if (filterPeriod === "semana" && (d === null || d < 0 || d > 7)) return false;
      if (filterPeriod === "30dias" && (d === null || d < 0 || d > 30)) return false;
      if (filterRisco) {
        const r = getRisco(p.risco);
        if (r !== filterRisco) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.prazo_contestacao! + "T12:00:00").getTime();
      const db = new Date(b.prazo_contestacao! + "T12:00:00").getTime();
      return da - db;
    });

  const PERIOD_FILTERS: { key: FilterPeriod; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "vencidos", label: "Vencidos" },
    { key: "semana", label: "Esta semana" },
    { key: "30dias", label: "Próximos 30 dias" },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>PRAZOS</h1>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        {PERIOD_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilterPeriod(f.key)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500,
              border: `1px solid ${filterPeriod === f.key ? "var(--gold)" : "var(--border)"}`,
              background: filterPeriod === f.key ? "var(--gold-bg)" : "transparent",
              color: filterPeriod === f.key ? "var(--gold)" : "var(--text-3)",
            }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        <select
          value={filterRisco}
          onChange={e => setFilterRisco(e.target.value as FilterRisco)}
          style={{
            background: "var(--bg-2)", border: "1px solid var(--border)", color: filterRisco ? riscoColor[filterRisco] : "var(--text-3)",
            borderRadius: 6, padding: "6px 10px", fontSize: 12,
          }}
        >
          <option value="">Risco: Todos</option>
          <option value="alto">Alto</option>
          <option value="medio">Médio</option>
          <option value="baixo">Baixo</option>
        </select>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            Nenhum prazo encontrado para o filtro selecionado.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg-3)" }}>
                {["Vencimento", "Processo", "Cliente", "Polo Ativo", "Valor", "Risco", "Status"].map(col => (
                  <th key={col} style={{
                    padding: "9px 14px", fontWeight: 600, textAlign: "left", fontSize: 10,
                    color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const d = daysUntil(p.prazo_contestacao);
                const status = getStatus(d);
                const r = getRisco(p.risco);
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "11px 14px", fontWeight: 600, color: status.color }}>
                      {fmtDate(p.prazo_contestacao || "")}
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-2)" }}>
                      {p.numero_processo || "—"}
                    </td>
                    <td style={{ padding: "11px 14px", fontWeight: 600 }}>{p.clients?.name || "—"}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text-2)" }}>{p.polo_ativo?.nome || "—"}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text-2)" }}>{fmtMoney(p.valor_causa)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      {r ? (
                        <span style={{ background: riscoBg[r], color: riscoColor[r], padding: "2px 8px", borderRadius: 99, fontWeight: 600, fontSize: 11 }}>
                          {riscoLabel[r] || r}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontWeight: 700, fontSize: 11, color: status.color }}>
                        {status.label}
                        {d !== null && d >= 0 && ` (${d}d)`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
