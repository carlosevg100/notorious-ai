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
  polo_passivo?: { nome?: string; cpf_cnpj?: string; tipo?: string; endereco?: string };
  pedidos?: ({tipo?:string;descricao?:string;valor?:number;base_calculo?:string} | string)[];
  tutela_urgencia?: boolean;
  fatos_resumidos?: string;
  causa_pedir?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fundamentos_juridicos?: any;
  documentos_mencionados?: string[];
  resumo_executivo?: string;
  fase: string;
  prazo_contestacao?: string;
  risco?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teses_defesa?: any[];
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
  folder?: string;
  created_at: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const FASES = [
  { key: "recebido", label: "Recebido", color: "#888" },
  { key: "extracao", label: "Extração", color: "#8b5cf6" },
  { key: "docs_solicitados", label: "Docs Solicitados", color: "#3b82f6" },
  { key: "docs_recebidos", label: "Docs Recebidos", color: "#06b6d4" },
  { key: "gerando_contestacao", label: "Gerando Contestação", color: "#f59e0b" },
  { key: "contestacao_gerando", label: "Gerando Contestação", color: "#f59e0b" },
  { key: "revisao", label: "Revisão", color: "#f97316" },
  { key: "contestacao_revisao", label: "Revisão", color: "#f97316" },
  { key: "protocolado", label: "Protocolado", color: "#22c55e" },
  { key: "aguardando_replica", label: "Aguard. Réplica", color: "#06b6d4" },
];

const TABS = [
  { key: "analise", label: "Análise" },
  { key: "documentos", label: "Documentos" },
  { key: "contestacao", label: "Contestação" },
  { key: "prazos", label: "Prazos" },
  { key: "chat", label: "Chat IA" },
];

const DOC_FOLDERS = ["Inicial e Anexos", "Docs do Cliente", "Defesa", "Outros"];

function faseCor(fase: string) { return FASES.find(f => f.key === fase)?.color || "#888"; }
function faseLabel(fase: string) { return FASES.find(f => f.key === fase)?.label || fase; }

function nextFase(current: string) {
  const ORDER = ["recebido", "extracao", "docs_solicitados", "docs_recebidos", "gerando_contestacao", "revisao", "protocolado"];
  const normalized = current === "contestacao_gerando" ? "gerando_contestacao" : current === "contestacao_revisao" ? "revisao" : current;
  const idx = ORDER.indexOf(normalized);
  return idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
}

function getRisco(r?: string) { return (r || "").toLowerCase().replace("é", "e"); }

const riscoBg: Record<string, string> = { alto: "rgba(239,68,68,0.15)", medio: "rgba(245,158,11,0.15)", baixo: "rgba(34,197,94,0.15)" };
const riscoColor: Record<string, string> = { alto: "#ef4444", medio: "#f59e0b", baixo: "#22c55e" };
const riscoLabel: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

function diasRestantes(prazo?: string) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo + "T12:00:00").getTime() - Date.now()) / 86400000);
}

const fmtMoney = (v?: number) => v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v) : "—";
const fmtDate = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function ProcessoContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const extracaoFlag = searchParams.get("extracao") === "1";

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("analise");
  const [docAiStatus, setDocAiStatus] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Contestação
  const [teses, setTeses] = useState<string[]>([]);
  const [selectedTeses, setSelectedTeses] = useState<Set<number>>(new Set());
  const [loadingTeses, setLoadingTeses] = useState(false);
  const [contestacaoText, setContestacaoText] = useState("");
  const [loadingContestacao, setLoadingContestacao] = useState(false);
  const [contestacaoStep, setContestacaoStep] = useState(1);

  // Docs
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docDragging, setDocDragging] = useState(false);
  const [docFolder, setDocFolder] = useState("Inicial e Anexos");
  const docFileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!extracaoFlag) return;
    let cancelled = false;
    const run = async () => {
      await new Promise(r => setTimeout(r, 1000));
      if (cancelled) return;
      setExtracting(true);
      try {
        await fetch(`/api/processos/${id}/extrair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      } catch {}
      if (!cancelled) {
        setExtracting(false);
        await Promise.all([loadProcesso(), loadDocs()]);
        const url = new URL(window.location.href);
        url.searchParams.delete("extracao");
        window.history.replaceState({}, "", url.toString());
      }
    };
    run();
    return () => { cancelled = true; };
  }, [extracaoFlag, id, loadProcesso, loadDocs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

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
        setContestacaoStep(3);
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

  async function deleteDoc(docId: string) {
    if (!confirm("Remover este documento?")) return;
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      await loadDocs();
    } catch {}
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Carregando...</div>;
  if (!processo) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ color: "#ef4444", marginBottom: 16 }}>Processo não encontrado.</div>
      <button className="btn-ghost" onClick={() => router.push("/dashboard")}>← Voltar</button>
    </div>
  );

  const dias = diasRestantes(processo.prazo_contestacao);
  const r = getRisco(processo.risco);
  const fColor = faseCor(processo.fase);
  const next = nextFase(processo.fase);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ext: any = typeof processo.fundamentos_juridicos === "object" && !Array.isArray(processo.fundamentos_juridicos) && processo.fundamentos_juridicos?.extracted_at
    ? processo.fundamentos_juridicos : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Sticky Header */}
      <div style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", padding: "14px 32px", position: "sticky", top: 0, zIndex: 30 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, display: "flex", gap: 5, alignItems: "center" }}>
          <Link href="/dashboard/clientes" style={{ color: "var(--text-3)", textDecoration: "none" }}>Clientes</Link>
          {processo.clients && (
            <>
              <span>›</span>
              <Link href={`/dashboard/clientes/${processo.client_id}`} style={{ color: "var(--text-3)", textDecoration: "none" }}>
                {processo.clients.name}
              </Link>
            </>
          )}
          <span>›</span>
          <span style={{ color: "var(--text)" }}>{processo.numero_processo || "Processo"}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            {/* Parties */}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {processo.polo_ativo?.nome || "Polo Ativo"}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 14 }}>vs</span>{" "}
              {processo.polo_passivo?.nome || "Polo Passivo"}
            </div>

            {/* Metadata */}
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>Nº {processo.numero_processo || "—"}</span>
              {processo.tribunal && <><span style={{ color: "var(--border-2)" }}>|</span><span>{processo.tribunal}</span></>}
              {processo.vara && <><span style={{ color: "var(--border-2)" }}>|</span><span>{processo.vara}</span></>}
              {processo.juiz && <><span style={{ color: "var(--border-2)" }}>|</span><span>{processo.juiz}</span></>}
              {processo.valor_causa && <><span style={{ color: "var(--border-2)" }}>|</span><span style={{ color: "var(--text-2)" }}>{fmtMoney(processo.valor_causa)}</span></>}
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ background: fColor + "22", color: fColor, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {faseLabel(processo.fase)}
              </span>
              {r && (
                <span style={{ background: riscoBg[r], color: riscoColor[r], padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                  Risco {riscoLabel[r] || r}
                </span>
              )}
              {processo.tutela_urgencia && (
                <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                  ⚡ Tutela
                </span>
              )}
              {dias !== null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: dias <= 0 ? "#ef4444" : dias <= 3 ? "#ef4444" : dias <= 7 ? "#f59e0b" : "var(--text-3)" }}>
                  Prazo: {fmtDate(processo.prazo_contestacao || "")} — {dias <= 0 ? "Vencido" : `${dias}d`}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {next && (
              <button className="btn-gold" onClick={advanceFase} disabled={advancing} style={{ fontSize: 12 }}>
                {advancing ? "..." : `Avançar Fase ▶`}
              </button>
            )}
          </div>
        </div>

        {(extracaoFlag || extracting || docAiStatus === "processing") && (
          <div style={{ marginTop: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "7px 12px", fontSize: 12, color: "#f59e0b" }}>
            IA analisando a petição inicial... Aguarde alguns segundos.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)", display: "flex", paddingLeft: 32, overflowX: "auto", position: "sticky", top: 113, zIndex: 29 }}>
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

        {/* ===== ANÁLISE ===== */}
        {tab === "analise" && (() => {
          const hasData = processo.resumo_executivo || processo.fatos_resumidos || (processo.pedidos?.length || 0) > 0 || ext;
          const SectionTitle = ({ children }: { children: React.ReactNode }) => (
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{children}</div>
          );

          if (!hasData) return (
            <div className="card" style={{ padding: "60px 40px", textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 8 }}>A IA ainda não analisou este processo.</div>
              <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 20 }}>Faça upload da petição inicial na aba Documentos.</div>
              <button className="btn-gold" style={{ fontSize: 12 }} onClick={() => setTab("documentos")}>
                → Ir para Documentos
              </button>
            </div>
          );

          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* LEFT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Resumo Executivo */}
                {processo.resumo_executivo && (
                  <div className="card" style={{ padding: "16px 20px", borderLeft: "3px solid var(--gold)" }}>
                    <SectionTitle>Resumo Executivo</SectionTitle>
                    <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--text-2)", margin: 0 }}>{processo.resumo_executivo}</p>
                  </div>
                )}

                {/* Partes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="card" style={{ padding: "14px 16px" }}>
                    <SectionTitle>Polo Ativo (Autor)</SectionTitle>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{processo.polo_ativo?.nome || "—"}</div>
                    {(ext?.polo_ativo?.tipo || processo.polo_ativo?.tipo) && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
                        {ext?.polo_ativo?.tipo || processo.polo_ativo?.tipo}
                      </span>
                    )}
                    {(ext?.polo_ativo?.cpf_cnpj || processo.polo_ativo?.cpf_cnpj) && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                        {ext?.polo_ativo?.cpf_cnpj || processo.polo_ativo?.cpf_cnpj}
                      </div>
                    )}
                    {ext?.polo_ativo?.endereco && (
                      <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 3 }}>{ext.polo_ativo.endereco}</div>
                    )}
                    {((ext?.polo_ativo?.advogados?.length > 0 ? ext.polo_ativo.advogados : processo.polo_ativo?.advogado ? [{nome: processo.polo_ativo.advogado, oab: processo.polo_ativo.oab}] : []) as {nome:string;oab?:string}[]).map((a, i) => (
                      <div key={i} style={{ fontSize: 11, color: "var(--text-4)", borderTop: i === 0 ? "1px solid var(--border)" : "none", paddingTop: i === 0 ? 6 : 2, marginTop: i === 0 ? 8 : 0 }}>
                        {a.nome} {a.oab && <span style={{ color: "var(--text-5, var(--text-4))" }}>• {a.oab}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="card" style={{ padding: "14px 16px" }}>
                    <SectionTitle>Polo Passivo (Réu)</SectionTitle>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{processo.polo_passivo?.nome || "—"}</div>
                    {processo.polo_passivo?.cpf_cnpj && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{processo.polo_passivo.cpf_cnpj}</div>
                    )}
                    {!processo.polo_passivo?.nome && (
                      <div style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>Advogado não identificado</div>
                    )}
                  </div>
                </div>

                {/* Causa de Pedir */}
                {(ext?.causa_pedir || processo.causa_pedir) && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <SectionTitle>Causa de Pedir</SectionTitle>
                    {ext?.causa_pedir?.proxima ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", marginBottom: 4 }}>Próxima (Fatos)</div>
                          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.7 }}>{ext.causa_pedir.proxima}</p>
                        </div>
                        {ext.causa_pedir.remota && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", marginBottom: 4 }}>Remota (Fundamento)</div>
                            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.7 }}>{ext.causa_pedir.remota}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.7 }}>
                        {typeof processo.causa_pedir === "string" ? processo.causa_pedir : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Teses do Autor */}
                {(ext?.teses_juridicas_autor?.length > 0 || (processo.teses_defesa?.length || 0) > 0) && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <SectionTitle>Teses Jurídicas do Autor</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {((ext?.teses_juridicas_autor || processo.teses_defesa || []) as {tese?:string;fundamento?:string;descricao?:string}[]).map((t, i) => (
                        <div key={i} style={{ padding: "10px 12px", background: "var(--bg-3)", borderRadius: 6, borderLeft: "2px solid var(--gold-border)" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t.tese || ""}</div>
                          {t.fundamento && <div style={{ fontSize: 11, color: "var(--gold)", marginBottom: 3 }}>{t.fundamento}</div>}
                          {t.descricao && <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>{t.descricao}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Pedidos */}
                {(processo.pedidos?.length || 0) > 0 && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pedidos</div>
                      {(ext?.valor_total_pedidos || processo.valor_causa) && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>
                          Total: {fmtMoney(ext?.valor_total_pedidos || processo.valor_causa)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {processo.pedidos!.map((p, i) => {
                        const desc = typeof p === "string" ? p : (p as {descricao?:string}).descricao || "";
                        const val = typeof p === "object" ? (p as {valor?:number}).valor : null;
                        const tipo = typeof p === "object" ? (p as {tipo?:string}).tipo?.toUpperCase() : null;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "var(--bg-3)", borderRadius: 6 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0, textTransform: "uppercase",
                              background: tipo === "TUTELA" ? "rgba(239,68,68,0.15)" : tipo === "PRINCIPAL" ? "var(--gold-bg)" : "var(--bg)",
                              color: tipo === "TUTELA" ? "#ef4444" : tipo === "PRINCIPAL" ? "var(--gold)" : "var(--text-4)",
                            }}>{tipo || String.fromCharCode(65 + i)}</span>
                            <span style={{ flex: 1, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{desc}</span>
                            {val && <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>{fmtMoney(val)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fatos */}
                {(ext?.fatos_cronologicos?.length > 0 || processo.fatos_resumidos) && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Fatos</div>
                    {ext?.fatos_cronologicos?.length > 0 ? (
                      <ol style={{ margin: 0, paddingLeft: 18 }}>
                        {ext.fatos_cronologicos.map((f: string, i: number) => (
                          <li key={i} style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 7, lineHeight: 1.6 }}>{f}</li>
                        ))}
                      </ol>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.75 }}>{processo.fatos_resumidos}</p>
                    )}
                  </div>
                )}

                {/* Tutela de Urgência */}
                {(ext?.tutela_urgencia?.possui || processo.tutela_urgencia) && (
                  <div className="card" style={{ padding: "16px 20px", borderLeft: "3px solid #ef4444", background: "rgba(239,68,68,0.04)" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
                      Tutela de Urgência
                    </div>
                    {ext?.tutela_urgencia?.tipo && <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 4, textTransform: "capitalize" }}>{ext.tutela_urgencia.tipo}</div>}
                    {ext?.tutela_urgencia?.descricao && <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.6 }}>{ext.tutela_urgencia.descricao}</p>}
                    {!ext?.tutela_urgencia?.descricao && <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>Pedido de tutela de urgência detectado.</p>}
                  </div>
                )}

                {/* Documentos mencionados + Solicitar */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {(ext?.documentos_mencionados?.length > 0 || (processo.documentos_mencionados?.length || 0) > 0) && (
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                        Docs Mencionados
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 14 }}>
                        {(ext?.documentos_mencionados || processo.documentos_mencionados || []).map((d: string, i: number) => (
                          <li key={i} style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, lineHeight: 1.5 }}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(ext?.documentos_solicitar_cliente?.length > 0 || ext?.perguntas_ao_cliente?.length > 0) && (
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                        Solicitar ao Cliente
                      </div>
                      {ext?.documentos_solicitar_cliente?.map((d: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>→ {d}</div>
                      ))}
                      {ext?.perguntas_ao_cliente?.map((q: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 4 }}>? {q}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Análise de Risco */}
                {(ext?.risco_justificativa || ext?.pontos_atencao?.length > 0) && (
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                      Análise de Risco
                    </div>
                    {ext?.risco_justificativa && (
                      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.6 }}>{ext.risco_justificativa}</p>
                    )}
                    {ext?.pontos_atencao?.map((p: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: "#f59e0b", padding: "5px 8px", background: "rgba(245,158,11,0.08)", borderRadius: 4, display: "flex", gap: 6, marginBottom: 5 }}>
                        <span>▲</span><span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ===== DOCUMENTOS ===== */}
        {tab === "documentos" && (
          <div>
            {/* Upload */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                <select value={docFolder} onChange={e => setDocFolder(e.target.value)}
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 12 }}>
                  {DOC_FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button className="btn-gold" style={{ fontSize: 12 }} onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}>
                  {uploadingDoc ? "Enviando..." : "+ Upload"}
                </button>
                <input ref={docFileRef} type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); }} />
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDocDragging(true); }}
                onDragLeave={() => setDocDragging(false)}
                onDrop={e => { e.preventDefault(); setDocDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadDoc(f); }}
                onClick={() => docFileRef.current?.click()}
                style={{
                  border: `2px dashed ${docDragging ? "var(--gold)" : "var(--border-2)"}`,
                  borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer",
                  background: docDragging ? "var(--gold-bg)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-4)" }}>
                  {uploadingDoc ? "Enviando..." : "Arraste arquivos aqui ou clique para selecionar"}
                </div>
              </div>
            </div>

            {docs.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Nenhum documento. Faça upload da petição inicial para começar.
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {DOC_FOLDERS.map(folder => {
                  const folderDocs = docs.filter(d => d.folder === folder || (!d.folder && folder === "Inicial e Anexos"));
                  if (folderDocs.length === 0) return null;
                  return (
                    <div key={folder}>
                      <div style={{ padding: "8px 16px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {folder}
                      </div>
                      {folderDocs.map((d, i) => (
                        <div key={d.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "11px 16px", borderBottom: i < folderDocs.length - 1 ? "1px solid var(--border)" : "none",
                        }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 16, color: "var(--text-3)" }}>
                              {d.file_type?.includes("pdf") ? "PDF" : d.file_type?.includes("doc") ? "DOC" : "TXT"}
                            </span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                                {new Date(d.created_at).toLocaleDateString("pt-BR")}
                                {d.ai_status && (
                                  <span style={{
                                    marginLeft: 8, fontWeight: 600,
                                    color: d.ai_status === "complete" ? "#22c55e" : d.ai_status === "failed" ? "#ef4444" : "#f59e0b",
                                  }}>
                                    {d.ai_status === "complete" ? "✓ Completo" : d.ai_status === "failed" ? "✗ Falhou" : "... Processando"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDoc(d.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", fontSize: 14, padding: "4px 8px", borderRadius: 4 }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-4)")}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== CONTESTAÇÃO ===== */}
        {tab === "contestacao" && (
          <div>
            {/* Step Indicator */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, alignItems: "center" }}>
              {[{ s: 1, label: "1 Teses" }, { s: 2, label: "2 Jurisprudência" }, { s: 3, label: "3 Gerar" }].map(({ s, label }, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center" }}>
                  <button onClick={() => setContestacaoStep(s)} style={{
                    padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: contestacaoStep === s ? "var(--gold)" : "var(--bg-2)",
                    color: contestacaoStep === s ? "#000" : "var(--text-3)",
                    border: `1px solid ${contestacaoStep === s ? "var(--gold)" : "var(--border)"}`,
                  }}>{label}</button>
                  {i < 2 && <span style={{ color: "var(--text-4)", margin: "0 6px", fontSize: 12 }}>→</span>}
                </div>
              ))}
            </div>

            {contestacaoStep === 1 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Teses de Defesa</h3>
                  <button className="btn-gold" style={{ fontSize: 12 }} onClick={loadTeses} disabled={loadingTeses}>
                    {loadingTeses ? "Gerando..." : teses.length ? "Regenerar" : "Sugerir Teses com IA"}
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
                      display: "flex", gap: 12, padding: "11px 14px", borderRadius: 8, cursor: "pointer",
                      background: selectedTeses.has(i) ? "var(--gold-bg)" : "var(--bg-2)",
                      border: `1px solid ${selectedTeses.has(i) ? "var(--gold-border)" : "var(--border)"}`,
                      marginBottom: 8, transition: "all 0.15s",
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                      border: `2px solid ${selectedTeses.has(i) ? "var(--gold)" : "var(--border-2)"}`,
                      background: selectedTeses.has(i) ? "var(--gold)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000",
                    }}>
                      {selectedTeses.has(i) ? "✓" : ""}
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.6 }}>{t}</span>
                  </div>
                ))}
                {teses.length > 0 && (
                  <button className="btn-gold" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setContestacaoStep(2)} disabled={selectedTeses.size === 0}>
                    Continuar →
                  </button>
                )}
              </div>
            )}

            {contestacaoStep === 2 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Jurisprudência</h3>
                <div style={{ background: "var(--bg-2)", borderRadius: 8, padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 13, marginBottom: 16 }}>
                  <p style={{ margin: "0 0 8px" }}>Use a aba <Link href="/dashboard/pesquisa" style={{ color: "var(--gold)" }}>Jurisprudência</Link> para buscar precedentes por tese.</p>
                  <div style={{ fontSize: 12, color: "var(--text-4)" }}>Teses selecionadas: {selectedTeses.size}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setContestacaoStep(1)}>← Voltar</button>
                  <button className="btn-gold" style={{ fontSize: 12 }} onClick={() => setContestacaoStep(3)}>Gerar Contestação →</button>
                </div>
              </div>
            )}

            {contestacaoStep === 3 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Gerar Contestação</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(contestacaoText || processo.contestacao_gerada) && (
                      <>
                        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigator.clipboard.writeText(contestacaoText || processo.contestacao_gerada || "")}>
                          Copiar
                        </button>
                        <a
                          href={`data:text/plain;charset=utf-8,${encodeURIComponent(contestacaoText || processo.contestacao_gerada || "")}`}
                          download={`contestacao-${processo.numero_processo || processo.id}.txt`}
                        >
                          <button className="btn-ghost" style={{ fontSize: 12 }}>Baixar .txt</button>
                        </a>
                      </>
                    )}
                    <button className="btn-gold" style={{ fontSize: 12 }} onClick={gerarContestacao} disabled={loadingContestacao || selectedTeses.size === 0}>
                      {loadingContestacao ? "Gerando..." : "Gerar com IA"}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
                  {selectedTeses.size} tese{selectedTeses.size !== 1 ? "s" : ""} selecionada{selectedTeses.size !== 1 ? "s" : ""}
                </div>
                {(contestacaoText || processo.contestacao_gerada) ? (
                  <textarea
                    value={contestacaoText || processo.contestacao_gerada || ""}
                    onChange={e => setContestacaoText(e.target.value)}
                    style={{
                      width: "100%", minHeight: 500, background: "var(--bg-2)", border: "1px solid var(--border)",
                      color: "var(--text)", borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.8,
                      fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>
                    Clique em "Gerar com IA" para criar a contestação automaticamente.
                  </div>
                )}
                <button className="btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setContestacaoStep(2)}>← Voltar</button>
              </div>
            )}
          </div>
        )}

        {/* ===== PRAZOS ===== */}
        {tab === "prazos" && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Prazos</h3>
            {processo.prazo_contestacao ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Prazo de Contestação</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
                    {fmtDate(processo.prazo_contestacao)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: dias !== null && dias <= 0 ? "#ef4444" : dias !== null && dias <= 7 ? "#f59e0b" : "#22c55e" }}>
                  {dias !== null ? (dias <= 0 ? "VENCIDO" : `${dias} dias`) : "—"}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>
                Nenhum prazo cadastrado.
              </div>
            )}
          </div>
        )}

        {/* ===== CHAT IA ===== */}
        {tab === "chat" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", height: 520 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, color: "var(--text-2)" }}>
              Chat IA — {processo.numero_processo || "Processo"}
            </div>
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
                  <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "var(--text-3)" }}>...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Pergunte sobre o processo... (Enter para enviar)"
                style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}
              />
              <button className="btn-gold" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ fontSize: 12 }}>Enviar</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
