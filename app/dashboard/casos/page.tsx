"use client";
import { useState } from "react";
import Link from "next/link";

const CASES = [
  { id: 1, name: "Demissão sem justa causa — Metalúrgica ABC", area: "Trabalhista", client: "João Carlos Silva", status: "Em andamento", risk: "red", deadline: "05/03/2026", proc: "0001234-56.2026.5.02.0001", judge: "2ª Vara do Trabalho de SP", value: "R$ 145.000,00" },
  { id: 2, name: "Rescisão contratual — TechBrasil Ltda", area: "Contratos", client: "TechBrasil Ltda", status: "Aguardando contraparte", risk: "yellow", deadline: "12/03/2026", proc: "0009876-54.2026.8.26.0100", judge: "5ª Vara Cível de SP", value: "R$ 890.000,00" },
  { id: 3, name: "Recuperação judicial — Grupo Nordeste S.A.", area: "M&A", client: "Grupo Nordeste S.A.", status: "URGENTE", risk: "red", deadline: "07/03/2026", proc: "0002345-11.2026.8.26.0100", judge: "1ª Vara de Falências SP", value: "R$ 45.000.000,00" },
  { id: 4, name: "Embargo de obra — Condomínio Vista Verde", area: "Cível", client: "Condomínio Vista Verde", status: "Em andamento", risk: "green", deadline: "20/03/2026", proc: "0007654-32.2025.8.26.0302", judge: "3ª Vara Cível de Londrina", value: "R$ 320.000,00" },
  { id: 5, name: "Planejamento tributário — HoldingFam", area: "Tributário", client: "Família Rodrigues", status: "Consultivo", risk: "green", deadline: "30/03/2026", proc: "Consultivo — sem processo", judge: "—", value: "Honorários mensais" },
  { id: 6, name: "Disputa de marca — Inovação Tech S.A.", area: "Contratos", client: "Inovação Tech S.A.", status: "Aguardando perícia", risk: "yellow", deadline: "15/03/2026", proc: "0004567-89.2025.8.26.0100", judge: "12ª Vara Cível de SP", value: "R$ 2.400.000,00" },
];

const AREAS = ["Todos", "Trabalhista", "Cível", "Tributário", "Contratos", "M&A"];

export default function CasosPage() {
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof CASES[0] | null>(null);

  const filtered = CASES.filter(c =>
    (filter === "Todos" || c.area === filter) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.client.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) {
    return <CaseDetail caso={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Casos</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>23 casos ativos · 3 em situação crítica</p>
          </div>
          <button className="btn-gold">+ Novo Caso</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar caso ou cliente..." style={{ width: '260px' }} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {AREAS.map(a => (
              <button key={a} onClick={() => setFilter(a)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid',
                  borderColor: filter === a ? '#C9A84C' : '#2a2a2a',
                  background: filter === a ? 'rgba(201,168,76,0.1)' : 'transparent',
                  color: filter === a ? '#C9A84C' : '#666',
                  fontSize: '12px', cursor: 'pointer', fontWeight: '500'
                }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                {['Caso', 'Área', 'Cliente', 'Status', 'Risco', 'Próximo Prazo', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setSelected(c)}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '2px' }}>{c.proc}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><span className="badge-gray">{c.area}</span></td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-3)' }}>{c.client}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge-${c.risk === 'red' && c.status === 'URGENTE' ? 'red' : 'gray'}`} style={{ fontSize: '11px' }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge-${c.risk}`}>{c.risk === 'red' ? '● Alto' : c.risk === 'yellow' ? '● Médio' : '● Baixo'}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: c.risk === 'red' ? '#ef4444' : '#888', fontWeight: c.risk === 'red' ? '600' : '400' }}>{c.deadline}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CaseDetail({ caso, onBack }: { caso: typeof CASES[0], onBack: () => void }) {
  const TIMELINE = [
    { date: "14/02/2026", event: "Petição inicial protocolada", type: "action" },
    { date: "20/02/2026", event: "Distribuição — 2ª Vara Cível SP", type: "info" },
    { date: "24/02/2026", event: "Despacho: cite-se", type: "info" },
    { date: "28/02/2026", event: "Citação efetivada — AR recebido", type: "success" },
    { date: "05/03/2026", event: "PRAZO: Contestação (15 dias)", type: "deadline" },
    { date: "20/03/2026", event: "Previsão: Audiência de conciliação", type: "future" },
  ];

  const DOCS_CASO = [
    { name: "Petição Inicial.pdf", date: "14/02/2026", status: "✓ Analisado" },
    { name: "Procuração.pdf", date: "14/02/2026", status: "✓ Analisado" },
    { name: "Documentos do cliente.zip", date: "14/02/2026", status: "✓ Analisado" },
    { name: "AR de citação.pdf", date: "28/02/2026", status: "Pendente análise" },
  ];

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onBack} className="btn-ghost" style={{ padding: '6px 12px' }}>← Voltar</button>
            <div>
              <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{caso.name}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>{caso.proc} · {caso.judge}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/dashboard/chat">
              <button className="btn-gold">◈ Consultar IA</button>
            </Link>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* Left */}
        <div>
          {/* Info */}
          <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '600' }}>Informações do Caso</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Cliente', value: caso.client },
                { label: 'Área', value: caso.area },
                { label: 'Valor da Causa', value: caso.value },
                { label: 'Risco', value: caso.risk === 'red' ? 'Alto' : caso.risk === 'yellow' ? 'Médio' : 'Baixo' },
                { label: 'Status', value: caso.status },
                { label: 'Próximo prazo', value: caso.deadline },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{f.label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '600' }}>Linha do Tempo</h3>
            <div style={{ position: 'relative' }}>
              {TIMELINE.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px',
                      background: t.type === 'deadline' ? '#ef4444' : t.type === 'success' ? '#22c55e' : t.type === 'future' ? '#333' : '#C9A84C',
                      border: t.type === 'future' ? '1px solid #333' : 'none',
                      minWidth: '10px'
                    }} />
                    {i < TIMELINE.length - 1 && <div style={{ width: '1px', flex: 1, background: '#1f1f1f', minHeight: '20px', margin: '4px 0' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-4)', marginBottom: '2px' }}>{t.date}</div>
                    <div style={{ fontSize: '13px', color: t.type === 'deadline' ? '#ef4444' : t.type === 'future' ? '#555' : '#ccc', fontWeight: t.type === 'deadline' ? '600' : '400' }}>
                      {t.event}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '600' }}>Documentos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DOCS_CASO.map((d, i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>📄 {d.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: d.status.includes('✓') ? '#22c55e' : '#eab308' }}>{d.status}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>{d.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>+ Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
