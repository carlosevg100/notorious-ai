"use client";
import { useState } from "react";

interface JurResult {
  tribunal: string;
  numero_processo: string;
  data: string;
  relator: string;
  ementa: string;
  link?: string;
  source: string;
}

// ─── Tribunal sources ──────────────────────────────────────────────────────
async function searchTST(query: string): Promise<JurResult[]> {
  const res = await fetch(
    `https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual/1/8?a=${Math.random()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://jurisprudencia.tst.jus.br/', 'Origin': 'https://jurisprudencia.tst.jus.br' },
      body: JSON.stringify({ ou: '', e: query, termoExato: '', naoContem: '', ementa: '', dispositivo: '', numeracaoUnica: null }),
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!res.ok) return [];
  const raw = await res.json();
  const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (raw?.registros || []).map((item: any) => {
    const r = item?.registro || item;
    return {
      tribunal: r.orgao?.sigla || 'TST',
      numero_processo: r.numFormatado || '',
      data: r.dtaJulgamento ? new Date(r.dtaJulgamento).toLocaleDateString('pt-BR') : '',
      relator: r.nomRelator ? r.nomRelator.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '',
      ementa: strip(r.ementaHtml || r.ementa || r.txtEmentaHighlight || ''),
      link: r.numProcInt && r.anoProcInt ? `https://consultadocumento.tst.jus.br/consultaDocumento/acordao.do?anoProcInt=${r.anoProcInt}&numProcInt=${r.numProcInt}` : '',
      source: 'TST',
    };
  }).filter((r: JurResult) => r.ementa.length > 20);
}

async function searchSTF(query: string): Promise<JurResult[]> {
  const url = `https://jurisprudencia.stf.jus.br/api/search/search?query=${encodeURIComponent(query)}&page=1&pageSize=8`;
  const res = await fetch(url, {
    headers: { 'Referer': 'https://jurisprudencia.stf.jus.br/', 'Origin': 'https://jurisprudencia.stf.jus.br' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const raw = await res.json();
  const hits = raw?.result?.hits?.hits || raw?.hits?.hits || [];
  return hits.map((h: any) => {
    const s = h._source || h;
    return {
      tribunal: 'STF',
      numero_processo: s.numeroProcesso || s.numero_processo || s.id || '',
      data: s.dataJulgamento ? new Date(s.dataJulgamento).toLocaleDateString('pt-BR') : (s.data_julgamento ? new Date(s.data_julgamento).toLocaleDateString('pt-BR') : ''),
      relator: s.nomeRelator || s.relator || '',
      ementa: (s.ementa || s.ementaHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      link: s.id ? `https://jurisprudencia.stf.jus.br/pages/search/decisao${s.id}/false` : '',
      source: 'STF',
    };
  }).filter((r: JurResult) => r.ementa.length > 20);
}

async function searchSTJ(query: string): Promise<JurResult[]> {
  const url = `/api/pesquisa-stj?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// ─── Color map ─────────────────────────────────────────────────────────────
const tribunalColor: Record<string, string> = {
  STF: '#7c3aed', STJ: '#2563eb', TST: '#0891b2',
  TRF: '#059669', TRT: '#0d9488', TJ: '#d97706', IA: '#C9A84C',
};
function getTColor(t: string) {
  for (const k of Object.keys(tribunalColor)) if (t.startsWith(k) || t.includes(k)) return tribunalColor[k];
  return '#888';
}

// ─── Filters ───────────────────────────────────────────────────────────────
const COURTS = [
  { key: 'todos', label: 'Todos' },
  { key: 'STF', label: 'STF' },
  { key: 'STJ', label: 'STJ' },
  { key: 'TST', label: 'TST' },
];

export default function PesquisaPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JurResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCourts, setLoadingCourts] = useState<string[]>([]);
  const [filterCourt, setFilterCourt] = useState('todos');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [totalMap, setTotalMap] = useState<Record<string, number>>({});

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setSearched(true);
    setExpanded(null);
    setTotalMap({});
    setLoadingCourts(['STF', 'STJ', 'TST']);

    // fire all in parallel, merge as they arrive
    const all: JurResult[] = [];

    const runners = [
      searchTST(query).then(r => { setLoadingCourts(p => p.filter(c => c !== 'TST')); return r; }).catch(() => [] as JurResult[]),
      searchSTF(query).then(r => { setLoadingCourts(p => p.filter(c => c !== 'STF')); return r; }).catch(() => [] as JurResult[]),
      searchSTJ(query).then(r => { setLoadingCourts(p => p.filter(c => c !== 'STJ')); return r; }).catch(() => [] as JurResult[]),
    ];

    const settled = await Promise.allSettled(runners);
    settled.forEach(s => {
      if (s.status === 'fulfilled') all.push(...s.value);
    });

    const tm: Record<string, number> = {};
    all.forEach(r => { tm[r.tribunal] = (tm[r.tribunal] || 0) + 1; });
    setTotalMap(tm);
    setResults(all);
    setLoadingCourts([]);
    setLoading(false);
  };

  const visible = filterCourt === 'todos' ? results : results.filter(r => r.tribunal.startsWith(filterCourt) || r.tribunal === filterCourt);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
          <span style={{ color: 'var(--gold)' }}>◎</span> Pesquisa Jurídica
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
          STF · STJ · TST — acórdãos reais das bases oficiais
        </p>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '960px' }}>

        {/* Search bar */}
        <form onSubmit={search} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ex: prescrição, responsabilidade civil, FGTS, súmula vinculante, NDA..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-gold" disabled={loading} style={{ padding: '10px 24px', whiteSpace: 'nowrap' }}>
            {loading ? 'Buscando...' : '◎ Buscar'}
          </button>
        </form>

        {/* Court filters */}
        {searched && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            {COURTS.map(c => {
              const count = c.key === 'todos' ? results.length : Object.entries(totalMap).filter(([k]) => k.startsWith(c.key)).reduce((a,[,v]) => a+v, 0);
              const isLoading = c.key !== 'todos' && loadingCourts.includes(c.key);
              return (
                <button key={c.key} onClick={() => setFilterCourt(c.key)} style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  background: filterCourt === c.key ? getTColor(c.key === 'todos' ? 'IA' : c.key) : 'var(--bg-3)',
                  color: filterCourt === c.key ? '#fff' : 'var(--text-4)',
                  border: `1px solid ${filterCourt === c.key ? getTColor(c.key === 'todos' ? 'IA' : c.key) : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {c.label}
                  {isLoading
                    ? <span style={{ width: '10px', height: '10px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : count > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>({count})</span>
                  }
                </button>
              );
            })}
            {results.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-5)', marginLeft: '4px' }}>
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-4)' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>Consultando STF, STJ e TST simultaneamente...</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {['STF','STJ','TST'].map(c => (
                <span key={c} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: getTColor(c)+'20', color: getTColor(c), border: `1px solid ${getTColor(c)}40` }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-3)' }}>Nenhum resultado para "{query}"</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Tente termos mais específicos ou verifique a conectividade</p>
          </div>
        )}

        {/* Results */}
        {!loading && visible.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visible.map((r, i) => {
              const isExp = expanded === i;
              const ementa = r.ementa || '';
              const short = ementa.length > 340 ? ementa.substring(0, 340) + '…' : ementa;
              const color = getTColor(r.tribunal);
              return (
                <div key={i} className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '4px', background: color+'20', color, border: `1px solid ${color}40`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {r.tribunal}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>{r.numero_processo}</div>
                      <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-5)', flexWrap: 'wrap' }}>
                        {r.data && <span>📅 {r.data}</span>}
                        {r.relator && <span>👤 {r.relator}</span>}
                      </div>
                    </div>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid var(--gold-border)', padding: '3px 10px', borderRadius: '4px' }}>
                        Ver ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.7' }}>
                    {isExp ? ementa : short}
                  </div>
                  {ementa.length > 340 && (
                    <button onClick={() => setExpanded(isExp ? null : i)} style={{ marginTop: '8px', fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '600' }}>
                      {isExp ? '▲ ver menos' : '▼ ver mais'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!searched && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--gold)', opacity: 0.4 }}>◎</div>
            <p style={{ fontSize: '15px', margin: '0 0 8px', color: 'var(--text-3)', fontWeight: '600' }}>Pesquisa Jurídica Multi-Tribunal</p>
            <p style={{ fontSize: '13px', margin: '0 0 20px' }}>Busca simultânea em STF, STJ e TST</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { tribunal: 'STF', desc: 'Supremo Tribunal Federal', color: '#7c3aed' },
                { tribunal: 'STJ', desc: 'Superior Tribunal de Justiça', color: '#2563eb' },
                { tribunal: 'TST', desc: 'Tribunal Superior do Trabalho', color: '#0891b2' },
              ].map(t => (
                <div key={t.tribunal} style={{ padding: '12px 18px', background: t.color+'10', border: `1px solid ${t.color}30`, borderRadius: '10px', textAlign: 'center', minWidth: '160px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: t.color, marginBottom: '4px' }}>{t.tribunal}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-5)' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
