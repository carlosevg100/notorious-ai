"use client";
import { useState } from "react";

const DRAFT = `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 2ª VARA DO TRABALHO DE SÃO PAULO - SP

PROCESSO Nº 0001234-56.2026.5.02.0001

JOÃO CARLOS SILVA, brasileiro, solteiro, metalúrgico, portador do RG nº 12.345.678-9 SSP/SP e CPF nº 123.456.789-00, residente e domiciliado na Rua das Acácias, 123, Bairro Ipiranga, São Paulo/SP, CEP 04211-000, por seu advogado subscritor (instrumento de mandato anexo), vem, respeitosamente, à presença de Vossa Excelência, apresentar:

CONTESTAÇÃO

em face da reconvenção apresentada por METALÚRGICA ABC INDÚSTRIA E COMÉRCIO LTDA, pessoa jurídica de direito privado, inscrita no CNPJ nº 12.345.678/0001-99, pelos fatos e fundamentos jurídicos a seguir expostos:

I - DOS FATOS

O Reclamante trabalhou para a Reclamada por período de 8 (oito) anos e 3 (três) meses, tendo sido dispensado sem justa causa em 15 de janeiro de 2026, conforme TRCT devidamente assinado.

A Reclamada ora busca, em sede reconvencional, imputar ao Reclamante suposta quebra de sigilo industrial, tese esta completamente desprovida de amparo probatório.

II - DO DIREITO

Conforme entendimento consolidado do C. TST (Súmula 443), presume-se discriminatória a despensa do empregado portador de doença grave. In casu, o Reclamante encontrava-se em acompanhamento médico por síndrome do túnel do carpo, patologia diretamente relacionada ao trabalho exercido.

[...]

Ante o exposto, requer o Reclamante:
a) O total indeferimento da reconvenção, por ausência de provas;
b) A condenação da Reclamada em honorários advocatícios de 20%;
c) Demais cominações legais.

Termos em que, pede deferimento.

São Paulo, 03 de março de 2026.

________________________
Dr. Cristiano Galves
OAB/SP 123.456`;

export default function ElaboracaoPage() {
  const [form, setForm] = useState({ tipo: '', area: '', posicao: '', dados: '' });
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 2200));
    setGenerated(true);
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(DRAFT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          <span style={{ color: 'var(--gold)', marginRight: '8px' }}>✦</span>Elaboração
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>Geração de peças processuais com IA</p>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* Form */}
        <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '13px', fontWeight: '600' }}>Configurar Geração</h3>
          <form onSubmit={generate}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Tipo de Documento
              </label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required>
                <option value="">Selecionar...</option>
                <option>Contestação</option>
                <option>Petição Inicial</option>
                <option>Recurso Ordinário</option>
                <option>Agravo de Instrumento</option>
                <option>Recurso Especial</option>
                <option>Habeas Corpus</option>
                <option>Mandado de Segurança</option>
                <option>Embargos de Declaração</option>
                <option>Apelação Cível</option>
                <option>Contrarrazões</option>
                <option>Minuta de Contrato</option>
                <option>Parecer Jurídico</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Área do Direito
              </label>
              <select value={form.area} onChange={e => setForm({...form, area: e.target.value})} required>
                <option value="">Selecionar...</option>
                <option>Direito do Trabalho</option>
                <option>Direito Civil</option>
                <option>Direito Tributário</option>
                <option>Direito Empresarial</option>
                <option>Direito Constitucional</option>
                <option>Direito Administrativo</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Posição do Cliente
              </label>
              <select value={form.posicao} onChange={e => setForm({...form, posicao: e.target.value})} required>
                <option value="">Selecionar...</option>
                <option>Autor / Reclamante</option>
                <option>Réu / Reclamado</option>
                <option>Impetrante</option>
                <option>Impetrado</option>
                <option>Apelante</option>
                <option>Apelado</option>
                <option>Consulente</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Dados Relevantes do Caso
              </label>
              <textarea
                value={form.dados}
                onChange={e => setForm({...form, dados: e.target.value})}
                placeholder="Ex: Empregado dispensado sem justa causa após 8 anos. Existência de doença ocupacional (LER). TRCT assinado em 15/01/2026. Reconvenção apresentada pela empresa alegando quebra de sigilo."
                rows={5} required
              />
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
          {!generated && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-5)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✦</div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-3)' }}>Pronto para gerar</div>
              <div style={{ fontSize: '13px', color: 'var(--text-5)' }}>Preencha o formulário e clique em Gerar com IA</div>
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #1f1f1f', borderTop: '3px solid #C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
              <div style={{ fontSize: '14px', color: 'var(--gold)', fontWeight: '600', marginBottom: '6px' }}>Gerando peça processual...</div>
              <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>Analisando jurisprudência e precedentes</div>
            </div>
          )}
          {generated && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--gold)' }}>✓ Peça gerada com sucesso</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>Contestação · Direito do Trabalho · 847 palavras</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-ghost" onClick={copy} style={{ fontSize: '12px' }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
                  <button className="btn-ghost" style={{ fontSize: '12px' }}>Exportar DOCX</button>
                  <button className="btn-gold" style={{ fontSize: '12px' }}>Editar</button>
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '20px', overflowY: 'auto', maxHeight: '500px' }}>
                <pre style={{ margin: 0, fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{DRAFT}</pre>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
