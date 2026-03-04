"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  type?: string;
  cnpj?: string;
  created_at: string;
}

interface Processo {
  id: string;
  numero_processo?: string;
  polo_ativo?: { nome?: string };
  fase: string;
  prazo_contestacao?: string;
  risco?: string;
  valor_causa?: number;
}

const FASES: Record<string, { label: string; color: string }> = {
  recebido: { label: "Recebido", color: "#3b82f6" },
  extracao: { label: "Extração", color: "#8b5cf6" },
  docs_solicitados: { label: "Docs Solicitados", color: "#f97316" },
  docs_recebidos: { label: "Docs Recebidos", color: "#10b981" },
  gerando_contestacao: { label: "Gerando Contestação", color: "#C9A84C" },
  contestacao_gerando: { label: "Gerando Contestação", color: "#C9A84C" },
  revisao: { label: "Revisão", color: "#ec4899" },
  contestacao_revisao: { label: "Revisão", color: "#ec4899" },
  protocolado: { label: "Protocolado", color: "#22c55e" },
  aguardando_replica: { label: "Aguard. Réplica", color: "#06b6d4" },
};

const riscoBg: Record<string, string> = { alto: "rgba(239,68,68,0.15)", medio: "rgba(245,158,11,0.15)", baixo: "rgba(34,197,94,0.15)" };
const riscoColor: Record<string, string> = { alto: "#ef4444", medio: "#f59e0b", baixo: "#22c55e" };
const riscoLabel: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

function diasRestantes(prazo?: string) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo + "T12:00:00").getTime() - Date.now()) / 86400000);
}

const fmtMoney = (v?: number) => v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v) : "—";
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function getRisco(r?: string) {
  return (r || "").toLowerCase().replace("é", "e");
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/clients/${id}`),
        fetch("/api/processos"),
      ]);
      if (cRes.ok) setClient(await cRes.json());
      if (pRes.ok) {
        const all: (Processo & { client_id?: string })[] = await pRes.json();
        setProcessos(all.filter(p => p.client_id === id));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, color: "var(--text-3)", textAlign: "center" }}>Carregando...</div>;
  if (!client) return <div style={{ padding: 40, color: "#ef4444", textAlign: "center" }}>Cliente não encontrado.</div>;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
        <Link href="/dashboard/clientes" style={{ color: "var(--text-3)", textDecoration: "none" }}>Clientes</Link>
        <span style={{ margin: "0 6px" }}>›</span>
        <span style={{ color: "var(--text)" }}>{client.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{client.name}</h1>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: client.type === "PF" ? "rgba(59,130,246,0.15)" : "rgba(139,92,246,0.15)",
              color: client.type === "PF" ? "#3b82f6" : "#8b5cf6",
            }}>
              {client.type || "PJ"}
            </span>
          </div>
          {client.cnpj && (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{client.cnpj}</div>
          )}
        </div>
        <Link href={`/dashboard/processos/new?client_id=${id}`}>
          <button className="btn-gold">+ Novo Processo</button>
        </Link>
      </div>

      {/* Processos Table */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Processos
        </h2>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {processos.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            Nenhum processo. Clique em + Novo Processo para iniciar.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-3)" }}>
                {["Nº Processo", "Polo Ativo", "Fase", "Risco", "Prazo Contestação", "Valor Causa", "→"].map(col => (
                  <th key={col} style={{
                    padding: "9px 14px", fontWeight: 600, textAlign: "left", fontSize: 10,
                    color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processos.map(p => {
                const dias = diasRestantes(p.prazo_contestacao);
                const r = getRisco(p.risco);
                const fase = FASES[p.fase] || { label: p.fase, color: "#888" };
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-2)" }}>
                      {p.numero_processo || <span style={{ color: "var(--text-4)" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>{p.polo_ativo?.nome || "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ background: fase.color + "20", color: fase.color, padding: "2px 8px", borderRadius: 99, fontWeight: 500, fontSize: 11 }}>
                        {fase.label}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {r ? (
                        <span style={{ background: riscoBg[r], color: riscoColor[r], padding: "2px 8px", borderRadius: 99, fontWeight: 600, fontSize: 11 }}>
                          {riscoLabel[r] || r}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {dias !== null ? (
                        <span style={{ color: dias <= 0 ? "#ef4444" : dias <= 5 ? "#f59e0b" : "var(--text-2)", fontWeight: dias <= 5 ? 700 : 400 }}>
                          {fmtDate(p.prazo_contestacao || "")}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--text-2)" }}>
                      {fmtMoney(p.valor_causa)}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--text-3)" }}>→</td>
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
