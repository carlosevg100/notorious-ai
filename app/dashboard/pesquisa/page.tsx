"use client";
import { useState } from "react";

const RESULTS = [
  {
    tribunal: "STJ", turma: "3ª Turma", tipo: "REsp",
    numero: "2.143.871-SP", data: "14/11/2025",
    relator: "Min. Marco Aurélio Bellizze",
    ementa: "DIREITO DO TRABALHO. CLÁUSULA DE NÃO-CONCORRÊNCIA. VALIDADE. PRAZO. LIMITE RAZOÁVEL. A cláusula de não-concorrência inserida em contrato de trabalho é válida quando acompanhada de contraprestação adequada, limitada geograficamente e com prazo razoável, que a jurisprudência desta Corte tem entendido não superior a 2 (dois) anos.",
    temas: ["Não-concorrência", "Direito do Trabalho", "Liberdade de trabalho"],
    relevancia: 98
  },
  {
    tribunal: "STF", turma: "2ª Turma", tipo: "RE",
    numero: "1.394.102-SP", data: "08/09/2025",
    relator: "Min. Edson Fachin",
    ementa: "DIREITO CONSTITUCIONAL. LIBERDADE DE EXERCÍCIO PROFISSIONAL. ART. 5º, XIII, CF/88. RESTRIÇÃO POR CLÁUSULA CONTRATUAL. PROPORCIONALIDADE. A restrição ao livre exercício profissional mediante cláusula contratual é constitucional desde que observados os princípios da proporcionalidade e razoabilidade, com previsão de compensação financeira ao trabalhador durante o período restritivo.",
    temas: ["Liberdade profissional", "Constitucional", "Proporcionalidade"],
    relevancia: 91
  },
  {
    tribunal: "TJ-SP", turma: "28ª Câmara de Direito Privado", tipo: "Apelação",
    numero: "1097654-21.2024.8.26.0100", data: "22/08/2025",
    relator: "Des. Dirceu Raposo",
    ementa: "CONTRATO DE TRABALHO. CLÁUSULA DE NÃO-CONCORRÊNCIA. PRAZO DE TRÊS ANOS. VALIDADE CONDICIONADA. É válida a cláusula de não-concorrência pelo prazo de três anos, desde que o ex-empregador pague ao ex-empregado compensação mensal equivalente a, no mínimo, 50% (cinquenta por cento) da última remuneração durante todo o período de restrição.",
    temas: ["Não-concorrência", "Compensação", "Cível"],
    relevancia: 87
  },
  {
    tribunal: "TST", turma: "7ª Turma", tipo: "RR",
    numero: "1000123-44.2024.5.02.0001", data: "15/07/2025",
    relator: "Min. Evandro Pereira Valadão Lopes",
    ementa: "DANOS MORAIS. DISPENSA DISCRIMINATÓRIA. EMPREGADO COM DOENÇA OCUPACIONAL. SÚMULA 443 DO TST. A dispensa de empregado portador de doença que, embora não contagiosa, suscita estigma ou preconceito, é presumidamente discriminatória, cabendo ao empregador afastar tal presunção mediante prova robusta de motivo legítimo para a rescisão.",
    temas: ["Danos morais", "Dispensa discriminatória", "Doença ocupacional"],
    relevancia: 82
  },
];

export default function PesquisaPage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setSearched(true);
    setLoading(false);
  };

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          <span style={{ color: 'var(--gold)', marginRight: '8px' }}>◎</span>Pesquisa Jurídica
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>Jurisprudência STF, STJ, TST, TJs em linguagem natural</p>
      </div>

      <div style={{ padding: '32px 28px' }}>
        {/* Search */}
        <form onSubmit={search} style={{ marginBottom: '32px' }}>
          <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-4)' }}>◎</div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Ex: "validade cláusula não-concorrência prazo máximo"'
              style={{ paddingLeft: '44px', paddingRight: '120px', height: '52px', fontSize: '14px', borderRadius: '10px', border: '1px solid var(--border-2)' }}
            />
            <button type="submit" className="btn-gold" style={{ position: 'absolute', right: '8px', top: '8px', height: '36px', padding: '0 20px' }}>
              Buscar
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
            {["STF", "STJ", "TST", "TJ-SP", "TRF", "Todas as cortes"].map(t => (
              <button key={t} type="button" style={{
                padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border-2)',
                background: 'transparent', color: 'var(--text-4)', fontSize: '12px', cursor: 'pointer'
              }}>{t}</button>
            ))}
          </div>
        </form>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #1f1f1f', borderTop: '3px solid #C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--gold)', fontWeight: '600', marginBottom: '6px' }}>Pesquisando jurisprudência...</div>
            <div style={{ color: 'var(--text-4)', fontSize: '12px' }}>Consultando STF, STJ, TST e TJs</div>
          </div>
        )}

        {searched && !loading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: '600' }}>4 decisões</span> encontradas para "{query || 'cláusula de não-concorrência validade'}"
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select style={{ width: 'auto', padding: '6px 10px' }}>
                  <option>Mais relevante</option>
                  <option>Mais recente</option>
                  <option>Por tribunal</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {RESULTS.map((r, i) => (
                <div key={i} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        background: r.tribunal === 'STF' ? 'rgba(139,92,246,0.15)' : r.tribunal === 'STJ' ? 'rgba(59,130,246,0.15)' : r.tribunal === 'TST' ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.15)',
                        color: r.tribunal === 'STF' ? '#8b5cf6' : r.tribunal === 'STJ' ? '#3b82f6' : r.tribunal === 'TST' ? '#22c55e' : '#C9A84C',
                        padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700'
                      }}>{r.tribunal}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{r.tipo} {r.numero}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>· {r.turma}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                        borderRadius: '4px', padding: '3px 8px'
                      }}>
                        <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: '600' }}>{r.relevancia}% relevante</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>Rel. {r.relator} · {r.data}</span>
                  </div>

                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#bbb', lineHeight: 1.7 }}>
                    {expanded === i ? r.ementa : r.ementa.substring(0, 220) + '...'}
                  </p>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {r.temas.map(t => (
                      <span key={t} className="badge-gray">{t}</span>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setExpanded(expanded === i ? null : i)}>
                        {expanded === i ? 'Ver menos' : 'Ver decisão completa'}
                      </button>
                      <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }}>Usar no Chat IA</button>
                      <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }}>Salvar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!searched && !loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-5)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#222' }}>◎</div>
            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-4)' }}>Pesquise em linguagem natural</div>
            <div style={{ fontSize: '13px', marginBottom: '24px' }}>Ex: "Rescisão indireta por falta de pagamento de salários por mais de 3 meses"</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {["Não-concorrência prazo máximo", "Rescisão indireta TST", "Dano moral dispensa discriminatória", "Juros contratuais abusivos"].map(s => (
                <button key={s} onClick={() => { setQuery(s); }} style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: '6px',
                  padding: '8px 14px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
