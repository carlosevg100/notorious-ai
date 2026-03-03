"use client";
import { useState, useEffect } from "react";

interface Analysis {
  is_predatory: boolean;
  confidence: "alto" | "medio" | "baixo";
  indicators: string[];
  volume_estimate: string;
  recommendation: string;
  profile: string;
}

interface HistoryItem {
  id: string;
  advogado_nome: string;
  advogado_oab: string | null;
  advogado_estado: string | null;
  result: Analysis;
  created_at: string;
}

const confidenceLabel: Record<string, string> = { alto: "Alta", medio: "Média", baixo: "Baixa" };
const confidenceColor: Record<string, string> = { alto: "#ef4444", medio: "#eab308", baixo: "#22c55e" };

export default function LitiganciaPage() {
  const [nome, setNome] = useState("");
  const [oab, setOab] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ advogado: any; analysis: Analysis; source: string } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    try {
      const res = await fetch("/api/litigancia-predatoria");
      if (res.ok) setHistory(await res.json());
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/litigancia-predatoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advogado_nome: nome, advogado_oab: oab || undefined, advogado_estado: estado || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao analisar."); return; }
      setResult(data);
      loadHistory();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.analysis;

  return (
    <div style={{ padding: "28px", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>⚖</span>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text)" }}>
            Litigância Predatória
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-4)", maxWidth: "600px" }}>
          Identifique advogados da parte contrária que praticam litigância predatória em massa.
          A IA analisa padrões de volume e características típicas de escritórios contumazes.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Form */}
        <div>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "13px", fontWeight: "600", color: "var(--gold)" }}>
              Analisar Advogado
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Nome do Advogado *
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João Silva Santos"
                  required
                />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Número OAB (opcional)
                </label>
                <input
                  value={oab}
                  onChange={e => setOab(e.target.value)}
                  placeholder="Ex: 123456"
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Estado (opcional)
                </label>
                <select value={estado} onChange={e => setEstado(e.target.value)} style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text)", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", width: "100%" }}>
                  <option value="">Selecionar estado</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div style={{ marginBottom: "14px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid #ef444440", borderRadius: "6px", fontSize: "12px", color: "#ef4444" }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-gold" disabled={loading || !nome.trim()}
                style={{ width: "100%", justifyContent: "center", padding: "11px" }}>
                {loading ? "⚖ Analisando..." : "⚖ Analisar"}
              </button>
            </form>

            {loading && (
              <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-2)", borderRadius: "6px", fontSize: "12px", color: "var(--text-4)", textAlign: "center" }}>
                IA consultando bases de dados e padrões de litigância...
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="card" style={{ padding: "20px", marginTop: "16px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "600", color: "var(--text-4)", textTransform: "uppercase" }}>
                Histórico de Consultas
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.map(h => (
                  <div key={h.id} style={{ padding: "10px 12px", background: "var(--bg-2)", borderRadius: "6px", cursor: "pointer", border: "1px solid var(--border)" }}
                    onClick={() => setResult({ advogado: { nome: h.advogado_nome, oab: h.advogado_oab, estado: h.advogado_estado }, analysis: h.result, source: "" })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-2)" }}>{h.advogado_nome}</div>
                      <div style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: h.result.is_predatory ? "#ef4444" : "#22c55e", flexShrink: 0
                      }} />
                    </div>
                    {h.advogado_oab && (
                      <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "2px" }}>OAB {h.advogado_oab}{h.advogado_estado ? `/${h.advogado_estado}` : ""}</div>
                    )}
                    <div style={{ fontSize: "10px", color: "var(--text-5)", marginTop: "2px" }}>
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ padding: "60px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚖</div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-2)", marginBottom: "8px" }}>
                Análise de Litigância Predatória
              </div>
              <p style={{ margin: "0 auto", fontSize: "13px", color: "var(--text-4)", maxWidth: "400px" }}>
                Preencha os dados do advogado da parte contrária para identificar padrões de litigância predatória.
              </p>
            </div>
          )}

          {result && verdict && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Verdict banner */}
              <div style={{
                padding: "20px 24px",
                borderRadius: "10px",
                background: verdict.is_predatory
                  ? verdict.confidence === "alto" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)"
                  : "rgba(34,197,94,0.1)",
                border: `1px solid ${verdict.is_predatory
                  ? verdict.confidence === "alto" ? "#ef444440" : "#eab30840"
                  : "#22c55e40"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: verdict.is_predatory ? (verdict.confidence === "alto" ? "#ef4444" : "#eab308") : "#22c55e" }}>
                      {verdict.is_predatory
                        ? verdict.confidence === "alto"
                          ? "🚨 Alta probabilidade de litigância predatória"
                          : "⚠️ Indicadores moderados — monitorar"
                        : "✓ Advogado sem indicadores de litigância predatória"}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
                      {result.advogado.nome}
                      {result.advogado.oab && ` · OAB ${result.advogado.oab}`}
                      {result.advogado.estado && `/${result.advogado.estado}`}
                    </div>
                  </div>
                  <div style={{
                    padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                    background: `${confidenceColor[verdict.confidence]}20`,
                    color: confidenceColor[verdict.confidence],
                    border: `1px solid ${confidenceColor[verdict.confidence]}40`,
                    whiteSpace: "nowrap"
                  }}>
                    Confiança {confidenceLabel[verdict.confidence]}
                  </div>
                </div>

                <div style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: "1.6" }}>
                  {verdict.recommendation}
                </div>
              </div>

              {/* Volume estimate */}
              <div className="card" style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Estimativa de Volume de Ações
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-2)" }}>{verdict.volume_estimate}</div>
              </div>

              {/* Indicators */}
              {verdict.indicators?.length > 0 && (
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "12px", fontWeight: "600" }}>
                    Indicadores Identificados
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {verdict.indicators.map((ind, i) => (
                      <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 12px", background: "var(--bg-2)", borderRadius: "6px" }}>
                        <span style={{ color: verdict.is_predatory ? "#ef4444" : "#22c55e", fontWeight: "700", fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>
                          {verdict.is_predatory ? "•" : "✓"}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: "1.5" }}>{ind}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile */}
              {verdict.profile && (
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>
                    Perfil Jurídico
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: "1.6" }}>{verdict.profile}</div>
                </div>
              )}

              {result.source && (
                <div style={{ fontSize: "11px", color: "var(--text-5)", textAlign: "right" }}>
                  Fontes: {result.source}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
