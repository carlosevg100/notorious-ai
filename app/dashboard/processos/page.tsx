"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Processo {
  id: string;
  numero_processo: string | null;
  tribunal: string | null;
  comarca: string | null;
  vara: string | null;
  valor_causa: number | null;
  polo_ativo: { nome?: string } | null;
  polo_passivo: { nome?: string } | null;
  fase: string;
  risco: string;
  prazo_contestacao: string | null;
  status: string;
  assunto: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
}

const FASES = [
  { key: 'recebido',           label: 'Recebido' },
  { key: 'extracao',           label: 'Extração IA' },
  { key: 'docs_solicitados',   label: 'Docs Solicitados' },
  { key: 'docs_recebidos',     label: 'Docs Recebidos' },
  { key: 'contestacao_gerando', label: 'Gerando Contestação' },
  { key: 'contestacao_revisao', label: 'Em Revisão' },
  { key: 'protocolado',        label: 'Protocolado' },
  { key: 'aguardando_replica', label: 'Aguardando Réplica' },
];

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(s + 'T00:00:00');
  return Math.floor((end.getTime() - today.getTime()) / 86400000);
}

function formatMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function RiskBadge({ risco }: { risco: string }) {
  const color = risco === 'alto' ? '#ef4444' : risco === 'medio' ? '#f59e0b' : '#22c55e';
  const bg = risco === 'alto' ? 'rgba(239,68,68,0.12)' : risco === 'medio' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  return (
    <span style={{ fontSize: '10px', fontWeight: '700', color, background: bg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
      {risco === 'alto' ? 'ALTO' : risco === 'medio' ? 'MÉDIO' : 'BAIXO'}
    </span>
  );
}

export default function ProcessosPage() {
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFase, setFiltroFase] = useState('todos');
  const [filtroRisco, setFiltroRisco] = useState('todos');
  const [busca, setBusca] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/processos');
      if (res.ok) setProcessos(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', files[0])
      const res = await fetch('/api/intake', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.processo_id) router.push(`/dashboard/processos/${data.processo_id}`)
    } finally {
      setUploading(false)
    }
  }

  const filtered = processos.filter(p => {
    if (filtroFase !== 'todos' && p.fase !== filtroFase) return false;
    if (filtroRisco !== 'todos' && p.risco !== filtroRisco) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (
        (p.numero_processo || '').toLowerCase().includes(q) ||
        (p.clients?.name || '').toLowerCase().includes(q) ||
        ((p.polo_ativo as any)?.nome || '').toLowerCase().includes(q) ||
        ((p.polo_passivo as any)?.nome || '').toLowerCase().includes(q) ||
        (p.assunto || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* HEADER */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Processos</h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
            {loading ? '...' : `${processos.length} processo${processos.length !== 1 ? 's' : ''} · ${filtered.length} exibido${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <label className="btn-gold" style={{ cursor: 'pointer' }}>
          {uploading ? 'Enviando...' : '+ Upload Documento'}
          <input type="file" accept=".pdf,.docx,.txt" hidden onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por número, cliente, assunto..."
            style={{ flex: 1, minWidth: '220px', maxWidth: '360px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: 'var(--text)' }}
          />
          <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text)', width: 'auto' }}>
            <option value="todos">Todas as fases</option>
            {FASES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={filtroRisco} onChange={e => setFiltroRisco(e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text)', width: 'auto' }}>
            <option value="todos">Todos os riscos</option>
            <option value="alto">Alto Risco</option>
            <option value="medio">Médio Risco</option>
            <option value="baixo">Baixo Risco</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚖</div>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              {processos.length === 0 ? 'Nenhum processo cadastrado' : 'Nenhum resultado para os filtros selecionados'}
            </p>
            {processos.length === 0 && (
              <label className="btn-gold" style={{ cursor: 'pointer' }}>
                {uploading ? 'Enviando...' : '+ Upload Documento'}
                <input type="file" accept=".pdf,.docx,.txt" hidden onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>
        ) : (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente / Polo Passivo', 'Número do Processo', 'Vara', 'Valor da Causa', 'Fase', 'Risco', 'Prazo', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '9px', color: 'var(--text-5)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const days = daysUntil(p.prazo_contestacao);
                    const faseLabel = FASES.find(f => f.key === p.fase)?.label || p.fase;
                    return (
                      <tr key={p.id} className="proc-row" style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '180px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.clients?.name || (p.polo_passivo as any)?.nome || '—'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            vs. {(p.polo_ativo as any)?.nome || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                          <div style={{ color: 'var(--gold)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.numero_processo || <span style={{ color: 'var(--text-5)', fontStyle: 'italic' }}>Sem número</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.assunto || p.tribunal || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-3)', maxWidth: '140px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.vara || p.tribunal || '—'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '2px' }}>{p.comarca || ''}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {p.valor_causa ? formatMoney(p.valor_causa) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--gold)', background: 'var(--gold-bg)', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{faseLabel}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <RiskBadge risco={p.risco} />
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {days === null ? <span style={{ color: 'var(--text-5)' }}>—</span>
                            : days < 0 ? <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '11px' }}>Vencido</span>
                            : days === 0 ? <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '11px' }}>HOJE</span>
                            : <span style={{ color: days <= 5 ? '#ef4444' : days <= 15 ? '#f59e0b' : 'var(--text-3)', fontWeight: days <= 5 ? '700' : '400', fontSize: '11px' }}>{days} dia{days !== 1 ? 's' : ''}</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <Link href={`/dashboard/processos/${p.id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '11px', padding: '4px 12px' }}>
                            Abrir →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`.proc-row:hover { background: var(--bg-2); }`}</style>
    </div>
  );
}
