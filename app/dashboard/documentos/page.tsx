"use client";
import { useState } from "react";

const DOCS = [
  { id: 1, name: "Petição Inicial — Grupo Nordeste.pdf", type: "Petição", date: "14/02/2026", size: "2.4 MB", status: "analisado", case: "Grupo Nordeste", tags: ["M&A", "Recuperação Judicial"] },
  { id: 2, name: "Contrato de Prestação_TechBrasil_v3.pdf", type: "Contrato", date: "18/02/2026", size: "856 KB", status: "risco", case: "TechBrasil", tags: ["Contratos"] },
  { id: 3, name: "Notificação Extrajudicial_ABC.pdf", type: "Notificação", date: "20/02/2026", size: "341 KB", status: "analisado", case: "Metalúrgica ABC", tags: ["Trabalhista"] },
  { id: 4, name: "AR de citação — Vista Verde.pdf", type: "Ato Processual", date: "28/02/2026", size: "128 KB", status: "pendente", case: "Vista Verde", tags: ["Cível"] },
  { id: 5, name: "Laudo Pericial — Inovação Tech.pdf", type: "Laudo", date: "01/03/2026", size: "4.1 MB", status: "processando", case: "Inovação Tech", tags: ["Contratos"] },
];

const ANALYSIS = {
  summary: "Contrato de Prestação de Serviços entre TechBrasil Ltda (contratante) e Inovação Solutions (contratada). Vigência de 24 meses com renovação automática. Valor total: R$ 890.000,00 em 24 parcelas mensais.",
  risks: [
    { level: "high", text: "Cláusula de não-concorrência de 5 anos — excede entendimento STJ (máx. 2 anos)" },
    { level: "high", text: "Foro de eleição estrangeiro (Frankfurt) — pode ser afastado pelo juiz brasileiro" },
    { level: "medium", text: "Multa rescisória de 30% — potencialmente abusiva (TJ-SP: máx. 20%)" },
  ],
  dates: [
    { label: "Início de vigência", value: "01/03/2026" },
    { label: "Término previsto", value: "28/02/2028" },
    { label: "Prazo para rescisão sem multa", value: "01/12/2026 (90 dias de aviso prévio)" },
    { label: "Reajuste anual (IGPM)", value: "01/03 de cada ano" },
  ]
};

export default function DocumentosPage() {
  const [dragging, setDragging] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<typeof DOCS[0] | null>(null);

  return (
    <div style={{ padding: '0', minHeight: '100vh' }}>
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Documentos</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#555', marginTop: '2px' }}>47 documentos · 8 aguardando análise</p>
          </div>
          <button className="btn-gold">+ Enviar Documento</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Upload */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); }}
          style={{
            border: `2px dashed ${dragging ? '#C9A84C' : '#2a2a2a'}`,
            borderRadius: '10px', padding: '32px', textAlign: 'center',
            background: dragging ? 'rgba(201,168,76,0.05)' : '#0d0d0d',
            cursor: 'pointer', marginBottom: '24px', transition: 'all 0.2s'
          }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
          <div style={{ fontSize: '14px', color: dragging ? '#C9A84C' : '#666', fontWeight: '500' }}>
            {dragging ? 'Solte para enviar' : 'Arraste e solte documentos aqui'}
          </div>
          <div style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>PDF, DOCX, TXT — máx. 50MB por arquivo</div>
          <button className="btn-ghost" style={{ marginTop: '16px' }}>Selecionar arquivos</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 400px' : '1fr', gap: '20px' }}>
          {/* List */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: '8px' }}>
              <input placeholder="Buscar documento..." style={{ flex: 1 }} />
              <select style={{ width: '150px' }}>
                <option>Todos os tipos</option>
                <option>Petição</option>
                <option>Contrato</option>
                <option>Laudo</option>
              </select>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['Documento', 'Tipo', 'Caso', 'Data', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOCS.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #111', cursor: 'pointer' }} onClick={() => setSelectedDoc(d === selectedDoc ? null : d)}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📄</span>
                        <div>
                          <div style={{ fontSize: '12px', color: '#e0e0e0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                          <div style={{ fontSize: '11px', color: '#444' }}>{d.size}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}><span className="badge-gray">{d.type}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#666' }}>{d.case}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#555' }}>{d.date}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={d.status === 'analisado' ? 'badge-green' : d.status === 'risco' ? 'badge-yellow' : d.status === 'processando' ? 'badge-gold' : 'badge-gray'}>
                        {d.status === 'analisado' ? '✓ Analisado' : d.status === 'risco' ? '⚠ Riscos' : d.status === 'processando' ? '⟳ Processando' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Resumir</button>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Riscos</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Analysis Panel */}
          {selectedDoc && selectedDoc.status !== 'pendente' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#C9A84C' }}>◈ Análise IA</h3>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>{selectedDoc.name}</div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '600' }}>RESUMO</div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#bbb', lineHeight: 1.6 }}>{ANALYSIS.summary}</p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>RISCOS DETECTADOS</div>
                  {ANALYSIS.risks.map((r, i) => (
                    <div key={i} style={{ padding: '8px 10px', marginBottom: '6px', background: r.level === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)', border: `1px solid ${r.level === 'high' ? '#ef444420' : '#eab30820'}`, borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: r.level === 'high' ? '#ef4444' : '#eab308' }}>
                        {r.level === 'high' ? '🔴' : '🟡'} {r.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>DATAS EXTRAÍDAS</div>
                  {ANALYSIS.dates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #111', fontSize: '12px' }}>
                      <span style={{ color: '#666' }}>{d.label}</span>
                      <span style={{ color: '#C9A84C', fontWeight: '500' }}>{d.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
                  <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}>Copiar</button>
                  <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}>Exportar</button>
                  <button className="btn-gold" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}>Chat IA</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
