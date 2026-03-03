"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Processo {
  id: string;
  numero_processo: string | null;
  tribunal: string | null;
  comarca: string | null;
  vara: string | null;
  juiz: string | null;
  valor_causa: number | null;
  polo_ativo: { nome?: string; advogado?: string } | null;
  polo_passivo: { nome?: string } | null;
  fase: string;
  risco: string;
  prazo_contestacao: string | null;
  status: string;
  assunto: string | null;
  resumo_executivo: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
}

const FASES = [
  { key: 'recebido',              label: 'Recebido',       short: 'Recebido' },
  { key: 'extracao',              label: 'Extração IA',    short: 'Extração' },
  { key: 'docs_solicitados',      label: 'Docs Solicitados', short: 'Docs Sol.' },
  { key: 'docs_recebidos',        label: 'Docs Recebidos', short: 'Docs Rec.' },
  { key: 'contestacao_gerando',   label: 'Gerando Contestação', short: 'Gerando' },
  { key: 'contestacao_revisao',   label: 'Em Revisão',     short: 'Revisão' },
  { key: 'protocolado',           label: 'Protocolado',    short: 'Protocolado' },
  { key: 'aguardando_replica',    label: 'Aguardando Réplica', short: 'Réplica' },
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

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
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

export default function Dashboard() {
  const { profile } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/processos');
      if (res.ok) setProcessos(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstName = profile?.name?.split(' ')[0] || 'Doutor';

  // Sections
  const criticos = processos.filter(p => {
    const days = daysUntil(p.prazo_contestacao);
    return p.status === 'ativo' && (
      (days !== null && days <= 5 && days >= 0) ||
      p.fase === 'docs_solicitados' ||
      p.risco === 'alto'
    );
  });

  const inbox = processos.filter(p => p.fase === 'recebido' && p.status === 'ativo');
  const aguardandoCliente = processos.filter(p => p.fase === 'docs_solicitados' && p.status === 'ativo');

  // Pipeline counts
  const pipelineCounts: Record<string, number> = {};
  for (const f of FASES) {
    pipelineCounts[f.key] = processos.filter(p => p.fase === f.key && p.status === 'ativo').length;
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* TOP BAR */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {getGreeting()}, Dr. {firstName}
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
            {todayLabel} · B/Luz Advogados · Contencioso
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/dashboard/processos/new" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--gold)', color: '#0a0a0b', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            + Novo Processo
          </Link>
          {[
            { label: 'Total', val: processos.length, color: 'var(--gold)' },
            { label: 'Críticos', val: criticos.length, color: criticos.length > 0 ? '#ef4444' : 'var(--text-4)' },
            { label: 'Inbox', val: inbox.length, color: inbox.length > 0 ? '#f59e0b' : 'var(--text-4)' },
            { label: 'Aguardando', val: aguardandoCliente.length, color: '#3b82f6' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '8px 14px', background: 'var(--bg-3)', border: `1px solid ${s.color === '#ef4444' && s.val > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: '10px', textAlign: 'center', minWidth: '72px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-5)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* PIPELINE VISUAL */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>Pipeline de Processos</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', paddingBottom: '4px' }}>
            {FASES.map((fase, i) => {
              const count = pipelineCounts[fase.key] || 0;
              const isLast = i === FASES.length - 1;
              return (
                <div key={fase.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '80px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      padding: '8px 6px',
                      background: count > 0 ? 'var(--gold-bg)' : 'var(--bg-3)',
                      border: `1px solid ${count > 0 ? 'var(--gold-border)' : 'var(--border)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: count > 0 ? 'var(--gold)' : 'var(--text-5)', lineHeight: 1 }}>{count}</div>
                      <div style={{ fontSize: '9px', color: count > 0 ? 'var(--gold)' : 'var(--text-5)', marginTop: '3px', fontWeight: '600', letterSpacing: '0.2px' }}>{fase.short}</div>
                    </div>
                  </div>
                  {!isLast && (
                    <div style={{ width: '20px', textAlign: 'center', flexShrink: 0, color: 'var(--text-5)', fontSize: '12px' }}>→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3 COLUMNS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px' }}>

          {/* CASOS CRÍTICOS */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px' }}>● Casos Críticos</span>
              {criticos.length > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 7px', borderRadius: '20px' }}>{criticos.length}</span>
              )}
            </div>
            {criticos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>✓</div>
                <p style={{ margin: 0, fontSize: '12px', color: '#22c55e', fontWeight: '700' }}>Tudo sob controle</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-5)' }}>Nenhum caso crítico</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {criticos.slice(0, 8).map(p => {
                  const days = daysUntil(p.prazo_contestacao);
                  const isPrazo = days !== null && days <= 5 && days >= 0;
                  const borderColor = p.risco === 'alto' ? '#ef4444' : isPrazo ? '#ef4444' : '#f59e0b';
                  return (
                    <Link key={p.id} href={`/dashboard/processos/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderLeft: `4px solid ${borderColor}`, borderRadius: '8px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                            {p.clients?.name || (p.polo_passivo as any)?.nome || 'Sem cliente'}
                          </span>
                          <RiskBadge risco={p.risco} />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.numero_processo || p.assunto || 'Processo sem número'}
                        </div>
                        {isPrazo && days !== null && (
                          <div style={{ marginTop: '4px', fontSize: '10px', fontWeight: '700', color: '#ef4444' }}>
                            ⚡ Prazo: {days === 0 ? 'HOJE' : `${days} dia${days !== 1 ? 's' : ''}`}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* INBOX */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>◉ Inbox</span>
              <span style={{ fontSize: '10px', color: 'var(--text-4)' }}>Petições recebidas</span>
              {inbox.length > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '1px 7px', borderRadius: '20px', marginLeft: 'auto' }}>{inbox.length}</span>
              )}
            </div>
            {inbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-5)', fontSize: '12px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>◉</div>
                Inbox vazio
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {inbox.map(p => (
                  <Link key={p.id} href={`/dashboard/processos/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '4px solid #f59e0b', borderRadius: '8px', cursor: 'pointer' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.clients?.name || (p.polo_passivo as any)?.nome || 'Sem cliente'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.numero_processo || p.assunto || '—'}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#f59e0b', fontWeight: '600' }}>
                        Nova petição · Processar →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* AGUARDANDO CLIENTE */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>◷ Aguardando Cliente</span>
              {aguardandoCliente.length > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '1px 7px', borderRadius: '20px', marginLeft: 'auto' }}>{aguardandoCliente.length}</span>
              )}
            </div>
            {aguardandoCliente.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-5)', fontSize: '12px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>◷</div>
                Nenhum processo aguardando
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {aguardandoCliente.map(p => {
                  const days = daysUntil(p.prazo_contestacao);
                  return (
                    <Link key={p.id} href={`/dashboard/processos/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '10px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderLeft: '4px solid #3b82f6', borderRadius: '8px', cursor: 'pointer' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.clients?.name || (p.polo_passivo as any)?.nome || 'Sem cliente'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.numero_processo || '—'}
                        </div>
                        {days !== null && (
                          <div style={{ marginTop: '4px', fontSize: '10px', fontWeight: '600', color: days <= 5 ? '#ef4444' : '#3b82f6' }}>
                            {days <= 0 ? '⚡ Prazo vencido!' : `Prazo: ${days} dias`}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PROCESSOS RECENTES */}
        {processos.length > 0 && (
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Todos os Processos</span>
              <Link href="/dashboard/processos" style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none' }}>Ver todos →</Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente / Polo Passivo', 'Processo', 'Vara', 'Valor', 'Fase', 'Risco', 'Prazo'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '9px', color: 'var(--text-5)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processos.slice(0, 10).map(p => {
                    const days = daysUntil(p.prazo_contestacao);
                    const faseLabel = FASES.find(f => f.key === p.fase)?.label || p.fase;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => window.location.href = `/dashboard/processos/${p.id}`}>
                        <td style={{ padding: '10px 10px', fontWeight: '600', color: 'var(--text)', maxWidth: '160px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.clients?.name || (p.polo_passivo as any)?.nome || '—'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-4)' }}>
                            vs. {(p.polo_ativo as any)?.nome || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--gold)', fontSize: '11px', maxWidth: '180px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.numero_processo || <span style={{ color: 'var(--text-5)' }}>Sem número</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.assunto || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--text-3)', fontSize: '11px', maxWidth: '120px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.vara || p.tribunal || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--text-2)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {p.valor_causa ? formatMoney(p.valor_causa) : '—'}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--gold)', background: 'var(--gold-bg)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{faseLabel}</span>
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <RiskBadge risco={p.risco} />
                        </td>
                        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                          {days === null ? <span style={{ color: 'var(--text-5)' }}>—</span>
                            : days < 0 ? <span style={{ color: '#ef4444', fontWeight: '700' }}>Vencido</span>
                            : days === 0 ? <span style={{ color: '#ef4444', fontWeight: '700' }}>Hoje!</span>
                            : <span style={{ color: days <= 5 ? '#ef4444' : days <= 15 ? '#f59e0b' : 'var(--text-3)', fontWeight: days <= 5 ? '700' : '400' }}>{days}d</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {processos.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚖</div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-2)', marginBottom: '8px' }}>Nenhum processo ainda</p>
            <p style={{ fontSize: '13px', marginBottom: '20px' }}>Adicione o primeiro processo de contencioso</p>
            <Link href="/dashboard/processos/new" className="btn-gold" style={{ textDecoration: 'none' }}>
              + Novo Processo
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1100px) { .dash-3col { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 750px)  { .dash-3col { grid-template-columns: 1fr !important; } }
        tr:hover { background: var(--bg-2); }
      `}</style>
    </div>
  );
}
