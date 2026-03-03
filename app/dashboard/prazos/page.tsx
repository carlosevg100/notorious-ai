"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Deadline {
  date: string;
  description: string;
  urgency: 'alta' | 'media' | 'baixa';
  docName: string;
  projectId: string;
  projectName: string;
}

interface Project { id: string; name: string; area: string; }

export default function PrazosPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterUrgency, setFilterUrgency] = useState('Todos');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [docsRes, projRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/projects')
      ]);
      const projMap: Record<string, Project> = {};
      if (projRes.ok) {
        const projs: Project[] = await projRes.json();
        for (const p of projs) projMap[p.id] = p;
        setProjects(projMap);
      }
      if (docsRes.ok) {
        const docs: any[] = await docsRes.json();
        const all: Deadline[] = [];
        for (const doc of docs) {
          const extractions: any[] = doc.document_extractions || [];
          for (const ext of extractions) {
            for (const dl of (ext.deadlines || [])) {
              all.push({
                date: dl.date || '',
                description: dl.description || '',
                urgency: dl.urgency || 'media',
                docName: doc.name,
                projectId: doc.project_id,
                projectName: projMap[doc.project_id]?.name || 'Projeto'
              });
            }
          }
        }
        // Sort: alta first, then media, then baixa; within same urgency sort by date string
        const urgOrder = { alta: 0, media: 1, baixa: 2 };
        all.sort((a, b) => (urgOrder[a.urgency] - urgOrder[b.urgency]) || a.date.localeCompare(b.date));
        setDeadlines(all);
      }
    } catch (_) {}
    setLoading(false);
  }

  const urgColor = { alta: '#ef4444', media: '#eab308', baixa: '#22c55e' };
  const urgLabel = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };

  const filtered = deadlines.filter(d => filterUrgency === 'Todos' || d.urgency === filterUrgency);
  const critCount = deadlines.filter(d => d.urgency === 'alta').length;
  const medCount = deadlines.filter(d => d.urgency === 'media').length;

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              <span style={{ color: 'var(--gold)', marginRight: '8px' }}>◷</span>Prazos
            </h1>
            {!loading && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>
                {critCount > 0 && <span style={{ color: '#ef4444', fontWeight: '600' }}>{critCount} urgente{critCount > 1 ? 's' : ''}</span>}
                {critCount > 0 && medCount > 0 && <span> · </span>}
                {medCount > 0 && <span style={{ color: '#eab308', fontWeight: '600' }}>{medCount} médio{medCount > 1 ? 's' : ''}</span>}
                {critCount === 0 && medCount === 0 && deadlines.length === 0 && 'Nenhum prazo detectado'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('list')} className={view === 'list' ? 'btn-gold' : 'btn-ghost'} style={{ padding: '6px 14px', fontSize: '12px' }}>Lista</button>
            <button onClick={() => setView('calendar')} className={view === 'calendar' ? 'btn-gold' : 'btn-ghost'} style={{ padding: '6px 14px', fontSize: '12px' }}>Calendário</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['Todos', 'alta', 'media', 'baixa'].map(u => (
            <button key={u} onClick={() => setFilterUrgency(u)}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
                borderColor: filterUrgency === u ? (u === 'alta' ? '#ef4444' : u === 'media' ? '#eab308' : u === 'baixa' ? '#22c55e' : '#C9A84C') : '#2a2a2a',
                background: filterUrgency === u ? (u === 'alta' ? 'rgba(239,68,68,0.1)' : u === 'media' ? 'rgba(234,179,8,0.1)' : u === 'baixa' ? 'rgba(34,197,94,0.1)' : 'rgba(201,168,76,0.1)') : 'transparent',
                color: filterUrgency === u ? (u === 'alta' ? '#ef4444' : u === 'media' ? '#eab308' : u === 'baixa' ? '#22c55e' : '#C9A84C') : '#666'
              }}>
              {u === 'Todos' ? 'Todos' : urgLabel[u as keyof typeof urgLabel]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-4)' }}>Carregando...</div>
        ) : deadlines.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>◷</div>
            <p style={{ margin: '0 0 8px', fontSize: '14px' }}>Nenhum prazo encontrado.</p>
            <p style={{ margin: 0, fontSize: '12px' }}>Faça upload de documentos para a IA detectar prazos automaticamente.</p>
          </div>
        ) : view === 'list' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Data', 'Prazo', 'Projeto / Documento', 'Urgência', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-4)', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: urgColor[d.urgency] }}>{d.date || '—'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{d.description}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '500' }}>{d.projectName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '2px' }}>📄 {d.docName}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: urgColor[d.urgency] }}>{urgLabel[d.urgency]}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {d.projectId && (
                        <Link href={`/dashboard/projeto/${d.projectId}`}
                          style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-3)', textDecoration: 'none' }}>
                          Ver caso
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ padding: '24px' }}>
            <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: '13px' }}>
              Visão de calendário — {filtered.length} prazo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {filtered.map((d, i) => (
                <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: '8px', border: `1px solid ${urgColor[d.urgency]}30`, display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: urgColor[d.urgency], minWidth: '80px' }}>{d.date || '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{d.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '3px' }}>{d.projectName} · {d.docName}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: urgColor[d.urgency], fontWeight: '600' }}>{urgLabel[d.urgency]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
