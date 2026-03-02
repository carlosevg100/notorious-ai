"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Doc { id: string; name: string; file_type: string; ai_status: string; created_at: string; project_id: string; document_extractions?: any[]; }

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/documents').then(r => r.json()).then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const filtered = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Biblioteca de Documentos</h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>{docs.length} documentos</p>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..." style={{ width: '300px', marginBottom: '20px' }} />
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-4)' }}>Carregando...</div> : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Documento', 'Tipo IA', 'Status IA', 'Enviado em', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-4)', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const ext = d.document_extractions?.[0];
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-2)' }}>📄 {d.name}</td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--gold)' }}>{ext?.doc_type || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '12px', color: d.ai_status === 'complete' ? '#22c55e' : d.ai_status === 'processing' ? '#C9A84C' : '#888' }}>
                          {d.ai_status === 'complete' ? '✓ Analisado' : d.ai_status === 'processing' ? '⟳ Processando' : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-5)' }}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <Link href={`/dashboard/projeto/${d.project_id}`}><button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>Ver projeto</button></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
