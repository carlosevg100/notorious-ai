"use client";
import { useState } from "react";

interface JurResult {
  tribunal: string;
  numero_processo: string;
  data: string;
  relator: string;
  ementa: string;
  source: string;
}

export default function PesquisaPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JurResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setSource('');
    setSearched(true);
    setExpanded(null);
    try {
      const res = await fetch(`/api/pesquisa?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSource(data.source || '');
      }
    } catch (_) {}
    setLoading(false);
  };

  const tribunalColor: Record<string, string> = {
    STF: '#7c3aed', STJ: '#2563eb', TST: '#0891b2',
    TRF1: '#059669', TRF2: '#059669', TRF3: '#059669', TRF4: '#059669', TRF5: '#059669',
    TJSP: '#d97706', TJRJ: '#d97706', IA: '#C9A84C'
  };

  const getTribunalColor = (tribunal: string) => {
    for (const key of Object.keys(tribunalColor)) {
      if (tribunal.includes(key)) return tribunalColor[key];
    }
    return '#888';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          <span style={{ color: 'var(--gold)' }}>◎</span> Pesquisa Jurídica
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)', marginTop: '2px' }}>
          STF · STJ · TST · TRFs · TJs — com fallback por IA
        </p>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
        <form onSubmit={search} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ex: rescisão indireta, prescrição trabalhista, FGTS..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-gold" disabled={loading} style={{ padding: '10px 24px' }}>
            {loading ? 'Buscando...' : '◎ Buscar'}
          </button>
        </form>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-4)' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '13px' }}>Consultando jurisprudência...</div>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
            <p style={{ margin: 0 }}>Nenhum resultado encontrado para "{query}"</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
              {source === 'IA' && (
                <span style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '4px', color: 'var(--gold)', fontWeight: '600' }}>
                  Resultado via IA
                </span>
              )}
              {source === 'STF' && (
                <span style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '4px', color: '#7c3aed', fontWeight: '600' }}>
                  Via API STF
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.map((r, i) => {
                const isExp = expanded === i;
                const ementa = r.ementa || '';
                const shortEmenta = ementa.length > 300 ? ementa.substring(0, 300) + '...' : ementa;
                return (
                  <div key={i} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                        background: getTribunalColor(r.tribunal) + '20',
                        color: getTribunalColor(r.tribunal),
                        border: `1px solid ${getTribunalColor(r.tribunal)}40`,
                        whiteSpace: 'nowrap'
                      }}>{r.tribunal}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>
                          {r.numero_processo}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-5)' }}>
                          {r.data && <span>📅 {r.data}</span>}
                          {r.relator && <span>👤 {r.relator}</span>}
                          {r.source === 'IA' && <span style={{ color: 'var(--gold)' }}>✦ IA</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.7' }}>
                      {isExp ? ementa : shortEmenta}
                    </div>
                    {ementa.length > 300 && (
                      <button onClick={() => setExpanded(isExp ? null : i)}
                        style={{ marginTop: '8px', fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontWeight: '600' }}>
                        {isExp ? '▲ ver menos' : '▼ ver mais'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!searched && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--gold)', opacity: 0.5 }}>◎</div>
            <p style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--text-3)' }}>Pesquisa Jurídica</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Busque por temas, súmulas, teses ou termos jurídicos</p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
