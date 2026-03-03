"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientProject { id: string; status: string; risk_level: string; area: string; }
interface ClientContract { id: string; status: string; value: number | null; }
interface Client {
  id: string; name: string; type: string;
  projects: ClientProject[];
  contracts: ClientContract[];
}
interface ProjectClient { id: string; name: string; }
interface ProjectDoc { id: string; }
interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  created_at: string; updated_at?: string;
  clients: ProjectClient | null;
  documents: ProjectDoc[];
}
interface ContractClient { id: string; name: string; }
interface Contract {
  id: string; name: string; status: string; value: number | null;
  end_date: string | null; start_date: string | null;
  contract_type: string; created_at: string; client_id: string | null;
  clients: ContractClient | null;
}
interface AIAlert {
  id: string; message: string; type: string; is_read: boolean; created_at: string;
  project_id: string | null;
}
interface ContractAlertContract {
  id: string; name: string; value: number | null; client_id: string | null;
  clients: { id: string; name: string } | null;
}
interface ContractAlert {
  id: string; message: string; type: string; is_read: boolean; created_at: string;
  contract_id: string;
  contracts: ContractAlertContract | null;
}
interface DashboardStats {
  clientCount: number; casosAtivos: number; contratosVigentes: number;
  alertasUnread: number; valorGestao: number;
}
interface DashboardData {
  clients: Client[]; projects: Project[]; contracts: Contract[];
  ai_alerts: AIAlert[]; contract_alerts: ContractAlert[];
  stats: DashboardStats;
}
interface AttentionItem {
  id: string; level: 'critico' | 'urgente' | 'atencao' | 'info';
  icon: string; title: string; context: string; link: string; dateLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}
function timeAgo(s: string): string {
  const ms = Date.now() - new Date(s).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return 'agora';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}
function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(s + 'T00:00:00');
  return Math.floor((end.getTime() - today.getTime()) / 86400000);
}
function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
function getTodayLabel(): string {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Build Attention Items ─────────────────────────────────────────────────────
function buildAttentionItems(data: DashboardData): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const c of data.contracts) {
    if (!c.end_date || ['vencido', 'rescindido'].includes(c.status)) continue;
    const days = daysUntil(c.end_date);
    if (days === null || days < 0) continue;
    const cn = c.clients?.name || '—';
    if (days <= 7) {
      items.push({ id: `crit-${c.id}`, level: 'critico', icon: '📋', title: c.name,
        context: `Cliente: ${cn}`, link: `/dashboard/contratos/${c.id}`,
        dateLabel: days === 0 ? 'Vence HOJE' : `Vence em ${days} dia${days !== 1 ? 's' : ''}` });
    } else if (days <= 30) {
      items.push({ id: `aten-${c.id}`, level: 'atencao', icon: '📋', title: c.name,
        context: `Cliente: ${cn}`, link: `/dashboard/contratos/${c.id}`,
        dateLabel: `Vence em ${days} dias` });
    }
  }

  for (const c of data.contracts) {
    if (c.status !== 'aguardando_assinatura') continue;
    const daysSince = Math.floor((today.getTime() - new Date(c.created_at).getTime()) / 86400000);
    if (daysSince > 5) {
      items.push({ id: `sign-${c.id}`, level: 'urgente', icon: '✍️', title: c.name,
        context: `Cliente: ${c.clients?.name || '—'} · Aguardando assinatura`,
        link: `/dashboard/contratos/${c.id}`, dateLabel: `Aguardando há ${daysSince} dias` });
    }
  }

  for (const p of data.projects) {
    if (p.risk_level !== 'alto' || p.status !== 'ativo') continue;
    const daysSince = Math.floor((today.getTime() - new Date(p.created_at).getTime()) / 86400000);
    if (daysSince > 7) {
      items.push({ id: `hrisk-${p.id}`, level: 'atencao', icon: '⚖️', title: p.name,
        context: p.clients?.name ? `Cliente: ${p.clients.name} · Alto risco` : 'Caso de alto risco',
        link: `/dashboard/projeto/${p.id}`, dateLabel: `Aberto há ${daysSince} dias` });
    }
  }

  for (const a of data.ai_alerts) {
    if (a.is_read) continue;
    const level: AttentionItem['level'] = (a.type === 'fraud') ? 'critico'
      : (a.type === 'risk' || a.type === 'deadline') ? 'urgente' : 'info';
    const icon = a.type === 'fraud' ? '🚨' : a.type === 'risk' ? '⚠️' : a.type === 'deadline' ? '📅' : '🔵';
    items.push({ id: `ai-${a.id}`, level, icon,
      title: a.message.length > 75 ? a.message.slice(0, 75) + '…' : a.message,
      context: 'Alerta IA',
      link: a.project_id ? `/dashboard/projeto/${a.project_id}` : '/dashboard/clientes',
      dateLabel: timeAgo(a.created_at) });
  }

  for (const a of data.contract_alerts) {
    if (a.is_read) continue;
    const isFraud = a.type === 'fraud' || a.type === 'fraude';
    const level: AttentionItem['level'] = isFraud ? 'critico' : a.type === 'vencimento' ? 'atencao' : 'info';
    const icon = isFraud ? '🚨' : a.type === 'vencimento' ? '📅' : '🔄';
    const contractName = a.contracts?.name || 'Contrato';
    const clientName = a.contracts?.clients?.name;
    items.push({ id: `ca-${a.id}`, level, icon, title: contractName,
      context: clientName ? `Cliente: ${clientName} · ${a.message.slice(0, 50)}` : a.message.slice(0, 75),
      link: `/dashboard/contratos/${a.contract_id}`, dateLabel: timeAgo(a.created_at) });
  }

  const urgencyOrder: Record<string, number> = { critico: 0, urgente: 1, atencao: 2, info: 3 };
  return items.sort((a, b) => urgencyOrder[a.level] - urgencyOrder[b.level]);
}

const LEVEL = {
  critico: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'CRÍTICO', border: 'rgba(239,68,68,0.3)', glow: '0 0 14px rgba(239,68,68,0.1), 0 0 0 1px rgba(239,68,68,0.15)' },
  urgente: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'URGENTE', border: 'rgba(249,115,22,0.25)', glow: 'none' },
  atencao: { color: '#eab308', bg: 'rgba(234,179,8,0.08)', label: 'ATENÇÃO', border: 'rgba(234,179,8,0.25)', glow: 'none' },
  info:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', label: 'INFO',    border: 'rgba(59,130,246,0.25)', glow: 'none' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = '16px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r }} />;
}
function SkeletonDashboard() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skel w="200px" h="22px" />
          <Skel w="300px" h="14px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[...Array(5)].map((_, i) => <Skel key={i} w="90px" h="62px" r="10px" />)}
        </div>
      </div>
      <div className="dash-z2" style={{ padding: '20px 28px' }}>
        <Skel h="480px" r="12px" />
        <Skel h="480px" r="12px" />
        <Skel h="480px" r="12px" />
      </div>
      <div className="dash-z3" style={{ padding: '0 28px 32px' }}>
        <Skel h="360px" r="12px" />
        <Skel h="360px" r="12px" />
      </div>
      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.45} 50%{opacity:.85} }
        .skel { background: var(--bg-3); animation: shimmer 1.6s ease-in-out infinite; }
        .dash-z2 { display: grid; grid-template-columns: 45fr 30fr 25fr; gap: 18px; }
        .dash-z3 { display: grid; grid-template-columns: 60fr 40fr; gap: 18px; }
        @media (max-width: 1150px) { .dash-z2 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 800px)  { .dash-z2 { grid-template-columns: 1fr; } .dash-z3 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseFilter, setCaseFilter] = useState('todos');
  const [animStats, setAnimStats] = useState<DashboardStats>({
    clientCount: 0, casosAtivos: 0, contratosVigentes: 0, alertasUnread: 0, valorGestao: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 60000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    if (!data) return;
    const target = data.stats;
    const duration = 700;
    const start = performance.now();
    const frame = (now: number) => {
      const prog = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setAnimStats({
        clientCount: Math.round(target.clientCount * ease),
        casosAtivos: Math.round(target.casosAtivos * ease),
        contratosVigentes: Math.round(target.contratosVigentes * ease),
        alertasUnread: Math.round(target.alertasUnread * ease),
        valorGestao: Math.round(target.valorGestao * ease),
      });
      if (prog < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [data]);

  async function markAllAlertsRead() {
    if (!data) return;
    const unread = data.ai_alerts.filter(a => !a.is_read);
    await Promise.all(unread.map(a =>
      fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
    ));
    loadData();
  }

  if (loading) return <SkeletonDashboard />;
  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-4)', fontSize: '14px' }}>Erro ao carregar dados.</p>
        <button onClick={loadData} style={{ marginTop: '8px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Tentar novamente</button>
      </div>
    </div>
  );

  const firstName = profile?.name?.split(' ')[0] || 'Doutor';
  const firmName = (profile as any)?.firms?.name || 'B/Luz Advogados';
  const attentionItems = buildAttentionItems(data);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Client alert map
  const clientAlertMap = new Map<string, number>();
  for (const a of data.ai_alerts) {
    if (a.is_read || !a.project_id) continue;
    const proj = data.projects.find(p => p.id === a.project_id);
    if (proj?.clients?.id) clientAlertMap.set(proj.clients.id, (clientAlertMap.get(proj.clients.id) || 0) + 1);
  }
  for (const a of data.contract_alerts) {
    if (a.is_read || !a.contracts?.client_id) continue;
    const cid = a.contracts.client_id;
    clientAlertMap.set(cid, (clientAlertMap.get(cid) || 0) + 1);
  }

  // Case filter
  const caseFilterFns: Record<string, (p: Project) => boolean> = {
    todos: () => true,
    'alto-risco': p => p.risk_level === 'alto',
    'm&a': p => /m.?a|societar/i.test(p.area || ''),
    trabalhista: p => /trabalhista/i.test(p.area || ''),
    contratos: p => /contrat/i.test(p.area || ''),
  };
  const filteredCases = data.projects
    .filter(p => p.status === 'ativo')
    .filter(caseFilterFns[caseFilter] || (() => true));

  // Contract radar
  const contractsExpiring7 = data.contracts.filter(c => {
    if (!c.end_date || ['vencido', 'rescindido'].includes(c.status)) return false;
    const d = daysUntil(c.end_date);
    return d !== null && d >= 0 && d <= 7;
  });
  const contractsExpiring30 = data.contracts.filter(c => {
    if (!c.end_date || ['vencido', 'rescindido'].includes(c.status)) return false;
    const d = daysUntil(c.end_date);
    return d !== null && d > 7 && d <= 30;
  });
  const contractsWaiting = data.contracts.filter(c => c.status === 'aguardando_assinatura');

  // Combined feed
  type FeedItem = (AIAlert & { _src: 'ai' }) | (ContractAlert & { _src: 'contract' });
  const feed: FeedItem[] = [
    ...data.ai_alerts.map(a => ({ ...a, _src: 'ai' as const })),
    ...data.contract_alerts.map(a => ({ ...a, _src: 'contract' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);

  const unreadFeedCount = data.ai_alerts.filter(a => !a.is_read).length + data.contract_alerts.filter(a => !a.is_read).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 1 — TOP BAR                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {getGreeting()}, Dr. {firstName} 👋
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
            {getTodayLabel()} · {firmName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {([
            { icon: '🏢', label: 'Clientes',    val: String(animStats.clientCount),          color: 'var(--gold)',  red: false },
            { icon: '⚖️', label: 'Casos Ativos', val: String(animStats.casosAtivos),           color: '#22c55e',      red: false },
            { icon: '📄', label: 'Contratos',    val: String(animStats.contratosVigentes),     color: '#3b82f6',      red: false },
            { icon: '🔔', label: 'Alertas',      val: String(animStats.alertasUnread),         color: animStats.alertasUnread > 0 ? '#ef4444' : 'var(--text-4)', red: animStats.alertasUnread > 0 },
            { icon: '💰', label: 'Sob Gestão',   val: formatMoney(animStats.valorGestao),      color: 'var(--gold)',  red: false },
          ] as const).map((s, i) => (
            <div key={i} style={{ padding: '8px 14px', background: 'var(--bg-3)', border: `1px solid ${s.red ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: '10px', textAlign: 'center', minWidth: '78px', boxShadow: s.red ? '0 0 8px rgba(239,68,68,0.08)' : 'none' }}>
              <div style={{ fontSize: '14px', marginBottom: '2px' }}>{s.icon}</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: s.color, lineHeight: 1, whiteSpace: 'nowrap' }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-5)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 2 — MAIN GRID (3 columns)                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="dash-z2" style={{ padding: '20px 28px' }}>

        {/* ── COLUMN 1: Requer Atenção ── */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>⚡ Requer Atenção</span>
            {attentionItems.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '20px' }}>
                {attentionItems.length}
              </span>
            )}
          </div>

          {attentionItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
              <p style={{ margin: 0, fontSize: '13px', color: '#22c55e', fontWeight: '700' }}>Tudo sob controle</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-5)' }}>Nenhum item urgente no momento</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
              {attentionItems.map(item => {
                const lv = LEVEL[item.level];
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 10px 0', background: lv.bg, border: `1px solid ${lv.border}`, borderLeft: `4px solid ${lv.color}`, borderRadius: '8px', boxShadow: lv.glow }}>
                    <div style={{ fontSize: '18px', flexShrink: 0, padding: '0 10px' }}>{item.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: lv.color, letterSpacing: '0.8px' }}>{lv.label}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>· {item.dateLabel}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.context}</div>
                    </div>
                    <Link href={item.link} style={{ flexShrink: 0, marginRight: '10px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: lv.color, color: '#fff', textDecoration: 'none' }}>Ver →</Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── COLUMN 2: Clientes ── */}
        <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>◉ Clientes</span>
            <Link href="/dashboard/clientes" style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '420px', overflowY: 'auto' }}>
            {data.clients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-4)', fontSize: '12px' }}>Nenhum cliente cadastrado.</div>
            ) : data.clients.slice(0, 8).map(c => {
              const isPJ = c.type === 'pessoa_juridica';
              const casosCount = c.projects?.length || 0;
              const contratosCount = c.contracts?.length || 0;
              const maxRisk = (c.projects || []).reduce((m, p) => {
                if (p.risk_level === 'alto') return 'alto';
                if (p.risk_level === 'medio' && m !== 'alto') return 'medio';
                return m;
              }, 'baixo' as string);
              const riskDot = maxRisk === 'alto' ? '#ef4444' : maxRisk === 'medio' ? '#eab308' : '#22c55e';
              const alertCount = clientAlertMap.get(c.id) || 0;
              return (
                <Link key={c.id} href={`/dashboard/clientes/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div className="client-row" style={{ padding: '9px 11px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{c.name}</span>
                          <span style={{ flexShrink: 0, fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '10px', background: isPJ ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)', color: isPJ ? '#3b82f6' : '#22c55e' }}>{isPJ ? 'PJ' : 'PF'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>{casosCount} caso{casosCount !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>{contratosCount} contrato{contratosCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                        {alertCount > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: '700', background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '1px 6px', borderRadius: '10px' }}>{alertCount}</span>
                        )}
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: riskDot }} title={`Risco ${maxRisk}`} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <Link href="/dashboard/clientes" className="btn-gold" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}>
              + Novo Cliente
            </Link>
          </div>
        </div>

        {/* ── COLUMN 3: Feed IA ── */}
        <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>◈ Feed IA</span>
            {unreadFeedCount > 0 && (
              <button onClick={markAllAlertsRead} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                Marcar como lidos
              </button>
            )}
          </div>
          {feed.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'var(--text-5)', fontSize: '11px', textAlign: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>◈</span>
              <span>Nenhuma atividade ainda.<br />Faça upload de documentos para começar.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto', maxHeight: '440px' }}>
              {feed.map((item: any) => {
                const isUnread = !item.is_read;
                const icon = item.type === 'fraud' || item.type === 'fraude' ? '🚨'
                  : item.type === 'deadline' || item.type === 'vencimento' ? '📅'
                  : item.type === 'risk' ? '⚠️'
                  : item.type === 'renovacao' ? '🔄' : '◈';
                return (
                  <div key={`${item._src}-${item.id}`} style={{ padding: '9px 11px', background: isUnread ? 'var(--bg-2)' : 'var(--bg)', border: `1px solid ${isUnread ? 'var(--border-2)' : 'var(--border)'}`, borderRadius: '8px', opacity: isUnread ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.45', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>
                          {item.message}
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '3px', display: 'block' }}>
                          {timeAgo(item.created_at)} · {item._src === 'ai' ? 'Alerta IA' : 'Contrato'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3 — BOTTOM GRID (2 columns)                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="dash-z3" style={{ padding: '0 28px 36px' }}>

        {/* ── LEFT: Casos Ativos ── */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>⚖ Casos Ativos</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'alto-risco', label: 'Alto Risco' },
                { key: 'm&a', label: 'M&A' },
                { key: 'trabalhista', label: 'Trabalhista' },
                { key: 'contratos', label: 'Contratos' },
              ].map(f => (
                <button key={f.key} onClick={() => setCaseFilter(f.key)} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', background: caseFilter === f.key ? 'var(--gold)' : 'var(--bg-3)', color: caseFilter === f.key ? '#000' : 'var(--text-4)', border: `1px solid ${caseFilter === f.key ? 'var(--gold)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {filteredCases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-5)', fontSize: '12px' }}>
              Nenhum caso{caseFilter !== 'todos' ? ` com filtro "${caseFilter}"` : ' ativo'}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'Caso', 'Área', 'Status', 'Risco', 'Docs', 'Atividade'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: '9px', color: 'var(--text-5)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(p => {
                    const rc = p.risk_level === 'alto' ? '#ef4444' : p.risk_level === 'medio' ? '#eab308' : '#22c55e';
                    const sc = p.status === 'ativo' ? '#22c55e' : p.status === 'encerrado' ? 'var(--text-4)' : 'var(--gold)';
                    return (
                      <tr key={p.id} className="case-row" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 8px' }}>
                          {p.clients
                            ? <Link href={`/dashboard/clientes/${p.clients.id}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '11px', fontWeight: '600' }}>{p.clients.name}</Link>
                            : <span style={{ color: 'var(--text-5)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 8px', maxWidth: '160px' }}>
                          <Link href={`/dashboard/projeto/${p.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: '500', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{p.name}</Link>
                        </td>
                        <td style={{ padding: '8px 8px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-4)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: '10px', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{p.area || '—'}</span>
                        </td>
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '10px', color: sc }}>● {p.status}</span>
                        </td>
                        <td style={{ padding: '8px 8px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: rc, background: `${rc}18`, padding: '2px 7px', borderRadius: '10px', textTransform: 'uppercase' }}>{p.risk_level}</span>
                        </td>
                        <td style={{ padding: '8px 8px', color: 'var(--text-4)', textAlign: 'center', fontSize: '11px' }}>{p.documents?.length || 0}</td>
                        <td style={{ padding: '8px 8px', color: 'var(--text-5)', whiteSpace: 'nowrap', fontSize: '10px' }}>{timeAgo(p.updated_at || p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT: Contratos Radar ── */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>▤ Radar de Vencimentos</span>
          </div>

          {/* Vencendo em 7 dias */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#ef4444', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              ● Vencendo em 7 dias
            </div>
            {contractsExpiring7.length === 0 ? (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-5)', fontStyle: 'italic' }}>Nenhum</p>
            ) : contractsExpiring7.map(c => {
              const days = daysUntil(c.end_date)!;
              return (
                <Link key={c.id} href={`/dashboard/contratos/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', transition: 'background 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '1px' }}>{c.clients?.name || '—'}{c.value ? ' · ' + formatMoney(c.value) : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#ef4444', lineHeight: 1 }}>{days}</div>
                      <div style={{ fontSize: '9px', color: '#ef4444', textTransform: 'uppercase' }}>dia{days !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Vencendo em 30 dias */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#eab308', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(234,179,8,0.2)' }}>
              ◐ Vencendo em 30 dias
            </div>
            {contractsExpiring30.length === 0 ? (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-5)', fontStyle: 'italic' }}>Nenhum</p>
            ) : contractsExpiring30.slice(0, 4).map(c => {
              const days = daysUntil(c.end_date)!;
              return (
                <Link key={c.id} href={`/dashboard/contratos/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', transition: 'background 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '1px' }}>{c.clients?.name || '—'}{c.value ? ' · ' + formatMoney(c.value) : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#eab308', lineHeight: 1 }}>{days}</div>
                      <div style={{ fontSize: '9px', color: '#eab308', textTransform: 'uppercase' }}>dias</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Aguardando Assinatura */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#3b82f6', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
              ✍ Aguardando Assinatura
            </div>
            {contractsWaiting.length === 0 ? (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-5)', fontStyle: 'italic' }}>Nenhum</p>
            ) : contractsWaiting.slice(0, 3).map(c => {
              const daysWaiting = Math.floor((today.getTime() - new Date(c.created_at).getTime()) / 86400000);
              return (
                <Link key={c.id} href={`/dashboard/contratos/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', transition: 'background 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '1px' }}>{c.clients?.name || '—'}{c.value ? ' · ' + formatMoney(c.value) : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px', fontSize: '10px', color: '#3b82f6', fontWeight: '600' }}>há {daysWaiting}d</div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <Link href="/dashboard/contratos" style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none' }}>Ver todos os contratos →</Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.45} 50%{opacity:.85} }
        .skel { background: var(--bg-3); animation: shimmer 1.6s ease-in-out infinite; }
        .dash-z2 { display: grid; grid-template-columns: 45fr 30fr 25fr; gap: 18px; }
        .dash-z3 { display: grid; grid-template-columns: 60fr 40fr; gap: 18px; }
        .client-row:hover { border-color: var(--gold-border) !important; }
        .case-row { border-left: 3px solid transparent; transition: background 0.1s, border-left-color 0.1s; }
        .case-row:hover { background: var(--bg-2); border-left-color: var(--gold); }
        @media (max-width: 1150px) { .dash-z2 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 800px)  { .dash-z2 { grid-template-columns: 1fr; } .dash-z3 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
