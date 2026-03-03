"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Processo {
  id: string;
  numero_processo: string | null;
  tribunal: string | null;
  comarca: string | null;
  vara: string | null;
  juiz: string | null;
  classe_processual: string | null;
  assunto: string | null;
  valor_causa: number | null;
  polo_ativo: { nome?: string; cpf_cnpj?: string; advogado?: string; oab?: string } | null;
  polo_passivo: { nome?: string; cpf_cnpj?: string } | null;
  pedidos: string[];
  tutela_urgencia: boolean;
  fatos_resumidos: string | null;
  causa_pedir: string | null;
  fundamentos_juridicos: string[];
  documentos_mencionados: string[];
  resumo_executivo: string | null;
  fase: string;
  prazo_contestacao: string | null;
  risco: string;
  status: string;
  teses_defesa: Tese[];
  contestacao_gerada: string | null;
  created_at: string;
  updated_at: string;
  clients: { id: string; name: string; type: string } | null;
}

interface Tese {
  id: string;
  titulo: string;
  descricao: string;
  fundamento_legal?: string;
  probabilidade?: string;
  selecionada: boolean;
}

interface JurisResult {
  tese_id: string;
  tribunal: string;
  numero_processo: string;
  ementa: string;
  relator: string;
  data: string;
  aprovada: boolean;
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

// ─── Constants ─────────────────────────────────────────────────────────────────
const FASES = [
  { key: 'recebido',            label: 'Recebido',            desc: 'Petição inicial recebida' },
  { key: 'extracao',            label: 'Extração IA',         desc: 'Dados extraídos pela IA' },
  { key: 'docs_solicitados',    label: 'Docs Solicitados',    desc: 'Documentos solicitados ao cliente' },
  { key: 'docs_recebidos',      label: 'Docs Recebidos',      desc: 'Documentos recebidos do cliente' },
  { key: 'contestacao_gerando', label: 'Gerando Contestação', desc: 'Contestação sendo elaborada' },
  { key: 'contestacao_revisao', label: 'Em Revisão',          desc: 'Contestação aguardando revisão' },
  { key: 'protocolado',         label: 'Protocolado',         desc: 'Contestação protocolada no tribunal' },
  { key: 'aguardando_replica',  label: 'Aguardando Réplica',  desc: 'Aguardando réplica do autor' },
];

const TABS = ['OVERVIEW','FASES','DOCUMENTOS','IA WORKSPACE','PEÇAS','PRAZOS','LOGS'] as const;
type Tab = typeof TABS[number];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(s + 'T00:00:00');
  return Math.floor((end.getTime() - today.getTime()) / 86400000);
}

function formatMoney(v: number | null): string {
  if (!v) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function RiskBadge({ risco }: { risco: string }) {
  const color = risco === 'alto' ? '#ef4444' : risco === 'medio' ? '#f59e0b' : '#22c55e';
  const bg = risco === 'alto' ? 'rgba(239,68,68,0.12)' : risco === 'medio' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  return <span style={{ fontSize: '11px', fontWeight: '700', color, background: bg, padding: '3px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>{risco === 'alto' ? 'ALTO' : risco === 'medio' ? 'MÉDIO' : 'BAIXO'}</span>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProcessoHub() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [saving, setSaving] = useState(false);

  // Peças state
  const [pecasStep, setPecasStep] = useState<1|2|3>(1);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [loadingTeses, setLoadingTeses] = useState(false);
  const [juris, setJuris] = useState<JurisResult[]>([]);
  const [loadingJuris, setLoadingJuris] = useState(false);
  const [contestacao, setContestacao] = useState('');
  const [loadingContestacao, setLoadingContestacao] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat state
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/processos/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProcesso(data);
        if (data.contestacao_gerada) setContestacao(data.contestacao_gerada);
        if (data.teses_defesa?.length) setTeses(data.teses_defesa);
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function updateFase(novaFase: string) {
    setSaving(true);
    await fetch(`/api/processos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fase: novaFase }),
    });
    await load();
    setSaving(false);
  }

  // ── PEÇAS: Step 1 — Teses ────────────────────────────────────────────────────
  async function gerarTeses() {
    setLoadingTeses(true);
    try {
      const res = await fetch(`/api/processos/${id}/teses`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const list: Tese[] = (data.teses || []).map((t: Tese) => ({ ...t, selecionada: true }));
        setTeses(list);
      }
    } catch {}
    setLoadingTeses(false);
  }

  // ── PEÇAS: Step 2 — Jurisprudência ──────────────────────────────────────────
  async function buscarJuris() {
    setLoadingJuris(true);
    const selecionadas = teses.filter(t => t.selecionada);
    const all: JurisResult[] = [];
    for (const tese of selecionadas) {
      try {
        const q = encodeURIComponent(`${tese.titulo} ${processo?.assunto || ''}`);
        const res = await fetch(`/api/pesquisa?q=${q}`);
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || []).slice(0, 3).map((r: JurisResult) => ({
            tese_id: tese.id,
            tribunal: r.tribunal,
            numero_processo: r.numero_processo,
            ementa: r.ementa,
            relator: r.relator,
            data: r.data,
            aprovada: true,
          }));
          all.push(...results);
        }
      } catch {}
    }
    setJuris(all);
    setLoadingJuris(false);
  }

  // ── PEÇAS: Step 3 — Contestação ─────────────────────────────────────────────
  async function gerarContestacao() {
    setLoadingContestacao(true);
    try {
      const res = await fetch(`/api/processos/${id}/contestacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teses, jurisprudencias: juris }),
      });
      if (res.ok) {
        const data = await res.json();
        setContestacao(data.contestacao || '');
        await load();
      }
    } catch {}
    setLoadingContestacao(false);
  }

  // ── Chat ────────────────────────────────────────────────────────────────────
  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput };
    setMsgs(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const context = processo ? `
PROCESSO: ${processo.numero_processo || 'Sem número'}
ASSUNTO: ${processo.assunto || ''}
POLO ATIVO: ${processo.polo_ativo?.nome || ''}
POLO PASSIVO: ${processo.polo_passivo?.nome || ''}
VALOR: ${formatMoney(processo.valor_causa)}
FASE: ${FASES.find(f => f.key === processo.fase)?.label || processo.fase}
FATOS: ${processo.fatos_resumidos || ''}
PEDIDOS: ${(processo.pedidos || []).join('; ')}
FUNDAMENTOS AUTOR: ${(processo.fundamentos_juridicos || []).join('; ')}
      `.trim() : '';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: `Você é um assistente jurídico especializado em defesa processual. Contexto do processo:\n${context}`,
          history: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMsgs(prev => [...prev, { role: 'assistant', content: data.message || data.response || 'Sem resposta' }]);
      }
    } catch {}
    setChatLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!processo) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: '12px' }}>
      <p style={{ color: 'var(--text-4)', fontSize: '14px' }}>Processo não encontrado.</p>
      <button onClick={() => router.push('/dashboard/processos')} className="btn-ghost">← Voltar</button>
    </div>
  );

  const days = daysUntil(processo.prazo_contestacao);
  const faseLabel = FASES.find(f => f.key === processo.fase)?.label || processo.fase;
  const faseIdx = FASES.findIndex(f => f.key === processo.fase);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── FIXED HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        {/* Row 1: Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <button onClick={() => router.push('/dashboard/processos')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {processo.clients?.name || processo.polo_passivo?.nome || 'Processo'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>vs.</span>
              <span style={{ fontSize: '13px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {processo.polo_ativo?.nome || '—'}
              </span>
            </div>
            {processo.numero_processo && (
              <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '1px', fontFamily: 'monospace' }}>
                {processo.numero_processo}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <RiskBadge risco={processo.risco} />
            <span style={{ fontSize: '11px', background: 'var(--gold-bg)', color: 'var(--gold)', padding: '3px 10px', borderRadius: '4px', fontWeight: '600', whiteSpace: 'nowrap' }}>{faseLabel}</span>
            {days !== null && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: days <= 5 ? '#ef4444' : days <= 15 ? '#f59e0b' : 'var(--text-3)', background: days <= 5 ? 'rgba(239,68,68,0.1)' : 'var(--bg-3)', padding: '3px 10px', borderRadius: '4px', border: `1px solid ${days <= 5 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
                {days < 0 ? '⚡ Prazo vencido' : days === 0 ? '⚡ Prazo HOJE' : `Prazo: ${days}d`}
              </span>
            )}
            {saving && <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>Salvando...</span>}
          </div>
        </div>

        {/* Row 2: Meta */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', paddingLeft: '28px' }}>
          {[
            { label: 'Vara', val: processo.vara || '—' },
            { label: 'Comarca', val: processo.comarca || '—' },
            { label: 'Juiz', val: processo.juiz || '—' },
            { label: 'Valor da Causa', val: formatMoney(processo.valor_causa) },
            { label: 'Tribunal', val: processo.tribunal || '—' },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: '9px', color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '500', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginTop: '12px', paddingLeft: '28px', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', background: tab === t ? 'var(--gold)' : 'transparent', color: tab === t ? '#000' : 'var(--text-4)', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1100px', width: '100%' }}>

        {/* ━━━ OVERVIEW ━━━ */}
        {tab === 'OVERVIEW' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {processo.resumo_executivo && (
              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--gold)' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Resumo Executivo</div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>{processo.resumo_executivo}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Fatos */}
              {processo.fatos_resumidos && (
                <div className="card" style={{ padding: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Fatos Alegados</div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>{processo.fatos_resumidos}</p>
                </div>
              )}

              {/* Pedidos */}
              {processo.pedidos?.length > 0 && (
                <div className="card" style={{ padding: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Pedidos do Autor</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {processo.pedidos.map((ped, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.4' }}>{ped}</li>
                    ))}
                  </ul>
                  {processo.tutela_urgencia && (
                    <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>
                      ⚡ Há pedido de tutela de urgência
                    </div>
                  )}
                </div>
              )}

              {/* Partes */}
              <div className="card" style={{ padding: '18px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Partes</div>
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '9px', color: '#ef4444', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Polo Ativo (Autor)</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{processo.polo_ativo?.nome || '—'}</div>
                  {processo.polo_ativo?.cpf_cnpj && <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>CPF/CNPJ: {processo.polo_ativo.cpf_cnpj}</div>}
                  {processo.polo_ativo?.advogado && <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '1px' }}>Adv.: {processo.polo_ativo.advogado} · {processo.polo_ativo.oab}</div>}
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Polo Passivo (Réu — nosso cliente)</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{processo.polo_passivo?.nome || '—'}</div>
                  {processo.polo_passivo?.cpf_cnpj && <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>CPF/CNPJ: {processo.polo_passivo.cpf_cnpj}</div>}
                </div>
              </div>

              {/* Docs Mencionados */}
              {processo.documentos_mencionados?.length > 0 && (
                <div className="card" style={{ padding: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Documentos Mencionados</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {processo.documentos_mencionados.map((doc, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'var(--text-2)' }}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions quick */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-4)', fontWeight: '600' }}>Ações rápidas:</span>
              <button onClick={() => setTab('PEÇAS')} className="btn-gold" style={{ fontSize: '12px', padding: '6px 14px' }}>Gerar Contestação</button>
              <button onClick={() => setTab('IA WORKSPACE')} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}>Consultar IA</button>
              <button onClick={() => setTab('DOCUMENTOS')} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}>Ver Documentos</button>
            </div>
          </div>
        )}

        {/* ━━━ FASES ━━━ */}
        {tab === 'FASES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '20px' }}>Pipeline do Processo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {FASES.map((fase, idx) => {
                  const isDone = idx < faseIdx;
                  const isCurrent = idx === faseIdx;
                  const isPending = idx > faseIdx;
                  return (
                    <div key={fase.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Number */}
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: '800', background: isDone ? '#22c55e' : isCurrent ? 'var(--gold)' : 'var(--bg-3)', color: isDone || isCurrent ? (isCurrent ? '#000' : '#fff') : 'var(--text-5)', border: `2px solid ${isDone ? '#22c55e' : isCurrent ? 'var(--gold)' : 'var(--border)'}` }}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, padding: '12px 16px', background: isCurrent ? 'var(--gold-bg)' : isDone ? 'rgba(34,197,94,0.05)' : 'var(--bg-3)', border: `1px solid ${isCurrent ? 'var(--gold-border)' : isDone ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: isCurrent ? 'var(--gold)' : isDone ? '#22c55e' : 'var(--text-3)' }}>{fase.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '2px' }}>{fase.desc}</div>
                          </div>
                          {isCurrent && (
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--gold)', background: 'var(--gold-bg)', padding: '2px 8px', borderRadius: '4px' }}>ATUAL</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Change phase */}
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Atualizar Fase</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {FASES.map(fase => (
                  <button key={fase.key} onClick={() => updateFase(fase.key)} disabled={fase.key === processo.fase || saving} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: fase.key === processo.fase ? 'default' : 'pointer', border: `1px solid ${fase.key === processo.fase ? 'var(--gold)' : 'var(--border)'}`, background: fase.key === processo.fase ? 'var(--gold)' : 'var(--bg-3)', color: fase.key === processo.fase ? '#000' : 'var(--text-3)' }}>
                    {fase.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ━━━ DOCUMENTOS ━━━ */}
        {tab === 'DOCUMENTOS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { label: 'Petição Inicial', icon: '📄', desc: 'Documento do autor' },
              { label: 'Docs do Cliente', icon: '📁', desc: 'Documentos fornecidos pelo réu' },
              { label: 'Contratos', icon: '📋', desc: 'Contratos e acordos' },
              { label: 'Provas', icon: '🔍', desc: 'Evidências e provas documentais' },
              { label: 'Peças do Escritório', icon: '⚖', desc: 'Contestação e peças elaboradas' },
              { label: 'Outros', icon: '📂', desc: 'Documentos diversos' },
            ].map(folder => (
              <div key={folder.label} className="card" style={{ padding: '18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{folder.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{folder.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-5)' }}>{folder.desc}</div>
                  </div>
                </div>
                {folder.label === 'Petição Inicial' && processo.documentos_mencionados?.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    {processo.documentos_mencionados.length} documento{processo.documentos_mencionados.length !== 1 ? 's' : ''} mencionado{processo.documentos_mencionados.length !== 1 ? 's' : ''}
                  </div>
                )}
                <button style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-5)', background: 'none', border: '1px dashed var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', width: '100%' }}>
                  + Adicionar documento
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ━━━ IA WORKSPACE ━━━ */}
        {tab === 'IA WORKSPACE' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', minHeight: '400px' }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Context badge */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--gold-bg)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: '700' }}>CONTEXTO ATIVO:</span>
                <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{processo.numero_processo || 'Processo'}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>·</span>
                <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{processo.assunto || processo.classe_processual || 'Contencioso'}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>·</span>
                <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>Polo Passivo: {processo.polo_passivo?.nome || '—'}</span>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {msgs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-5)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚖</div>
                    <p style={{ fontSize: '13px' }}>Pergunte qualquer coisa sobre este processo.<br />A IA tem contexto completo do caso.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                      {['Quais são as principais vulnerabilidades da petição?', 'Sugira teses de prescrição', 'Analise os pedidos do autor'].map(s => (
                        <button key={s} onClick={() => { setChatInput(s); }} style={{ fontSize: '11px', color: 'var(--gold)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', background: m.role === 'user' ? 'var(--gold)' : 'var(--bg-3)', color: m.role === 'user' ? '#000' : 'var(--text-3)', border: m.role === 'assistant' ? '1px solid var(--border)' : 'none' }}>
                      {m.role === 'user' ? 'U' : '⚖'}
                    </div>
                    <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '10px', background: m.role === 'user' ? 'var(--gold-bg)' : 'var(--bg-3)', border: `1px solid ${m.role === 'user' ? 'var(--gold-border)' : 'var(--border)'}`, fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-3)' }}>⚖</div>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-4)' }}>Analisando...</div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendChat} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexShrink: 0 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Pergunte sobre o processo, teses, jurisprudência..."
                  style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--text)', outline: 'none' }}
                />
                <button type="submit" disabled={!chatInput.trim() || chatLoading} className="btn-gold" style={{ flexShrink: 0 }}>
                  Enviar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ━━━ PEÇAS ━━━ */}
        {tab === 'PEÇAS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Steps indicator */}
            <div className="card" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {[
                  { n: 1, label: 'Teses' },
                  { n: 2, label: 'Jurisprudência' },
                  { n: 3, label: 'Contestação' },
                ].map((step, i) => {
                  const done = pecasStep > step.n;
                  const active = pecasStep === step.n;
                  return (
                    <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: i < 2 ? 1 : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: done ? 'pointer' : 'default' }} onClick={() => done || active ? setPecasStep(step.n as 1|2|3) : null}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', background: done ? '#22c55e' : active ? 'var(--gold)' : 'var(--bg-3)', color: done || active ? (active ? '#000' : '#fff') : 'var(--text-5)', border: `2px solid ${done ? '#22c55e' : active ? 'var(--gold)' : 'var(--border)'}`, flexShrink: 0 }}>
                          {done ? '✓' : step.n}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: active ? 'var(--text)' : done ? '#22c55e' : 'var(--text-5)', whiteSpace: 'nowrap' }}>{step.label}</span>
                      </div>
                      {i < 2 && <div style={{ flex: 1, height: '1px', background: done ? '#22c55e' : 'var(--border)', minWidth: '20px' }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1: Teses */}
            {pecasStep === 1 && (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Teses de Defesa</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>A IA sugere teses baseadas nos dados do processo. Selecione as relevantes.</div>
                  </div>
                  <button onClick={gerarTeses} disabled={loadingTeses} className="btn-gold">
                    {loadingTeses ? 'Gerando...' : teses.length > 0 ? 'Regerar Teses' : 'Sugerir Teses com IA'}
                  </button>
                </div>

                {loadingTeses ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)', fontSize: '13px' }}>
                    Analisando processo e gerando teses de defesa...
                  </div>
                ) : teses.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '8px', color: 'var(--text-5)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚖</div>
                    <p style={{ margin: 0, fontSize: '13px' }}>Clique em "Sugerir Teses com IA" para começar</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {teses.map((tese, i) => (
                      <div key={tese.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px', background: tese.selecionada ? 'var(--gold-bg)' : 'var(--bg-3)', border: `1px solid ${tese.selecionada ? 'var(--gold-border)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                        onClick={() => setTeses(prev => prev.map((t, j) => j === i ? { ...t, selecionada: !t.selecionada } : t))}>
                        <input type="checkbox" checked={tese.selecionada} onChange={() => {}} style={{ marginTop: '2px', accentColor: 'var(--gold)', flexShrink: 0, width: '16px', height: '16px' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{tese.titulo}</span>
                            {tese.probabilidade && (
                              <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', background: tese.probabilidade === 'alta' ? 'rgba(34,197,94,0.12)' : tese.probabilidade === 'media' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: tese.probabilidade === 'alta' ? '#22c55e' : tese.probabilidade === 'media' ? '#f59e0b' : '#ef4444' }}>
                                {tese.probabilidade}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5' }}>{tese.descricao}</p>
                          {tese.fundamento_legal && <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--gold)' }}>📖 {tese.fundamento_legal}</div>}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => setPecasStep(2)} disabled={!teses.some(t => t.selecionada)} className="btn-gold">
                        Buscar Jurisprudência ({teses.filter(t => t.selecionada).length} tese{teses.filter(t => t.selecionada).length !== 1 ? 's' : ''}) →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Jurisprudência */}
            {pecasStep === 2 && (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Jurisprudência de Suporte</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>Aprovite decisões reais para fundamentar cada tese. Desmarque as que não se aplicam.</div>
                  </div>
                  <button onClick={buscarJuris} disabled={loadingJuris} className="btn-gold">
                    {loadingJuris ? 'Buscando...' : juris.length > 0 ? 'Rebuscar' : 'Buscar Jurisprudência'}
                  </button>
                </div>

                {loadingJuris ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)', fontSize: '13px' }}>
                    Buscando decisões reais nos tribunais (TST/STF)...
                  </div>
                ) : juris.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '8px', color: 'var(--text-5)' }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>Clique em "Buscar Jurisprudência" para pesquisar decisões relacionadas às teses selecionadas</p>
                  </div>
                ) : (
                  <div>
                    {teses.filter(t => t.selecionada).map(tese => {
                      const teseJuris = juris.filter(j => j.tese_id === tese.id);
                      if (teseJuris.length === 0) return null;
                      return (
                        <div key={tese.id} style={{ marginBottom: '20px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{tese.titulo}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {teseJuris.map((j, i) => (
                              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: j.aprovada ? 'rgba(34,197,94,0.05)' : 'var(--bg-3)', border: `1px solid ${j.aprovada ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer' }}
                                onClick={() => setJuris(prev => prev.map((jj, ii) => jj.tese_id === j.tese_id && ii === juris.indexOf(j) ? { ...jj, aprovada: !jj.aprovada } : jj))}>
                                <input type="checkbox" checked={j.aprovada} onChange={() => {}} style={{ marginTop: '2px', accentColor: '#22c55e', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-2)' }}>{j.tribunal}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-4)', fontFamily: 'monospace' }}>{j.numero_processo}</span>
                                    {j.data && <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>{j.data}</span>}
                                    {j.relator && <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>Rel.: {j.relator}</span>}
                                  </div>
                                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                                    {j.ementa}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button onClick={() => setPecasStep(1)} className="btn-ghost">← Voltar</button>
                      <button onClick={() => setPecasStep(3)} className="btn-gold">Gerar Contestação →</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Contestação */}
            {pecasStep === 3 && (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Contestação</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>Edite o texto e baixe quando estiver pronto.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!contestacao && (
                      <button onClick={gerarContestacao} disabled={loadingContestacao} className="btn-gold">
                        {loadingContestacao ? 'Gerando...' : 'Gerar com IA'}
                      </button>
                    )}
                    {contestacao && (
                      <>
                        <button onClick={() => { navigator.clipboard.writeText(contestacao); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-ghost" style={{ fontSize: '12px' }}>
                          {copied ? '✓ Copiado!' : 'Copiar'}
                        </button>
                        <button onClick={() => {
                          const blob = new Blob([contestacao], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `contestacao-${processo.numero_processo || id}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} className="btn-ghost" style={{ fontSize: '12px' }}>
                          Baixar .txt
                        </button>
                        <button onClick={gerarContestacao} disabled={loadingContestacao} className="btn-ghost" style={{ fontSize: '12px' }}>
                          Regerar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {loadingContestacao ? (
                  <div style={{ padding: '60px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-4)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖</div>
                    <p style={{ margin: 0 }}>Gerando contestação completa com IA...</p>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-5)' }}>Isso pode levar alguns segundos.</p>
                  </div>
                ) : contestacao ? (
                  <textarea
                    value={contestacao}
                    onChange={e => setContestacao(e.target.value)}
                    style={{ width: '100%', minHeight: '500px', background: 'var(--bg-4)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', fontSize: '13px', color: 'var(--text)', lineHeight: '1.7', fontFamily: 'Georgia, serif', resize: 'vertical', outline: 'none' }}
                  />
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '8px', color: 'var(--text-5)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚖</div>
                    <p style={{ margin: 0, fontSize: '13px' }}>Clique em "Gerar com IA" para criar a contestação</p>
                    <p style={{ margin: '6px 0 0', fontSize: '11px' }}>Usando {teses.filter(t => t.selecionada).length} teses e {juris.filter(j => j.aprovada).length} decisões de jurisprudência</p>
                  </div>
                )}

                {!contestacao && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    <button onClick={() => setPecasStep(2)} className="btn-ghost">← Jurisprudência</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ━━━ PRAZOS ━━━ */}
        {tab === 'PRAZOS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>Linha do Tempo de Prazos</div>

              {processo.prazo_contestacao ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const days = daysUntil(processo.prazo_contestacao);
                    const color = days === null ? 'var(--text-4)' : days < 0 ? '#ef4444' : days <= 5 ? '#ef4444' : days <= 15 ? '#f59e0b' : '#22c55e';
                    return (
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', background: `${color}10`, border: `1px solid ${color}30`, borderLeft: `4px solid ${color}`, borderRadius: '8px' }}>
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: '32px', fontWeight: '800', color, lineHeight: 1 }}>{days === null ? '—' : days < 0 ? '✗' : days}</div>
                          <div style={{ fontSize: '10px', color, textTransform: 'uppercase', fontWeight: '700' }}>{days !== null && days >= 0 ? 'dias' : ''}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Prazo de Contestação</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>
                            {new Date(processo.prazo_contestacao + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          {days !== null && days < 0 && <div style={{ marginTop: '4px', fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>PRAZO VENCIDO</div>}
                          {days !== null && days === 0 && <div style={{ marginTop: '4px', fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>VENCE HOJE!</div>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-5)', fontSize: '12px' }}>
                  Nenhum prazo cadastrado para este processo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ━━━ LOGS ━━━ */}
        {tab === 'LOGS' && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>Auditoria do Processo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '⚖', label: 'Processo criado', date: processo.created_at, color: '#22c55e' },
                processo.fase !== 'recebido' ? { icon: '🔄', label: `Fase atualizada: ${faseLabel}`, date: processo.updated_at, color: 'var(--gold)' } : null,
                processo.contestacao_gerada ? { icon: '📄', label: 'Contestação gerada', date: processo.updated_at, color: '#3b82f6' } : null,
              ].filter(Boolean).map((log, i) => log && (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{log.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{log.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '2px' }}>
                      {new Date(log.date).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: log.color }}>●</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
