"use client";
import { useState } from "react";

const DEADLINES = [
  { date: "05/03", day: 5, month: 3, name: "Contestação — Metalúrgica ABC", case: "Trabalhista", type: "Peça processual", urgency: "red" },
  { date: "07/03", day: 7, month: 3, name: "Recurso Especial ao STJ — Grupo Nordeste", case: "M&A", type: "Recurso", urgency: "red" },
  { date: "10/03", day: 10, month: 3, name: "Réplica — 5ª Vara Cível SP", case: "TechBrasil", type: "Peça processual", urgency: "yellow" },
  { date: "12/03", day: 12, month: 3, name: "Audiência de conciliação", case: "TechBrasil", type: "Audiência", urgency: "yellow" },
  { date: "15/03", day: 15, month: 3, name: "Laudo pericial — Inovação Tech", case: "Contratos", type: "Perícia", urgency: "yellow" },
  { date: "18/03", day: 18, month: 3, name: "Prazo para manifestação CARF", case: "Tributário", type: "Administrativo", urgency: "yellow" },
  { date: "20/03", day: 20, month: 3, name: "Contestação — Vista Verde", case: "Cível", type: "Peça processual", urgency: "green" },
  { date: "25/03", day: 25, month: 3, name: "Proposta de acordo — Família Rodrigues", case: "Tributário", type: "Consultivo", urgency: "green" },
  { date: "28/03", day: 28, month: 3, name: "Memorial — TRF 3ª Região", case: "Tributário", type: "Peça processual", urgency: "green" },
  { date: "30/03", day: 30, month: 3, name: "Recurso Ordinário — TST", case: "Trabalhista", type: "Recurso", urgency: "green" },
];

export default function PrazosPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterCase, setFilterCase] = useState("Todos");
  const [filterType, setFilterType] = useState("Todos");

  const cases = ["Todos", "Trabalhista", "M&A", "TechBrasil", "Cível", "Tributário", "Contratos"];
  const types = ["Todos", "Peça processual", "Recurso", "Audiência", "Perícia", "Administrativo", "Consultivo"];

  const filtered = DEADLINES.filter(d =>
    (filterCase === 'Todos' || d.case === filterCase) &&
    (filterType === 'Todos' || d.type === filterType)
  );

  const today = 3; // March 3

  return (
    <div style={{ padding: '0', minHeight: '100vh' }}>
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              <span style={{ color: '#C9A84C', marginRight: '8px' }}>◷</span>Prazos
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
              <span style={{ color: '#ef4444', fontWeight: '600' }}>2 críticos</span> · <span style={{ color: '#eab308' }}>4 esta semana</span> · 4 futuros
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('list')} className={view === 'list' ? 'btn-gold' : 'btn-ghost'} style={{ padding: '6px 14px', fontSize: '12px' }}>Lista</button>
            <button onClick={() => setView('calendar')} className={view === 'calendar' ? 'btn-gold' : 'btn-ghost'} style={{ padding: '6px 14px', fontSize: '12px' }}>Calendário</button>
            <button className="btn-ghost" style={{ fontSize: '12px' }}>+ Novo Prazo</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterCase} onChange={e => setFilterCase(e.target.value)} style={{ width: '180px' }}>
            {cases.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: '180px' }}>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {view === 'list' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['Data', 'Prazo', 'Caso', 'Tipo', 'Urgência', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const daysLeft = d.day - today;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{
                          fontWeight: '700', fontSize: '15px',
                          color: d.urgency === 'red' ? '#ef4444' : d.urgency === 'yellow' ? '#eab308' : '#22c55e'
                        }}>{d.date}</div>
                        <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
                          {daysLeft === 0 ? 'Hoje' : daysLeft < 0 ? `${Math.abs(daysLeft)}d atrás` : `em ${daysLeft}d`}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', color: '#e0e0e0' }}>{d.name}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}><span className="badge-gray">{d.case}</span></td>
                      <td style={{ padding: '14px 16px' }}><span className="badge-gray">{d.type}</span></td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className={`badge-${d.urgency}`}>
                          {d.urgency === 'red' ? '🔴 Crítico' : d.urgency === 'yellow' ? '🟡 Esta semana' : '🟢 Futuro'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Ver caso</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Calendar view
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Março 2026</h3>
            </div>
            {/* Days header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#555', fontWeight: '600', padding: '4px' }}>{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {/* March 2026 starts on Sunday */}
              {Array.from({length: 31}, (_, i) => i + 1).map(day => {
                const deadline = DEADLINES.find(d => d.day === day);
                const isToday = day === today;
                return (
                  <div key={day} style={{
                    minHeight: '64px', padding: '6px', borderRadius: '6px',
                    background: isToday ? 'rgba(201,168,76,0.1)' : '#0d0d0d',
                    border: isToday ? '1px solid rgba(201,168,76,0.3)' : '1px solid #1a1a1a',
                    position: 'relative'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: isToday ? '700' : '400', color: isToday ? '#C9A84C' : '#555', marginBottom: '4px' }}>{day}</div>
                    {deadline && (
                      <div style={{
                        fontSize: '9px', padding: '2px 4px', borderRadius: '3px',
                        background: deadline.urgency === 'red' ? 'rgba(239,68,68,0.2)' : deadline.urgency === 'yellow' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                        color: deadline.urgency === 'red' ? '#ef4444' : deadline.urgency === 'yellow' ? '#eab308' : '#22c55e',
                        lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const
                      }}>
                        {deadline.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
