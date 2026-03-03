"use client";
import { useState, useEffect } from "react";

interface Analysis {
  irregular: boolean;
  confidence: "alto" | "medio" | "baixo";
  indicators: string[];
  recommendation: string;
  suggested_argument: string;
  risk_assessment: string;
}

interface HistoryItem {
  id: string;
  nome: string;
  cpf: string | null;
  result: Analysis;
  created_at: string;
}

const confidenceLabel: Record<string, string> = { alto: "Alta", medio: "Média", baixo: "Baixa" };
const confidenceColor: Record<string, string> = { alto: "#ef4444", medio: "#eab308", baixo: "#22c55e" };

export default function GratuidadePage() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pessoa: any; analysis: Analysis } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    try {
      const res = await fetch("/api/gratuidade");
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
      const res = await fetch("/api/gratuidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cpf: cpf || undefined, observacoes: observacoes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao verificar."); return; }
      setResult(data);
      loadHistory();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function copyArgument() {
    if (result?.analysis.suggested_argument) {
      navigator.clipboard.writeText(result.analysis.suggested_argument);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const verdict = result?.analysis;

  return (
    <div style={{ padding: "28px", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>💰</span>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text)" }}>
            Gratuidade de Justiça
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-4)", maxWidth: "600px" }}>
          Verifique se pedidos de gratuidade da parte contrária são legítimos.
          A IA avalia indicadores de patrimônio e gera argumentos para contestação.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Form */}
        <div>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "13px", fontWeight: "600", color: "var(--gold)" }}>
              Verificar Beneficiário
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Nome Completo *
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Maria Aparecida da Silva"
                  required
                />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  CPF (opcional)
                </label>
                <input
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                  Observações sobre o caso (opcional)
                </label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: Requerente alega desemprego mas processo indica vínculo empregatício ativo..."
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              {error && (
                <div style={{ marginBottom: "14px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid #ef444440", borderRadius: "6px", fontSize: "12px", color: "#ef4444" }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-gold" disabled={loading || !nome.trim()}
                style={{ width: "100%", justifyContent: "center", padding: "11px" }}>
                {loading ? "💰 Verificando..." : "💰 Verificar"}
              </button>
            </form>

            {loading && (
              <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-2)", borderRadius: "6px", fontSize: "12px", color: "var(--text-4)", textAlign: "center" }}>
                Verificando indicadores de patrimônio e histórico de litigância...
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="card" style={{ padding: "20px", marginTop: "16px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "600", color: "var(--text-4)", textTransform: "uppercase" }}>
                Histórico de Verificações
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.map(h => (
                  <div key={h.id} style={{ padding: "10px 12px", background: "var(--bg-2)", borderRadius: "6px", cursor: "pointer", border: "1px solid var(--border)" }}
                    onClick={() => setResult({ pessoa: { nome: h.nome, cpf: h.cpf }, analysis: h.result })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-2)" }}>{h.nome}</div>
                      <div style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: h.result.irregular ? "#ef4444" : "#22c55e", flexShrink: 0
                      }} />
                    </div>
                    {h.cpf && <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "2px" }}>CPF: {h.cpf}</div>}
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
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>💰</div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-2)", marginBottom: "8px" }}>
                Verificação de Gratuidade de Justiça
              </div>
              <p style={{ margin: "0 auto", fontSize: "13px", color: "var(--text-4)", maxWidth: "400px" }}>
                Informe os dados da parte que solicitou o benefício de gratuidade para análise automática.
              </p>
            </div>
          )}

          {result && verdict && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Verdict banner */}
              <div style={{
                padding: "20px 24px",
                borderRadius: "10px",
                background: verdict.irregular ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
                border: `1px solid ${verdict.irregular ? "#ef444440" : "#22c55e40"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: verdict.irregular ? "#ef4444" : "#22c55e" }}>
                      {verdict.irregular
                        ? "🚨 Indicadores de irregularidade — contestar"
                        : "✓ Pedido aparentemente legítimo"}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
                      {result.pessoa.nome}
                      {result.pessoa.cpf && ` · CPF ${result.pessoa.cpf}`}
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

              {/* Risk assessment */}
              {verdict.risk_assessment && (
                <div className="card" style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "600" }}>
                    Avaliação de Risco
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: "1.6" }}>{verdict.risk_assessment}</div>
                </div>
              )}

              {/* Indicators */}
              {verdict.indicators?.length > 0 && (
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", marginBottom: "12px", fontWeight: "600" }}>
                    Indicadores {verdict.irregular ? "de Irregularidade" : "de Legitimidade"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {verdict.indicators.map((ind, i) => (
                      <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 12px", background: "var(--bg-2)", borderRadius: "6px" }}>
                        <span style={{ color: verdict.irregular ? "#ef4444" : "#22c55e", fontWeight: "700", fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>
                          {verdict.irregular ? "•" : "✓"}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: "1.5" }}>{ind}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested argument (only if irregular) */}
              {verdict.irregular && verdict.suggested_argument && (
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", fontWeight: "600" }}>
                      Argumento Sugerido para Contestação
                    </div>
                    <button
                      onClick={copyArgument}
                      className="btn-ghost"
                      style={{ fontSize: "11px", padding: "4px 12px" }}>
                      {copied ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div style={{
                    padding: "16px",
                    background: "var(--bg-2)",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    color: "var(--text-2)",
                    lineHeight: "1.7",
                    whiteSpace: "pre-wrap",
                    maxHeight: "280px",
                    overflowY: "auto",
                    fontFamily: "inherit"
                  }}>
                    {verdict.suggested_argument}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
