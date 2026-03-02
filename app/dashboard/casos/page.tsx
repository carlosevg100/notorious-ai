"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  created_at: string; documents?: any[];
}

const AREAS = ["Todos", "Trabalhista", "Cível", "Tributário", "Contratos", "M&A", "Outros"];
const AREAS_NEW = ["Trabalhista", "Cível", "Tributário", "Contratos", "M&A", "Outros"];

export default function CasosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("Trabalhista");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, area: newArea })
    });
    if (res.ok) {
      const p = await res.json();
      setShowNew(false); setNewName(""); setNewArea("Trabalhista");
      router.push(`/dashboard/projeto/${p.id}`);
    }
    setCreating(false);
  }

  const filtered = projects.filter(p =>
    (filter === "Todos" || p.area === filter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Casos</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>{projects.length} casos ativos</p>
          </div>
          <button className="btn-gold" onClick={() => setShowNew(!showNew)}>+ Novo Caso</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {showNew && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--gold-border)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: 'var(--gold)' }}>Novo Caso</h3>
            <form onSubmit={createProject} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase' }}>Nome</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do caso..." required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase' }}>Área</label>
                <select value={newArea} onChange={e => setNewArea(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}>
                  {AREAS_NEW.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-gold" disabled={creating}>{creating ? 'Criando...' : 'Criar'}</button>
              <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>✕</button>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar caso..." style={{ width: '260px' }} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {AREAS.map(a => (
              <button key={a} onClick={() => setFilter(a)}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid', borderColor: filter === a ? '#C9A84C' : '#2a2a2a', background: filter === a ? 'rgba(201,168,76,0.1)' : 'transparent', color: filter === a ? '#C9A84C' : '#666', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-4)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖</div>
            <p style={{ margin: 0, fontSize: '14px' }}>Nenhum caso encontrado.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Caso', 'Área', 'Risco', 'Documentos', 'Criado em', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/projeto/${p.id}`)}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{p.name}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}><span className="badge-gray">{p.area}</span></td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', color: riskColor[p.risk_level] || '#888', fontWeight: '600' }}>● {p.risk_level}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-4)' }}>{p.documents?.length || 0}</td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-5)' }}>
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
