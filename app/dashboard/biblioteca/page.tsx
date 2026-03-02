"use client";
import { useState } from "react";

const FOLDERS = [
  { name: "Modelos", icon: "📋", count: 48, updated: "há 2 dias" },
  { name: "Precedentes", icon: "⚖", count: 127, updated: "há 1 semana" },
  { name: "Contratos", icon: "📝", count: 34, updated: "ontem" },
  { name: "Pareceres", icon: "📊", count: 23, updated: "há 3 dias" },
  { name: "Petições Tipo", icon: "📄", count: 56, updated: "hoje" },
  { name: "Acordos", icon: "🤝", count: 19, updated: "há 5 dias" },
];

const RECENT = [
  { name: "Modelo — Petição Inicial Trabalhista.docx", folder: "Modelos", date: "Hoje, 09:15", size: "45 KB" },
  { name: "Precedente STJ — Rescisão Indireta 2025.pdf", folder: "Precedentes", date: "Ontem, 14:30", size: "234 KB" },
  { name: "Contrato Padrão Prestação de Serviços v2.docx", folder: "Contratos", date: "02/03/2026", size: "88 KB" },
  { name: "Parecer — Planejamento Tributário Holdings.pdf", folder: "Pareceres", date: "01/03/2026", size: "1.2 MB" },
  { name: "Modelo Recurso Ordinário Trabalhista.docx", folder: "Modelos", date: "28/02/2026", size: "52 KB" },
];

export default function BibliotecaPage() {
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  return (
    <div style={{ padding: '0', minHeight: '100vh' }}>
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              <span style={{ color: '#C9A84C', marginRight: '8px' }}>▤</span>Biblioteca
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>B/Luz Advogados · 307 documentos</p>
          </div>
          <button className="btn-gold">+ Novo documento</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Search */}
        <div style={{ marginBottom: '24px', position: 'relative', maxWidth: '500px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '16px' }}>◎</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na biblioteca..." style={{ paddingLeft: '40px' }} />
        </div>

        {/* Folders */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '12px' }}>PASTAS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {FOLDERS.map(f => (
              <div key={f.name} onClick={() => setActiveFolder(activeFolder === f.name ? null : f.name)}
                style={{
                  padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeFolder === f.name ? 'rgba(201,168,76,0.08)' : '#141414',
                  border: activeFolder === f.name ? '1px solid rgba(201,168,76,0.3)' : '1px solid #1f1f1f'
                }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>{f.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: activeFolder === f.name ? '#C9A84C' : '#e0e0e0', marginBottom: '4px' }}>{f.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#555' }}>{f.count} docs</span>
                  <span style={{ fontSize: '10px', color: '#444' }}>{f.updated}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent */}
        <div>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '12px' }}>
            {activeFolder ? `PASTA: ${activeFolder.toUpperCase()}` : 'DOCUMENTOS RECENTES'}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['Nome', 'Pasta', 'Data', 'Tamanho', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT.filter(d => !activeFolder || d.folder === activeFolder).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{d.name.includes('.pdf') ? '📄' : '📝'}</span>
                        <span style={{ fontSize: '13px', color: '#e0e0e0' }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><span className="badge-gray">{d.folder}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>{d.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>{d.size}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Abrir</button>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Usar no Chat</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
