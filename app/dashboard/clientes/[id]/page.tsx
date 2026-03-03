"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  created_at: string; documents: any[];
}
interface Contract {
  id: string; name: string; status: string; value: number | null;
  end_date: string | null; contract_type: string;
  contract_extractions?: { risk_level: string }[];
}
interface Client {
  id: string; name: string; type: string; document: string | null;
  email: string | null; phone: string | null; address: string | null; notes: string | null;
  created_at: string;
  projects: Project[];
  contracts: Contract[];
}

const AREAS = ["Trabalhista", "Cível", "Tributário", "Contratos", "M&A", "Contencioso", "Societário", "Penal", "Imobiliário", "Outros"];
const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    vigente:               { label: 'Vigente',             color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    vencido:               { label: 'Vencido',             color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    renovacao:             { label: 'Em Renovação',        color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    rescindido:            { label: 'Rescindido',          color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    aguardando_assinatura: { label: 'Ag. Assinatura',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    rascunho:              { label: 'Rascunho',            color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    ativo:                 { label: 'Ativo',               color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    inativo:               { label: 'Inativo',             color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  };
  const s = map[status] || { label: status, color: '#888', bg: 'transparent' };
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCaseArea, setNewCaseArea] = useState("Trabalhista");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadClient(); }, [id]);

  async function loadClient() {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.ok) setClient(await res.json());
      else router.push('/dashboard/clientes');
    } catch {}
    setLoading(false);
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCaseName, area: newCaseArea, client_id: id }),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/dashboard/projeto/${project.id}`);
      }
    } catch {}
    setCreating(false);
  }

  if (loading || !client) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const isPJ = client.type === 'pessoa_juridica';
  const casosAtivos = client.projects.filter(p => p.status === 'ativo').length;
  const contratosVigentes = client.contracts.filter(c => c.status === 'vigente').length;
  const totalDocs = client.projects.reduce((a, p) => a + (p.documents?.length || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Hero */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '20px 28px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-4)', marginBottom: '14px' }}>
          <Link href="/dashboard/clientes" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Clientes</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-3)' }}>{client.name}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>{client.name}</h1>
              <span style={{
                fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                background: isPJ ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                color: isPJ ? '#3b82f6' : '#22c55e',
                border: `1px solid ${isPJ ? '#3b82f620' : '#22c55e20'}`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {client.document && (
                <span style={{ fontSize: '13px', color: 'var(--text-4)' }}>
                  {isPJ ? 'CNPJ' : 'CPF'}: <span style={{ color: 'var(--text-2)' }}>{client.document}</span>
                </span>
              )}
              {client.email && (
                <span style={{ fontSize: '13px', color: 'var(--text-4)' }}>
                  E-mail: <span style={{ color: 'var(--text-2)' }}>{client.email}</span>
                </span>
              )}
              {client.phone && (
                <span style={{ fontSize: '13px', color: 'var(--text-4)' }}>
                  Tel: <span style={{ color: 'var(--text-2)' }}>{client.phone}</span>
                </span>
              )}
            </div>
          </div>

          <button onClick={() => router.push('/dashboard/clientes')} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }}>
            ← Clientes
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '20px' }}>
          {[
            { label: 'Total Casos', value: String(client.projects.length), color: 'var(--gold)' },
            { label: 'Casos Ativos', value: String(casosAtivos), color: '#22c55e' },
            { label: 'Contratos Vigentes', value: String(contratosVigentes), color: '#3b82f6' },
            { label: 'Documentos', value: String(totalDocs), color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* Section 1: Cases */}
        <div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                ⚖ Casos do Cliente
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-4)', fontWeight: '400' }}>{client.projects.length} total</span>
              </h2>
              <button onClick={() => setShowNewCase(!showNewCase)} className="btn-gold" style={{ fontSize: '12px', padding: '7px 14px' }}>
                ✦ Novo Caso
              </button>
            </div>

            {showNewCase && (
              <form onSubmit={createCase} style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--gold-border)' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Nome do Caso *</label>
                  <input value={newCaseName} onChange={e => setNewCaseName(e.target.value)} required placeholder="Ex: Rescisão Indireta — João Silva" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Área</label>
                  <select value={newCaseArea} onChange={e => setNewCaseArea(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-gold" disabled={creating} style={{ flex: 1, justifyContent: 'center' }}>
                    {creating ? 'Criando...' : 'Criar Caso'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowNewCase(false)}>Cancelar</button>
                </div>
              </form>
            )}

            {client.projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-4)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖</div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-2)' }}>Nenhum caso ainda</p>
                <p style={{ margin: 0, fontSize: '12px' }}>Clique em "Novo Caso" para criar o primeiro caso deste cliente</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {client.projects.map(p => (
                  <div key={p.id} style={{ padding: '14px', background: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C30')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '6px' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="badge-gray">{p.area}</span>
                          {statusBadge(p.status)}
                          <span style={{ fontSize: '11px', color: riskColor[p.risk_level] || '#888' }}>● {p.risk_level}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>{p.documents?.length || 0} docs</span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/dashboard/projeto/${p.id}`)} className="btn-ghost" style={{ fontSize: '11px', padding: '5px 12px', flexShrink: 0, marginLeft: '12px' }}>
                        Abrir Caso →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Contracts */}
        <div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                ▤ Contratos
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-4)', fontWeight: '400' }}>{client.contracts.length} total</span>
              </h2>
              <Link href="/dashboard/contratos" className="btn-ghost" style={{ fontSize: '11px', padding: '5px 10px', textDecoration: 'none' }}>
                ✦ Novo
              </Link>
            </div>

            {client.contracts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-4)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>▤</div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-2)' }}>Nenhum contrato</p>
                <p style={{ margin: 0, fontSize: '12px' }}>Adicione contratos na aba Contratos</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {client.contracts.map(c => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const days = c.end_date
                    ? Math.floor((new Date(c.end_date).getTime() - today.getTime()) / 86400000)
                    : null;
                  const isUrgent = days !== null && days >= 0 && days <= 30;
                  return (
                    <div key={c.id} style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: '6px', border: `1px solid ${isUrgent ? '#ef444420' : 'var(--border)'}`, cursor: 'pointer' }}
                      onClick={() => router.push(`/dashboard/contratos/${c.id}`)}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {c.contract_type && <span className="badge-gray" style={{ fontSize: '10px' }}>{c.contract_type}</span>}
                          {statusBadge(c.status)}
                        </div>
                        {days !== null && (
                          <span style={{ fontSize: '11px', color: isUrgent ? '#ef4444' : 'var(--text-5)', fontWeight: isUrgent ? '600' : '400' }}>
                            {days === 0 ? 'Hoje' : days < 0 ? `${Math.abs(days)}d atrás` : `${days}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="card" style={{ padding: '16px', marginTop: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '8px' }}>Observações</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6' }}>{client.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
