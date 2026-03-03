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
  id: string; name: string; status: string; value: number|null; end_date: string|null;
  contract_type: string; parties: any[];
}

const AREAS = ["Trabalhista", "Cível", "Tributário", "Contratos", "M&A", "Contencioso", "Societário", "Penal", "Imobiliário", "Outros"];

export default function Dashboard() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("Trabalhista");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [pRes, aRes, cRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/alerts'),
        fetch('/api/contratos')
      ]);
      if (pRes.ok) setProjects(await pRes.json());
      if (aRes.ok) setAlerts(await aRes.json());
      if (cRes.ok) setContracts(await cRes.json());
    } catch (e) {}
    setLoading(false);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, area: newArea })
      });
      if (res.ok) {
        const project = await res.json();
        setShowNewProject(false);
        setNewName(""); setNewArea("Trabalhista");
        router.push(`/dashboard/projeto/${project.id}`);
      }
    } catch (e) {}
    setCreating(false);
  }

  const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };
  const unreadAlerts = alerts.filter(a => !a.is_read).length;

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
            {profile?.firms?.name || 'Carregando...'} · {projects.length} caso{projects.length !== 1 ? 's' : ''} ativo{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {unreadAlerts > 0 && (
            <div style={{ position: "relative", width: "36px", height: "36px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px" }}>
              🔔
              <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "14px", height: "14px", background: "#ef4444", borderRadius: "50%", fontSize: "9px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>{unreadAlerts}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Casos Ativos", value: String(projects.filter(p => p.status === 'ativo').length), sub: "Projetos em andamento", color: "var(--gold)" },
            { label: "Prazos Críticos", value: String(alerts.filter(a => a.type === 'deadline' && !a.is_read).length), sub: "Não lidos", color: "#ef4444" },
            { label: "Alertas IA", value: String(unreadAlerts), sub: "Não lidos", color: "#8b5cf6" },
            { label: "Documentos", value: String(projects.reduce((acc, p) => acc + (p.documents?.length || 0), 0)), sub: "Total carregados", color: "#22c55e" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600", marginBottom: "8px" }}>{s.label}</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "6px" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px" }}>
          {/* Main — Projects */}
          <div>
            {/* New Project CTA */}
            {!showNewProject ? (
              <button onClick={() => setShowNewProject(true)} className="btn-gold"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '12px 20px', fontSize: '14px' }}>
                ✦ Novo Projeto / Caso
              </button>
            ) : (
              <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--gold-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: 'var(--gold)' }}>✦ Novo Projeto</h3>
                <form onSubmit={createProject}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nome do caso / projeto</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Demissão sem justa causa — João Silva" required style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Área</label>
                    <select value={newArea} onChange={e => setNewArea(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn-gold" disabled={creating} style={{ flex: 1, justifyContent: 'center' }}>
                      {creating ? 'Criando...' : 'Criar Projeto'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setShowNewProject(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Projects List */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Casos Ativos</h3>
                <Link href="/dashboard/casos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
              </div>
              {projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-4)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖</div>
                  <p style={{ margin: 0, fontSize: '13px' }}>Nenhum projeto criado ainda.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Clique em "Novo Projeto" para começar.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {projects.slice(0, 6).map(p => (
                    <Link href={`/dashboard/projeto/${p.id}`} key={p.id} style={{ textDecoration: "none" }}>
                      <div style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C30')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "4px" }}>{p.name}</div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <span className="badge-gray">{p.area}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-5)" }}>{p.documents?.length || 0} doc{(p.documents?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: '11px', color: riskColor[p.risk_level] || '#888', fontWeight: '600' }}>● {p.risk_level}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
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
          </div>
        </div>

        {/* Contratos Widget */}
        {contracts.length > 0 && (() => {
          const today = new Date(); today.setHours(0,0,0,0);
          const cVigentes = contracts.filter(c => c.status === 'vigente').length;
          const cVencendo = contracts.filter(c => {
            if(!c.end_date || c.status === 'vencido') return false;
            const d = new Date(c.end_date); d.setHours(0,0,0,0);
            const diff = Math.floor((d.getTime()-today.getTime())/86400000);
            return diff >= 0 && diff <= 30;
          }).length;
          const cValor = contracts.reduce((s,c)=>s+(c.value||0),0);
          const urgent = contracts
            .filter(c=>c.end_date && c.status!=='vencido' && c.status!=='rescindido')
            .sort((a,b)=>new Date(a.end_date!).getTime()-new Date(b.end_date!).getTime())
            .slice(0,3);
          return (
            <div style={{ marginTop: "20px" }}>
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                    <span style={{ color: "var(--gold)", marginRight: "6px" }}>▤</span>Contratos
                  </h3>
                  <Link href="/dashboard/contratos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
                </div>
                {/* Mini stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "16px" }}>
                  {[
                    { label: "Total", value: String(contracts.length), color: "var(--gold)" },
                    { label: "Vigentes", value: String(cVigentes), color: "#22c55e" },
                    { label: "Vencendo 30d", value: String(cVencendo), color: cVencendo>0?"#ef4444":"var(--text-4)" },
                    { label: "Valor", value: cValor>0?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(cValor):'—', color: "#3b82f6" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--bg-2)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-5)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{s.label}</div>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Urgent contracts */}
                {urgent.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {urgent.map(c => {
                      const d = new Date(c.end_date!); d.setHours(0,0,0,0);
                      const days = Math.floor((d.getTime()-today.getTime())/86400000);
                      const isRed = days <= 7;
                      return (
                        <Link href={`/dashboard/contratos/${c.id}`} key={c.id} style={{ textDecoration: "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-2)", borderRadius: "6px", border: `1px solid ${isRed?'#ef444430':'var(--border)'}`, cursor: "pointer" }}
                            onMouseEnter={e=>(e.currentTarget.style.borderColor=isRed?'#ef4444':'var(--gold)')}
                            onMouseLeave={e=>(e.currentTarget.style.borderColor=isRed?'#ef444430':'var(--border)')}>
                            <div style={{ overflow: "hidden" }}>
                              <div style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "300px" }}>{c.name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "2px" }}>{c.contract_type||''}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                              <div style={{ fontSize: "12px", color: isRed?"#ef4444":"var(--text-4)", fontWeight: isRed?"600":"400" }}>
                                {days===0?"Hoje":days<0?`${Math.abs(days)}d atrás`:`${days}d`}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-5)" }}>{new Date(c.end_date!+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
