"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  created_at: string; documents: any[];
}
interface Alert { id: string; message: string; type: string; is_read: boolean; created_at: string; }
interface Contract {
  id: string; name: string; status: string; value: number | null; end_date: string | null;
  contract_type: string; parties: any[];
}
interface Client {
  id: string; name: string; type: string;
  projects: { id: string; status: string }[];
  contracts: { id: string; status: string }[];
}

export default function Dashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [pRes, aRes, cRes, clRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/alerts'),
        fetch('/api/contratos'),
        fetch('/api/clients'),
      ]);
      if (pRes.ok) setProjects(await pRes.json());
      if (aRes.ok) setAlerts(await aRes.json());
      if (cRes.ok) setContracts(await cRes.json());
      if (clRes.ok) setClients(await clRes.json());
    } catch {}
    setLoading(false);
  }

  const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };
  const unreadAlerts = alerts.filter(a => !a.is_read).length;
  const casosAtivos = projects.filter(p => p.status === 'ativo').length;
  const contratosVigentes = contracts.filter(c => c.status === 'vigente').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-4)', fontSize: '13px' }}>Carregando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top Bar */}
      <div style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>
            Olá, {profile?.name?.split(' ')[0] || 'Doutor'} 👋
          </h1>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-4)" }}>
            {profile?.firms?.name || 'Carregando...'} · {clients.length} cliente{clients.length !== 1 ? 's' : ''} · {casosAtivos} caso{casosAtivos !== 1 ? 's' : ''} ativo{casosAtivos !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {unreadAlerts > 0 && (
            <div style={{ position: "relative", width: "36px", height: "36px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px" }}>
              🔔
              <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "14px", height: "14px", background: "#ef4444", borderRadius: "50%", fontSize: "9px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>{unreadAlerts}</div>
            </div>
          )}
          <Link href="/dashboard/clientes" className="btn-gold" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '13px' }}>
            ◉ Ir para Clientes
          </Link>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total Clientes",     value: String(clients.length),       sub: "Clientes cadastrados",    color: "var(--gold)" },
            { label: "Casos Ativos",       value: String(casosAtivos),           sub: "Em andamento",            color: "#22c55e" },
            { label: "Contratos Vigentes", value: String(contratosVigentes),     sub: "Contratos ativos",        color: "#3b82f6" },
            { label: "Alertas Críticos",   value: String(unreadAlerts),          sub: "Não lidos",               color: "#ef4444" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600", marginBottom: "8px" }}>{s.label}</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "6px" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px" }}>
          {/* Main — Clientes Recentes */}
          <div>
            <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>◉ Clientes Recentes</h3>
                <Link href="/dashboard/clientes" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
              </div>
              {clients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-4)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>◉</div>
                  <p style={{ margin: 0, fontSize: '13px' }}>Nenhum cliente cadastrado ainda.</p>
                  <Link href="/dashboard/clientes" style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', color: 'var(--gold)', textDecoration: 'none' }}>
                    Adicionar primeiro cliente →
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {clients.slice(0, 5).map(c => {
                    const casosCount = c.projects?.length || 0;
                    const contratosCount = c.contracts?.length || 0;
                    const casosAtivosC = c.projects?.filter(p => p.status === 'ativo').length || 0;
                    const isPJ = c.type === 'pessoa_juridica';
                    return (
                      <Link href={`/dashboard/clientes/${c.id}`} key={c.id} style={{ textDecoration: "none" }}>
                        <div style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", transition: 'border-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C30')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "4px", fontWeight: '600' }}>{c.name}</div>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{
                                  fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '12px',
                                  background: isPJ ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                                  color: isPJ ? '#3b82f6' : '#22c55e',
                                }}>
                                  {isPJ ? 'PJ' : 'PF'}
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--text-5)" }}>{casosCount} caso{casosCount !== 1 ? 's' : ''}</span>
                                <span style={{ fontSize: "11px", color: "var(--text-5)" }}>{contratosCount} contrato{contratosCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            {casosAtivosC > 0 && (
                              <span style={{ fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                {casosAtivosC} ativo{casosAtivosC !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cases list (secondary) */}
            {projects.length > 0 && (
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>⚖ Casos Ativos</h3>
                  <Link href="/dashboard/clientes" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Via Clientes →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {projects.filter(p => p.status === 'ativo').slice(0, 6).map(p => (
                    <Link href={`/dashboard/projeto/${p.id}`} key={p.id} style={{ textDecoration: "none" }}>
                      <div style={{ padding: "10px 12px", background: "var(--bg-2)", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", transition: 'border-color 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C30')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <div>
                          <div style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "3px" }}>{p.name}</div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <span className="badge-gray">{p.area}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-5)" }}>{p.documents?.length || 0} docs</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: riskColor[p.risk_level] || '#888', fontWeight: '600' }}>● {p.risk_level}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — AI Alerts */}
          <div>
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                  <span style={{ color: "var(--gold)", marginRight: "6px" }}>◈</span>Alertas IA
                </h3>
                {unreadAlerts > 0 && <span className="badge-gold">{unreadAlerts} novos</span>}
              </div>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-4)', fontSize: '12px' }}>
                  Nenhum alerta ainda. Faça upload de documentos para a IA começar a analisar.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {alerts.slice(0, 8).map((a) => (
                    <div key={a.id} style={{
                      padding: "12px", background: "var(--bg-2)", borderRadius: "6px",
                      border: `1px solid ${a.type === 'risk' ? '#eab30820' : a.type === 'deadline' ? '#ef444420' : '#3b82f620'}`,
                      opacity: a.is_read ? 0.6 : 1
                    }}>
                      <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "4px" }}>{a.message}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-5)" }}>{new Date(a.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contratos Widget */}
            {contracts.length > 0 && (() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const urgent = contracts
                .filter(c => c.end_date && c.status !== 'vencido' && c.status !== 'rescindido')
                .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
                .slice(0, 3);
              return (
                <div className="card" style={{ padding: "20px", marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                      <span style={{ color: "var(--gold)", marginRight: "6px" }}>▤</span>Contratos Urgentes
                    </h3>
                    <Link href="/dashboard/contratos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
                  </div>
                  {urgent.map(c => {
                    const d = new Date(c.end_date!); d.setHours(0,0,0,0);
                    const days = Math.floor((d.getTime() - today.getTime()) / 86400000);
                    const isRed = days <= 7;
                    return (
                      <Link href={`/dashboard/contratos/${c.id}`} key={c.id} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-2)", borderRadius: "6px", border: `1px solid ${isRed ? '#ef444430' : 'var(--border)'}`, cursor: "pointer", marginBottom: '6px' }}>
                          <div style={{ overflow: "hidden" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>{c.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "2px" }}>{c.contract_type || ''}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                            <div style={{ fontSize: "12px", color: isRed ? "#ef4444" : "var(--text-4)", fontWeight: isRed ? "600" : "400" }}>
                              {days === 0 ? "Hoje" : days < 0 ? `${Math.abs(days)}d atrás` : `${days}d`}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
