"use client";
import { useState } from "react";

const PETITION_TYPES = ["Petição Inicial", "Contestação", "Recurso", "Contrarrazões", "Agravo", "Mandado de Segurança", "Habeas Corpus", "Recurso Ordinário", "Agravo de Instrumento", "Recurso Especial", "Embargos de Declaração", "Apelação Cível", "Parecer Jurídico"];

export default function ElaboracaoPage() {
  const [form, setForm] = useState({ tipo: 'Petição Inicial', partes: '', fatos: '', fundamentacao: '' });
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDraft('');
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.tipo,
          parties: form.partes,
          facts: form.fatos,
          legal_basis: form.fundamentacao
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao gerar peça');
      }
      const data = await res.json();
      setDraft(data.draft);
      setTitle(data.title);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          <span style={{ color: 'var(--gold)', marginRight: '8px' }}>✦</span>Elaboração
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>Geração de peças processuais com IA — GPT-4o</p>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* Form */}
        <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '13px', fontWeight: '600' }}>Configurar Peça</h3>
          <form onSubmit={generate}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Tipo de Peça *
              </label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required
                style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}>
                {PETITION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Partes Envolvidas
              </label>
              <input value={form.partes} onChange={e => setForm({...form, partes: e.target.value})}
                placeholder="Ex: Autor: João Silva; Réu: Empresa ABC Ltda" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Fatos Relevantes *
              </label>
              <textarea value={form.fatos} onChange={e => setForm({...form, fatos: e.target.value})}
                placeholder="Descreva os fatos principais do caso, datas importantes, documentos existentes..."
                rows={5} required
                style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Fundamentação Jurídica
              </label>
              <textarea value={form.fundamentacao} onChange={e => setForm({...form, fundamentacao: e.target.value})}
                placeholder="Ex: Art. 7º, I da CF; Súmula 443 do TST; jurisprudência relevante..."
                rows={3}
                style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <button type="submit" className="btn-gold" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '13px' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={{ width: '14px', height: '14px', border: '2px solid #00000040', borderTop: '2px solid #000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Gerando com IA...
                </span>
              ) : '✦ Gerar com IA'}
            </button>
          </form>
        </div>

        {/* Result */}
        <div className="card" style={{ padding: '20px' }}>
          {!draft && !loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-5)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✦</div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-3)' }}>Pronto para gerar</div>
              <div style={{ fontSize: '13px', color: 'var(--text-5)' }}>Preencha o formulário e clique em Gerar com IA</div>
            </div>
          )}
          {error && (
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444430', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
              ✗ {error}
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #1f1f1f', borderTop: '3px solid #C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
              <div style={{ fontSize: '14px', color: 'var(--gold)', fontWeight: '600', marginBottom: '6px' }}>Gerando peça processual...</div>
              <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>GPT-4o analisando jurisprudência e redigindo</div>
            </div>
          )}
          {draft && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--gold)' }}>✓ Peça gerada com sucesso</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>{title}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-ghost" onClick={copy} style={{ fontSize: '12px' }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '20px', overflowY: 'auto', maxHeight: '600px' }}>
                <pre style={{ margin: 0, fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{draft}</pre>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
