"use client";
import { useState } from "react";

const MOCK_MESSAGES = [
  { role: "user", content: "Quais são os principais riscos no contrato da TechBrasil?" },
  { role: "ai", content: "Baseado nos documentos do Caso TechBrasil Ltda (Proc. 0009876-54.2026.8.26.0100), identifiquei 3 riscos principais:\n\n**1. Cláusula de não-concorrência (Art. 12):**\nO prazo de 5 anos ultrapassa o limite razoável reconhecido pelo STJ (REsp 1.203.109-MG). Recomendo negociar para no máximo 2 anos.\n\n**2. Foro de eleição (Art. 18):**\nA cláusula estabelece Frankfurt como foro. Em contratos com consumidores ou parte hipossuficiente, o STJ entende que o foro pode ser afastado (Súmula 381).\n\n**3. Multa rescisória (Art. 9, §2):**\nA multa de 30% sobre o valor total do contrato (R$ 890.000) pode ser considerada abusiva. O entendimento do TJ-SP é pelo máximo de 10-20%.", },
  { role: "user", content: "Tem alguma jurisprudência recente sobre não-concorrência?" },
  { role: "ai", content: "Sim. Encontrei 2 decisões recentes relevantes:\n\n**STJ — REsp 2.143.871-SP (2025):**\nA 3ª Turma reafirmou que cláusulas de não-concorrência com prazo superior a 2 anos são nulas por violação à liberdade de trabalho (Art. 5º, XIII, CF/88), salvo quando acompanhadas de compensação financeira adequada.\n\n**TJ-SP — Apelação 1097654-21.2024 (Ago/2025):**\nO Tribunal manteve cláusula de 3 anos, MAS exigiu que o ex-contratado recebesse compensação mensal equivalente a 50% da remuneração durante o período de restrição.\n\n**Recomendação:** Se TechBrasil insistir no prazo longo, exija a compensação financeira. Isso fortalece nossa posição.", },
];

const CONTEXT_DOCS = [
  { name: "Contrato TechBrasil_v3.pdf", status: "ativo", pages: 24 },
  { name: "Aditivo Contratual_v1.pdf", status: "ativo", pages: 6 },
  { name: "Proposta Inicial.pdf", status: "referência", pages: 12 },
];

export default function ChatPage() {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setMessages(prev => [...prev, {
      role: "ai",
      content: `Analisando com base nos documentos do caso TechBrasil...\n\nSobre "${userMsg}":\n\nCom base nos documentos disponíveis e na jurisprudência atual do STJ e TJ-SP, posso confirmar que a questão levantada é relevante. Recomendo verificar o Art. 421 do CC/2002 (função social do contrato) e a interpretação da boa-fé objetiva (Art. 422).\n\nDeseja que eu elabore uma minuta de resposta ou pesquise jurisprudência adicional?`
    }]);
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>
              <span style={{ color: '#C9A84C', marginRight: '8px' }}>◈</span>Chat IA
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Contexto: TechBrasil Ltda · 3 documentos ativos</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-ghost" style={{ fontSize: '12px' }}>Trocar contexto</button>
            <button className="btn-ghost" style={{ fontSize: '12px' }}>Histórico</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Context Panel */}
        <div style={{
          width: '280px', borderRight: '1px solid #1a1a1a', padding: '16px',
          background: '#0d0d0d', overflowY: 'auto', flexShrink: 0
        }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: '600' }}>
            Contexto Ativo
          </div>

          {/* Case */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>CASO</div>
            <div style={{ padding: '10px 12px', background: '#141414', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#C9A84C', fontWeight: '600', marginBottom: '4px' }}>TechBrasil Ltda</div>
              <div style={{ fontSize: '11px', color: '#555' }}>Rescisão contratual</div>
              <div style={{ fontSize: '11px', color: '#555' }}>Proc. 0009876-54.2026</div>
            </div>
          </div>

          {/* Docs */}
          <div>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>DOCUMENTOS NO CONTEXTO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CONTEXT_DOCS.map((d, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#141414', border: '1px solid #1f1f1f', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#ccc' }}>📄 {d.name}</div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>{d.pages} páginas</div>
                  </div>
                  <span className={d.status === 'ativo' ? 'badge-green' : 'badge-gray'}>{d.status}</span>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '8px', fontSize: '11px' }}>+ Adicionar documento</button>
          </div>

          <div style={{ marginTop: '16px', padding: '10px 12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#C9A84C', fontWeight: '600', marginBottom: '4px' }}>Modelo Ativo</div>
            <div style={{ fontSize: '11px', color: '#666' }}>Notorious AI v2.1</div>
            <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>Treinado em direito brasileiro</div>
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                {m.role === 'ai' && (
                  <div style={{
                    width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', color: '#000', fontWeight: '700'
                  }}>N</div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '12px 16px', borderRadius: '10px',
                  background: m.role === 'user' ? 'rgba(201,168,76,0.12)' : '#141414',
                  border: m.role === 'user' ? '1px solid rgba(201,168,76,0.2)' : '1px solid #1f1f1f',
                  fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6',
                  whiteSpace: 'pre-line'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #C9A84C, #8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#000', fontWeight: '700' }}>N</div>
                <div style={{ padding: '12px 16px', background: '#141414', border: '1px solid #1f1f1f', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0,1,2].map(n => (
                      <div key={n} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', animation: `pulse 1.2s ${n*0.4}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Pergunte sobre o caso, documentos, jurisprudência... (Enter para enviar)"
                rows={2} style={{ flex: 1, resize: 'none', lineHeight: '1.5' }}
              />
              <button className="btn-gold" onClick={send} style={{ height: '52px', padding: '0 20px' }}>
                Enviar
              </button>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {["Resumir documentos", "Identificar riscos", "Buscar jurisprudência", "Gerar estratégia"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '4px',
                  padding: '4px 10px', fontSize: '11px', color: '#555', cursor: 'pointer'
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
