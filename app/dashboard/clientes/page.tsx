"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  type: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  projects: { id: string; status: string }[];
  contracts: { id: string; status: string }[];
}

const AREAS = ["Trabalhista", "Cível", "Tributário", "Contratos", "M&A", "Contencioso", "Societário", "Penal", "Imobiliário", "Outros"];

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", type: "pessoa_juridica", document: "", email: "", phone: "", notes: "",
  });

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) setClients(await res.json());
    } catch {}
    setLoading(false);
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const client = await res.json();
        setShowModal(false);
        setForm({ name: "", type: "pessoa_juridica", document: "", email: "", phone: "", notes: "" });
        router.push(`/dashboard/clientes/${client.id}`);
      }
    } catch {}
    setSaving(false);
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.document || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'todos' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalCasos = clients.reduce((a, c) => a + (c.projects?.length || 0), 0);
  const totalContratos = clients.reduce((a, c) => a + (c.contracts?.length || 0), 0);
  const casosAtivos = clients.reduce((a, c) => a + (c.projects?.filter(p => p.status === 'ativo').length || 0), 0);
  const contratosVigentes = clients.reduce((a, c) => a + (c.contracts?.filter(co => co.status === 'vigente').length || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>◉ Clientes</h1>
            <span style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>{clients.length}</span>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✦ Novo Cliente
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total Clientes', value: String(clients.length), color: 'var(--gold)' },
            { label: 'Casos Ativos', value: String(casosAtivos), color: '#22c55e' },
            { label: 'Contratos Vigentes', value: String(contratosVigentes), color: '#3b82f6' },
            { label: 'Total Casos', value: String(totalCasos), color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '8px' }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, documento ou e-mail..."
            style={{ flex: 1, minWidth: '200px' }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'pessoa_juridica', label: 'Pessoa Jurídica' },
              { value: 'pessoa_fisica', label: 'Pessoa Física' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
                className={typeFilter === opt.value ? 'btn-gold' : 'btn-ghost'}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>◉</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '8px' }}>
              {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
            </div>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>
              {clients.length === 0 ? 'Adicione seu primeiro cliente para começar' : 'Tente ajustar os filtros de busca'}
            </div>
            {clients.length === 0 && (
              <button onClick={() => setShowModal(true)} className="btn-gold">
                ✦ Adicionar Primeiro Cliente
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {filtered.map(client => {
              const casosCount = client.projects?.length || 0;
              const contratosCount = client.contracts?.length || 0;
              const isPJ = client.type === 'pessoa_juridica';

              return (
                <div key={client.id} className="card"
                  style={{ padding: '20px', cursor: 'pointer', transition: 'border-color 0.15s', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C40')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  onClick={() => router.push(`/dashboard/clientes/${client.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.name}
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px',
                        background: isPJ ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                        color: isPJ ? '#3b82f6' : '#22c55e',
                        border: `1px solid ${isPJ ? '#3b82f620' : '#22c55e20'}`,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>
                        {isPJ ? 'PJ' : 'PF'}
                      </span>
                    </div>
                  </div>

                  {client.document && (
                    <div style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '8px' }}>
                      {isPJ ? 'CNPJ' : 'CPF'}: {client.document}
                    </div>
                  )}

                  {client.email && (
                    <div style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.email}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{casosCount}</span> caso{casosCount !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{contratosCount}</span> contrato{contratosCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/clientes/${client.id}`); }}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '12px', fontSize: '12px' }}>
                    Ver Cliente →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--gold)' }}>✦ Novo Cliente</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <form onSubmit={createClient}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Nome *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Petrobras S.A., João Silva..." style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}>
                    <option value="pessoa_juridica">Pessoa Jurídica</option>
                    <option value="pessoa_fisica">Pessoa Física</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    {form.type === 'pessoa_juridica' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))}
                    placeholder={form.type === 'pessoa_juridica' ? '00.000.000/0001-00' : '000.000.000-00'}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>E-mail</label>
                    <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" placeholder="email@exemplo.com" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Telefone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Observações</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notas internas sobre o cliente..."
                    rows={3}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button type="submit" className="btn-gold" disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
                    {saving ? 'Salvando...' : '✦ Salvar Cliente'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
