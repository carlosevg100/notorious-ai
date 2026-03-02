"use client";
export default function PesquisaPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}><span style={{ color: 'var(--gold)' }}>◎</span> Pesquisa Jurídica</h1>
      </div>
      <div style={{ padding: '60px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', color: 'var(--gold)', opacity: 0.5 }}>◎</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '20px', color: 'var(--text-2)' }}>Em breve</h2>
        <p style={{ color: 'var(--text-4)', margin: 0, fontSize: '14px' }}>Em breve: integração com STF, STJ, TJs e legislação federal.</p>
      </div>
    </div>
  );
}
