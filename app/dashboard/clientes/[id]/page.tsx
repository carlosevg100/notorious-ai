"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  type?: string;
  created_at: string;
}

interface Processo {
  id: string;
  numero_processo?: string;
  polo_ativo?: { nome?: string };
  fase: string;
  prazo_contestacao?: string;
  risco?: string;
}

const FASES: Record<string, { label: string; color: string }> = {
  recebido: { label: "Recebido", color: "#3b82f6" },
  extracao: { label: "Extração", color: "#8b5cf6" },
  docs_solicitados: { label: "Docs Solicitados", color: "#f97316" },
  docs_recebidos: { label: "Docs Recebidos", color: "#10b981" },
  contestacao_gerando: { label: "Gerando Contestação", color: "#C9A84C" },
  contestacao_revisao: { label: "Revisão", color: "#ec4899" },
  protocolado: { label: "Protocolado", color: "#22c55e" },
  aguardando_replica: { label: "Aguard. Réplica", color: "#06b6d4" },
};

function riscoBadge(risco?: string) {
  const r = risco?.toLowerCase();
  if (r === "alto") return { color: "#ef4444", label: "Alto" };
  if (r === "medio" || r === "médio") return { color: "#f59e0b", label: "Médio" };
  return { color: "#22c55e", label: "Baixo" };
}

function diasRestantes(prazo?: string) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"processos" | "contatos">("processos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/clients/${id}`),
        fetch("/api/processos"),
      ]);
      if (cRes.ok) setClient(await cRes.json());
      if (pRes.ok) {
        const all: Processo[] = await pRes.json();
        setProcessos(all.filter((p: any) => p.client_id === id));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{client.name}</h1>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: client.type === "PF" ? "#3b82f620" : "#8b5cf620",
              color: client.type === "PF" ? "#3b82f6" : "#8b5cf6",
            }}>
              {client.type || "PJ"}
            </span>
          </div>
          <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>
            {processos.length} processo{processos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href={`/dashboard/processos/new?client_id=${id}`}>
          <button className="btn-gold">+ Novo Processo</button>
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {(["processos", "contatos"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 500, background: "none",
              border: "none", cursor: "pointer", borderBottom: `2px solid ${tab === t ? "var(--gold)" : "transparent"}`,
              color: tab === t ? "var(--gold)" : "var(--text-3)", marginBottom: -1,
            }}
          >
            {t === "processos" ? "Processos" : "Contatos"}
          </button>
        ))}
      </div>

      {tab === "processos" && (
        processos.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div>Nenhum processo para este cliente.</div>
            <Link href={`/dashboard/processos/new?client_id=${id}`}>
              <button className="btn-gold" style={{ marginTop: 16 }}>+ Novo Processo</button>
            </Link>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-2)", color: "var(--text-3)" }}>
                  {["Processo", "Polo Ativo", "Fase", "Prazo", "Risco"].map(col => (
                    <th key={col} style={{ padding: "10px 16px", fontWeight: 500, textAlign: "left", borderBottom: "1px solid var(--border)" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processos.map(p => {
                  const dias = diasRestantes(p.prazo_contestacao);
                  const badge = riscoBadge(p.risco);
                  const fase = FASES[p.fase] || { label: p.fase, color: "#888" };
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/processos/${p.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12 }}>
                        {p.numero_processo || <span style={{ color: "var(--text-4)" }}>Sem número</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{p.polo_ativo?.nome || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: fase.color + "20", color: fase.color, padding: "2px 8px", borderRadius: 99, fontWeight: 500, fontSize: 11 }}>
                          {fase.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {dias !== null ? (
                          <span style={{ color: dias <= 0 ? "#ef4444" : dias <= 5 ? "#f59e0b" : "var(--text)", fontWeight: dias <= 5 ? 700 : 400 }}>
                            {dias <= 0 ? "Vencido" : `${dias} dias`}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: badge.color + "22", color: badge.color, padding: "2px 8px", borderRadius: 99, fontWeight: 600, fontSize: 11 }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "contatos" && (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📇</div>
          <div>Contatos do cliente em breve.</div>
        </div>
      )}
    </div>
  );
}
