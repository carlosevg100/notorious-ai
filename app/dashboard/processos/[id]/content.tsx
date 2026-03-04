"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Processo {
  id: string;
  numero_processo?: string;
  tribunal?: string;
  comarca?: string;
  vara?: string;
  juiz?: string;
  classe_processual?: string;
  assunto?: string;
  valor_causa?: number;
  polo_ativo?: { nome?: string; tipo?: string; cpf_cnpj?: string; endereco?: string; advogados?: {nome:string;oab:string;email?:string}[]; advogado?: string; oab?: string };
  polo_passivo?: { nome?: string; cpf_cnpj?: string };
  pedidos?: ({tipo?:string;descricao?:string;valor?:number;base_calculo?:string} | string)[];
  tutela_urgencia?: boolean;
  fatos_resumidos?: string;
  causa_pedir?: string;
  fundamentos_juridicos?: any;
  documentos_mencionados?: string[];
  resumo_executivo?: string;
  fase: string;
  prazo_contestacao?: string;
  risco?: string;
  teses_defesa?: any[];
  causa_pedir_estruturada?: any;
  contestacao_gerada?: string;
  clients?: { id: string; name: string; type?: string };
  client_id?: string;
  created_at: string;
}

interface Doc {
  id: string;
  name: string;
  file_path: string;
  file_type?: string;
  ai_status?: string;
  created_at: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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

const TABS = [
  { key: "visao", label: "Visão Geral" },
  { key: "fases", label: "Fases" },
  { key: "documentos", label: "Documentos" },
  { key: "ia", label: "IA Workspace" },
  { key: "pecas", label: "Peças" },
  { key: "prazos", label: "Prazos" },
  { key: "logs", label: "Logs" },
];

const DOC_FOLDERS = ["Inicial e Anexos", "Docs do Cliente", "Contratos/Apólices", "Provas", "Peças do Escritório"];

function faseCor(fase: string) { return FASES.find(f => f.key === fase)?.color || "#888"; }
function faseLabel(fase: string) { return FASES.find(f => f.key === fase)?.label || fase; }
function nextFase(current: string) {
  const idx = FASES.findIndex(f => f.key === current);
  return idx >= 0 && idx < FASES.length - 1 ? FASES[idx + 1].key : null;
}
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
function formatCurrency(v?: number) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProcessoContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const extracaoFlag = searchParams.get("extracao") === "1";

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("visao");
  const [docAiStatus, setDocAiStatus] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [teses, setTeses] = useState<string[]>([]);
  const [selectedTeses, setSelectedTeses] = useState<Set<number>>(new Set());
  const [loadingTeses, setLoadingTeses] = useState(false);
  const [contestacaoText, setContestacaoText] = useState("");
  const [loadingContestacao, setLoadingContestacao] = useState(false);
  const [pecasStep, setPecasStep] = useState(1);

  const [extracting, setExtracting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docFolder, setDocFolder] = useState("Inicial e Anexos");

  const loadProcesso = useCallback(async () => {
    try {
      const res = await fetch(`/api/processos/${id}`);
      if (res.ok) setProcesso(await res.json());
    } catch {}
  }, [id]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?processo_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
        const processing = data.find((d: Doc) => d.ai_status === "processing");
        setDocAiStatus(processing ? "processing" : null);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProcesso(), loadDocs()]);
      setLoading(false);
    };
    init();
  }, [loadProcesso, loadDocs]);

  useEffect(() => {
    if (docAiStatus !== "processing") return;
    const interval = setInterval(async () => {
      await Promise.all([loadProcesso(), loadDocs()]);
    }, 4000);
    return () => clearInterval(interval);
  }, [docAiStatus, loadProcesso, loadDocs]);

  // When redirected from upload with ?extracao=1, trigger extraction client-side
  // This bypasses Vercel 10s timeout — extraction runs from browser fetch
  useEffect(() => {
    if (!extracaoFlag) return;
    let cancelled = false;
    const run = async () => {
      // Wait for page to load first
      await new Promise(r => setTimeout(r, 1000));
      if (cancelled) return;
      setExtracting(true);
      try {
        await fetch(`/api/processos/${id}/extrair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      } catch {}
      if (!cancelled) {
        setExtracting(false);
        await Promise.all([loadProcesso(), loadDocs()]);
        // Remove ?extracao=1 from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete("extracao");
        window.history.replaceState({}, "", url.toString());
      }
    };
    run();
    return () => { cancelled = true; };
  }, [extracaoFlag, id, loadProcesso, loadDocs]);

  async function advanceFase() {
    if (!processo) return;
    const next = nextFase(processo.fase);
    if (!next) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/processos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fase: next }),
      });
      if (res.ok) await loadProcesso();
    } finally {
      setAdvancing(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const context = processo
        ? `Processo: ${processo.numero_processo || "s/n"} | Cliente: ${processo.clients?.name} | ${processo.polo_ativo?.nome} vs ${processo.polo_passivo?.nome} | Fase: ${faseLabel(processo.fase)} | ${processo.fatos_resumidos || ""}`.slice(0, 500)
        : "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatMsgs, { role: "user", content: userMsg }], context }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMsgs(prev => [...prev, { role: "assistant", content: data.content || "Sem resposta." }]);
      }
    } finally {
      setChatLoading(false);
    }
  }

  async function loadTeses() {
    setLoadingTeses(true);
    try {
      const res = await fetch(`/api/processos/${id}/teses`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const arr: string[] = Array.isArray(data) ? data : data.teses || [];
        setTeses(arr);
        setSelectedTeses(new Set(arr.map((_, i) => i)));
      }
    } finally {
      setLoadingTeses(false);
    }
  }

  async function gerarContestacao() {
    if (selectedTeses.size === 0) return;
    setLoadingContestacao(true);
    try {
      const chosen = teses.filter((_, i) => selectedTeses.has(i));
      const res = await fetch(`/api/processos/${id}/contestacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teses: chosen }),
      });
      if (res.ok) {
        const data = await res.json();
        setContestacaoText(data.contestacao || data.text || "");
        await loadProcesso();
      }
    } finally {
      setLoadingContestacao(false);
    }
  }

  async function uploadDoc(file: File) {
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("processo_id", id);
      formData.append("folder", docFolder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        await loadDocs();
        // Poll for extraction completion (max 15s)
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          await loadDocs();
          if (attempts >= 5) clearInterval(poll);
        }, 3000);
      }
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Carregando...</div>;
  if (!processo) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ color: "#ef4444", marginBottom: 16 }}>Processo não encontrado.</div>
      <button className="btn-ghost" onClick={() => router.push("/dashboard")}>← Voltar</button>
    </div>
  );

  const dias = diasRestantes(processo.prazo_contestacao);
  const badge = riscoBadge(processo.risco);
  const fColor = faseCor(processo.fase);
  const next = nextFase(processo.fase);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", padding: "16px 32px", position: "sticky", top: 0, zIndex: 30 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
          <Link href="/dashboard/clientes" style={{ color: "var(--text-3)", textDecoration: "none" }}>Clientes</Link>
          <span>›</span>
          {processo.clients && (
            <>
              <Link href={`/dashboard/clientes/${processo.client_id}`} style={{ color: "var(--text-3)", textDecoration: "none" }}>
                {processo.clients.name}
              </Link>
              <span>›</span>
            </>
          )}
          <span style={{ color: "var(--text)" }}>{processo.numero_processo || "Novo Processo"}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ background: fColor + "20", color: fColor, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {faseLabel(processo.fase)}
              </span>
              <span style={{ background: badge.color + "22", color: badge.color, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                Risco {badge.label}
              </span>
              {processo.tutela_urgencia && (
                <span style={{ background: "#ef444422", color: "#ef4444", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                  ⚡ Tutela Urgência
                </span>
              )}
            </div>

            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {processo.polo_ativo?.nome || "Polo Ativo"}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 400 }}>vs</span>{" "}
              {processo.polo_passivo?.nome || "Polo Passivo"}
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Nº Processo", value: processo.numero_processo || "—" },
                { label: "Foro/Vara", value: [processo.comarca, processo.vara].filter(Boolean).join(" · ") || "—" },
                { label: "Juiz", value: processo.juiz || "—" },
                { label: "Valor", value: formatCurrency(processo.valor_causa) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "var(--text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>

            {dias !== null && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: dias <= 0 ? "#ef4444" : dias <= 5 ? "#f59e0b" : "var(--text-3)" }}>
                {dias <= 0 ? "⚠ Prazo vencido" : `📅 ${dias} dias para contestação`}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {next && (
              <button className="btn-gold" onClick={advanceFase} disabled={advancing} style={{ fontSize: 12 }}>
                {advancing ? "..." : `Avançar ▶ ${faseLabel(next)}`}
              </button>
            )}
          </div>
        </div>

        {(extracaoFlag || extracting || docAiStatus === "processing") && (
          <div style={{ marginTop: 12, background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: 6, padding: "8px 14px", fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            <span><strong>IA analisando a petição inicial...</strong> Extraindo partes, pedidos, teses e risco. Aguarde alguns segundos.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)", display: "flex", paddingLeft: 32, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer",
            whiteSpace: "nowrap", marginBottom: -1,
            borderBottom: `2px solid ${tab === t.key ? "var(--gold)" : "transparent"}`,
            color: tab === t.key ? "var(--gold)" : "var(--text-3)", transition: "color 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: 1100 }}>

        {/* VISÃO GERAL */}
        {tab === "visao" && (() => {
          // Get full extraction from fundamentos_juridicos (stored as full JSON)
          const ext: any = typeof processo.fundamentos_juridicos === 'object' && !Array.isArray(processo.fundamentos_juridicos) && processo.fundamentos_juridicos?.extracted_at
            ? processo.fundamentos_juridicos : null;
          const fmtMoney = (v: number) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v) : null;
          const SectionTitle = ({ children }: { children: React.ReactNode }) => (
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{children}</div>
          );
          const hasData = processo.resumo_executivo || processo.fatos_resumidos || (processo.pedidos?.length || 0) > 0;
          if (!hasData) return (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Nenhum dado extraído ainda.</div>
              <div style={{ fontSize: 12 }}>Vá em <strong>Documentos</strong> → faça upload da petição inicial → a IA extrai tudo automaticamente.</div>
            </div>
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Resumo executivo */}
              {processo.resumo_executivo && (
                <div className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--gold)' }}>
                  <SectionTitle>📋 Resumo Executivo</SectionTitle>
                  <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-2)', margin: 0 }}>{processo.resumo_executivo}</p>
                </div>
              )}

              {/* Partes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>⚔️ Polo Ativo (Autor)</SectionTitle>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{processo.polo_ativo?.nome || '—'}</div>
                  {(ext?.polo_ativo?.tipo || processo.polo_ativo?.tipo) && <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 4 }}>{ext?.polo_ativo?.tipo || processo.polo_ativo?.tipo}</div>}
                  {(ext?.polo_ativo?.cpf_cnpj || processo.polo_ativo?.cpf_cnpj) && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>CPF/CNPJ: {ext?.polo_ativo?.cpf_cnpj || processo.polo_ativo?.cpf_cnpj}</div>}
                  {ext?.polo_ativo?.endereco && <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>📍 {ext.polo_ativo.endereco}</div>}
                  {(ext?.polo_ativo?.advogados?.length > 0 ? ext.polo_ativo.advogados : processo.polo_ativo?.advogado ? [{nome: processo.polo_ativo.advogado, oab: processo.polo_ativo.oab}] : []).map((a: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-4)', borderTop: i === 0 ? '1px solid var(--border)' : 'none', paddingTop: i === 0 ? 8 : 2 }}>
                      ⚖️ {a.nome} {a.oab && <span style={{ color: 'var(--text-5)' }}>• {a.oab}</span>}
                    </div>
                  ))}
                </div>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>🛡️ Polo Passivo (Réu)</SectionTitle>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{processo.polo_passivo?.nome || '—'}</div>
                  {processo.polo_passivo?.cpf_cnpj && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>CPF/CNPJ: {processo.polo_passivo.cpf_cnpj}</div>}
                  {ext?.polo_passivo?.endereco && <div style={{ fontSize: 12, color: 'var(--text-4)' }}>📍 {ext.polo_passivo.endereco}</div>}
                </div>
              </div>

              {/* Causa de pedir */}
              {(ext?.causa_pedir || processo.causa_pedir) && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>📌 Causa de Pedir</SectionTitle>
                  {ext?.causa_pedir?.proxima ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-5)', textTransform: 'uppercase' }}>Próxima (Fatos):</span><p style={{ fontSize: 13, color: 'var(--text-2)', margin: '4px 0 0', lineHeight: 1.7 }}>{ext.causa_pedir.proxima}</p></div>
                      {ext.causa_pedir.remota && <div><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-5)', textTransform: 'uppercase' }}>Remota (Fundamento):</span><p style={{ fontSize: 13, color: 'var(--text-2)', margin: '4px 0 0', lineHeight: 1.7 }}>{ext.causa_pedir.remota}</p></div>}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.7 }}>{typeof processo.causa_pedir === 'string' ? processo.causa_pedir : ''}</p>
                  )}
                </div>
              )}

              {/* Teses jurídicas */}
              {(ext?.teses_juridicas_autor?.length > 0 || (processo.teses_defesa?.length || 0) > 0) && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>⚖️ Teses Jurídicas do Autor</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {((ext?.teses_juridicas_autor || processo.teses_defesa || []) as any[]).map((t: any, i: number) => (
                      <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 6, borderLeft: '2px solid var(--gold-border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t.tese || (typeof t === 'string' ? t : '')}</div>
                        {t.fundamento && <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 4 }}>📖 {t.fundamento}</div>}
                        {t.descricao && <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>{t.descricao}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pedidos */}
              {(processo.pedidos?.length || 0) > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>💰 Pedidos</div>
                    {(ext?.valor_total_pedidos || processo.valor_causa) && (
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>Total: {fmtMoney(ext?.valor_total_pedidos || processo.valor_causa || 0)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {processo.pedidos!.map((p: any, i: number) => {
                      const desc = typeof p === 'string' ? p : p.descricao || '';
                      const val = typeof p === 'object' ? p.valor : null;
                      const tipo = typeof p === 'object' ? p.tipo : null;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: tipo === 'tutela' ? 'rgba(239,68,68,0.15)' : tipo === 'principal' ? 'rgba(201,168,76,0.15)' : 'var(--bg)', color: tipo === 'tutela' ? '#ef4444' : tipo === 'principal' ? 'var(--gold)' : 'var(--text-5)', flexShrink: 0, textTransform: 'uppercase' }}>{tipo || String.fromCharCode(65+i)}</div>
                          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>
                          {val && <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>{fmtMoney(val)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fatos cronológicos */}
              {(ext?.fatos_cronologicos?.length > 0 || processo.fatos_resumidos) && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>📅 Fatos</SectionTitle>
                  {ext?.fatos_cronologicos?.length > 0 ? (
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      {ext.fatos_cronologicos.map((f: string, i: number) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.6 }}>{f}</li>
                      ))}
                    </ol>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.75 }}>{processo.fatos_resumidos}</p>
                  )}
                </div>
              )}

              {/* Tutela urgência */}
              {(ext?.tutela_urgencia?.possui || processo.tutela_urgencia) && (
                <div className="card" style={{ padding: '16px 20px', borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.04)' }}>
                  <SectionTitle>⚡ Tutela de Urgência</SectionTitle>
                  {ext?.tutela_urgencia?.tipo && <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6, textTransform: 'capitalize' }}>{ext.tutela_urgencia.tipo}</div>}
                  {ext?.tutela_urgencia?.descricao && <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{ext.tutela_urgencia.descricao}</p>}
                  {!ext?.tutela_urgencia?.descricao && <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Pedido de tutela de urgência detectado — verificar detalhes no documento.</p>}
                </div>
              )}

              {/* Documentos e próximos passos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(ext?.documentos_mencionados?.length > 0 || (processo.documentos_mencionados?.length || 0) > 0) && (
                  <div className="card" style={{ padding: '16px 20px' }}>
                    <SectionTitle>📎 Documentos Mencionados</SectionTitle>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {(ext?.documentos_mencionados || processo.documentos_mencionados || []).map((d: string, i: number) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5, lineHeight: 1.5 }}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(ext?.documentos_solicitar_cliente?.length > 0 || ext?.perguntas_ao_cliente?.length > 0) && (
                  <div className="card" style={{ padding: '16px 20px' }}>
                    <SectionTitle>🔔 Solicitar ao Cliente</SectionTitle>
                    {ext?.documentos_solicitar_cliente?.length > 0 && (
                      <ul style={{ margin: '0 0 8px', paddingLeft: 16 }}>
                        {ext.documentos_solicitar_cliente.map((d: string, i: number) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>📁 {d}</li>
                        ))}
                      </ul>
                    )}
                    {ext?.perguntas_ao_cliente?.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {ext.perguntas_ao_cliente.map((q: string, i: number) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 5 }}>❓ {q}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Risco e pontos de atenção */}
              {(ext?.risco_justificativa || ext?.pontos_atencao?.length > 0) && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <SectionTitle>⚠️ Análise de Risco</SectionTitle>
                  {ext?.risco_justificativa && <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.6 }}>{ext.risco_justificativa}</p>}
                  {ext?.pontos_atencao?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ext.pontos_atencao.map((p: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: '#f59e0b', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 4, display: 'flex', gap: 6 }}>
                          <span>▲</span><span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })()}

        {/* FASES */}
        {tab === "fases" && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Pipeline do Processo</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {FASES.map((f, i) => {
                const fIdx = FASES.findIndex(x => x.key === processo.fase);
                const done = i < fIdx;
                const current = i === fIdx;
                return (
                  <div key={f.key} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        border: `2px solid ${current ? f.color : done ? "#22c55e" : "var(--border)"}`,
                        background: current ? f.color + "22" : done ? "#22c55e22" : "var(--bg-2)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
                        color: current ? f.color : done ? "#22c55e" : "var(--text-4)",
                      }}>
                        {done ? "✓" : current ? "◉" : i + 1}
                      </div>
                      {i < FASES.length - 1 && (
                        <div style={{ width: 2, height: 32, background: done ? "#22c55e44" : "var(--border)", margin: "2px 0" }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 24 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: current ? f.color : done ? "#22c55e" : "var(--text-3)", marginBottom: 4 }}>
                        {f.label}
                        {current && <span style={{ marginLeft: 8, fontSize: 11, background: f.color + "22", color: f.color, padding: "1px 8px", borderRadius: 99 }}>ATUAL</span>}
                      </div>
                      {current && processo.prazo_contestacao && (
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                          Prazo: {new Date(processo.prazo_contestacao).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DOCUMENTOS */}
        {tab === "documentos" && (
          <div>
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select value={docFolder} onChange={e => setDocFolder(e.target.value)}
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 12 }}>
                  {DOC_FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input ref={docFileRef} type="file" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); }} />
                <button className="btn-gold" style={{ fontSize: 12 }} onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}>
                  {uploadingDoc ? "Enviando..." : "+ Upload"}
                </button>
              </div>
            </div>
            {docs.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-3)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                <div>Nenhum documento enviado.</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {docs.map((d, i) => (
                  <div key={d.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 20 }}>📄</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                          {new Date(d.created_at).toLocaleDateString("pt-BR")}
                          {d.ai_status && (
                            <span style={{ marginLeft: 8, color: d.ai_status === "complete" ? "#22c55e" : d.ai_status === "failed" ? "#ef4444" : "#f59e0b" }}>
                              {d.ai_status === "complete" ? "✓ Extraído" : d.ai_status === "failed" ? "✗ Falhou" : "⏳ Processando"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IA WORKSPACE */}
        {tab === "ia" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", height: 520 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13 }}>🤖 IA Workspace</div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMsgs.length === 0 && (
                <div style={{ color: "var(--text-4)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                  Pergunte sobre o processo, peça para sugerir teses, resumir fatos ou preparar perguntas ao cliente.
                </div>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "78%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                    background: m.role === "user" ? "var(--gold)" : "var(--bg-2)",
                    color: m.role === "user" ? "#000" : "var(--text)",
                    border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                    whiteSpace: "pre-wrap",
                  }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "var(--text-3)" }}>✍ Gerando...</div>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Pergunte sobre o processo..."
                style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }} />
              <button className="btn-gold" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ fontSize: 12 }}>Enviar</button>
            </div>
          </div>
        )}

        {/* PEÇAS */}
        {tab === "pecas" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ s: 1, label: "1. Teses" }, { s: 2, label: "2. Jurisprudência" }, { s: 3, label: "3. Contestação" }].map(({ s, label }) => (
                <button key={s} onClick={() => setPecasStep(s)} style={{
                  padding: "7px 18px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: pecasStep === s ? "var(--gold)" : "var(--bg-2)",
                  color: pecasStep === s ? "#000" : "var(--text-3)",
                  border: `1px solid ${pecasStep === s ? "var(--gold)" : "var(--border)"}`,
                }}>{label}</button>
              ))}
            </div>

            {pecasStep === 1 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Teses de Defesa</h3>
                  <button className="btn-gold" style={{ fontSize: 12 }} onClick={loadTeses} disabled={loadingTeses}>
                    {loadingTeses ? "Gerando..." : teses.length ? "Regenerar" : "✨ Sugerir Teses com IA"}
                  </button>
                </div>
                {teses.length === 0 && !loadingTeses && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>
                    Clique em "Sugerir Teses com IA" para gerar sugestões.
                  </div>
                )}
                {teses.map((t, i) => (
                  <div key={i} onClick={() => setSelectedTeses(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    style={{
                      display: "flex", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                      background: selectedTeses.has(i) ? "var(--gold-bg)" : "var(--bg-2)",
                      border: `1px solid ${selectedTeses.has(i) ? "var(--gold-border)" : "var(--border)"}`,
                      marginBottom: 8, transition: "all 0.15s",
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedTeses.has(i) ? "var(--gold)" : "var(--border-2)"}`,
                      background: selectedTeses.has(i) ? "var(--gold)" : "transparent", flexShrink: 0, marginTop: 1,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000",
                    }}>
                      {selectedTeses.has(i) ? "✓" : ""}
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.6 }}>{t}</span>
                  </div>
                ))}
                {teses.length > 0 && (
                  <button className="btn-gold" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setPecasStep(2)}>
                    Próximo: Jurisprudência →
                  </button>
                )}
              </div>
            )}

            {pecasStep === 2 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Jurisprudência</h3>
                <div style={{ background: "var(--bg-2)", borderRadius: 8, padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>🔍</div>
                  <p style={{ margin: 0 }}>Use a aba <Link href="/dashboard/pesquisa" style={{ color: "var(--gold)" }}>Jurisprudência</Link> para buscar precedentes por tese.</p>
                  <div style={{ marginTop: 8, fontSize: 12 }}>Teses selecionadas: {selectedTeses.size}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setPecasStep(1)}>← Voltar</button>
                  <button className="btn-gold" style={{ fontSize: 12 }} onClick={() => setPecasStep(3)}>Próximo: Gerar Contestação →</button>
                </div>
              </div>
            )}

            {pecasStep === 3 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Gerar Contestação</h3>
                  <button className="btn-gold" style={{ fontSize: 12 }} onClick={gerarContestacao} disabled={loadingContestacao || selectedTeses.size === 0}>
                    {loadingContestacao ? "Gerando..." : "✨ Gerar com IA"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
                  {selectedTeses.size} tese{selectedTeses.size !== 1 ? "s" : ""} selecionada{selectedTeses.size !== 1 ? "s" : ""}
                </div>
                {(contestacaoText || processo.contestacao_gerada) ? (
                  <textarea value={contestacaoText || processo.contestacao_gerada || ""} onChange={e => setContestacaoText(e.target.value)}
                    style={{ width: "100%", minHeight: 400, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.8, fontFamily: "inherit", resize: "vertical" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>
                    Clique em "Gerar com IA" para criar a contestação automaticamente.
                  </div>
                )}
                <button className="btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setPecasStep(2)}>← Voltar</button>
              </div>
            )}
          </div>
        )}

        {/* PRAZOS */}
        {tab === "prazos" && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Prazos</h3>
            {processo.prazo_contestacao ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Prazo de Contestação</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
                    {new Date(processo.prazo_contestacao).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: dias !== null && dias <= 0 ? "#ef4444" : dias !== null && dias <= 5 ? "#f59e0b" : "#22c55e" }}>
                  {dias !== null ? (dias <= 0 ? "VENCIDO" : `${dias} dias`) : "—"}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>Nenhum prazo cadastrado.</div>
            )}
          </div>
        )}

        {/* LOGS */}
        {tab === "logs" && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Histórico</h3>
            <div>
              {[
                { date: processo.created_at, event: "Processo criado", icon: "📋" },
                ...docs.map(d => ({ date: d.created_at, event: `Documento enviado: ${d.name}`, icon: "📄" })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((log, i, arr) => (
                  <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 16 }}>{log.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{log.event}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{new Date(log.date).toLocaleString("pt-BR")}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
