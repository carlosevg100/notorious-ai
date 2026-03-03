"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Client { id: string; name: string; type: string; }

type Mode = 'escolha' | 'manual' | 'upload';

export default function NovoProcesso() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('escolha');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);

  // Form fields
  const [form, setForm] = useState({
    client_id: '',
    numero_processo: '',
    tribunal: '',
    comarca: '',
    vara: '',
    juiz: '',
    classe_processual: '',
    assunto: '',
    valor_causa: '',
    polo_ativo_nome: '',
    polo_ativo_cpf: '',
    polo_ativo_advogado: '',
    polo_ativo_oab: '',
    polo_passivo_nome: '',
    polo_passivo_cpf: '',
    tutela_urgencia: false,
    risco: 'medio',
    fatos_resumidos: '',
    prazo_contestacao: '',
  });

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  function setField(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function applyExtracted(data: Record<string, unknown>) {
    setExtracted(data);
    const pa = (data.polo_ativo as any) || {};
    const pp = (data.polo_passivo as any) || {};
    setForm(prev => ({
      ...prev,
      numero_processo: String(data.numero_processo || prev.numero_processo),
      tribunal: String(data.tribunal || prev.tribunal),
      comarca: String(data.comarca || prev.comarca),
      vara: String(data.vara || prev.vara),
      juiz: String(data.juiz || prev.juiz),
      classe_processual: String(data.classe_processual || prev.classe_processual),
      assunto: String(data.assunto || prev.assunto),
      valor_causa: data.valor_causa ? String(data.valor_causa) : prev.valor_causa,
      polo_ativo_nome: pa.nome || prev.polo_ativo_nome,
      polo_ativo_cpf: pa.cpf_cnpj || prev.polo_ativo_cpf,
      polo_ativo_advogado: pa.advogado || prev.polo_ativo_advogado,
      polo_ativo_oab: pa.oab || prev.polo_ativo_oab,
      polo_passivo_nome: pp.nome || prev.polo_passivo_nome,
      polo_passivo_cpf: pp.cpf_cnpj || prev.polo_passivo_cpf,
      fatos_resumidos: String(data.fatos_resumidos || prev.fatos_resumidos),
      prazo_contestacao: String(data.prazo_contestacao || prev.prazo_contestacao),
    }));
    setMode('manual');
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await fetch('/api/processos/temp/extrair', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        applyExtracted(data);
      } else {
        alert('Erro ao extrair dados do documento. Tente novamente.');
      }
    } catch {
      alert('Erro ao processar arquivo.');
    }
    setExtracting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        client_id: form.client_id || null,
        numero_processo: form.numero_processo || null,
        tribunal: form.tribunal || null,
        comarca: form.comarca || null,
        vara: form.vara || null,
        juiz: form.juiz || null,
        classe_processual: form.classe_processual || null,
        assunto: form.assunto || null,
        valor_causa: form.valor_causa ? Number(form.valor_causa) : null,
        polo_ativo: {
          nome: form.polo_ativo_nome,
          cpf_cnpj: form.polo_ativo_cpf,
          advogado: form.polo_ativo_advogado,
          oab: form.polo_ativo_oab,
        },
        polo_passivo: {
          nome: form.polo_passivo_nome,
          cpf_cnpj: form.polo_passivo_cpf,
        },
        tutela_urgencia: form.tutela_urgencia,
        risco: form.risco,
        fatos_resumidos: form.fatos_resumidos || null,
        prazo_contestacao: form.prazo_contestacao || null,
        fase: 'recebido',
        // From extraction
        pedidos: extracted ? (extracted.pedidos as string[]) : [],
        fundamentos_juridicos: extracted ? (extracted.fundamentos_juridicos as string[]) : [],
        documentos_mencionados: extracted ? (extracted.documentos_mencionados as string[]) : [],
        resumo_executivo: extracted ? String(extracted.resumo_executivo || '') : null,
        causa_pedir: extracted ? String(extracted.causa_pedir || '') : null,
      };

      const res = await fetch('/api/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const p = await res.json();
        router.push(`/dashboard/processos/${p.id}`);
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error || 'Falha ao criar processo'}`);
      }
    } catch {
      alert('Erro ao criar processo.');
    }
    setLoading(false);
  }

  const labelStyle: React.CSSProperties = { fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' };
  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' };
  const sectionHeader: React.CSSProperties = { fontSize: '11px', fontWeight: '700', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* HEADER */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: '18px' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Novo Processo</h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
            {mode === 'escolha' ? 'Selecione como deseja cadastrar' : mode === 'upload' ? 'Upload da petição inicial' : 'Preencha os dados do processo'}
          </p>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '800px' }}>

        {/* STEP 0: Escolha */}
        {mode === 'escolha' && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '24px' }}>Como deseja cadastrar o processo?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px' }}>
              <button onClick={() => setMode('upload')} style={{ padding: '28px 20px', background: 'var(--bg-3)', border: '1px solid var(--gold-border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gold-border)')}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>Upload da Petição</div>
                <div style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: '1.5' }}>Faça upload do PDF/DOCX da petição inicial. A IA extrai todos os dados automaticamente.</div>
                <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: '700', color: 'var(--gold)' }}>RECOMENDADO →</div>
              </button>
              <button onClick={() => setMode('manual')} style={{ padding: '28px 20px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✏️</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>Cadastro Manual</div>
                <div style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: '1.5' }}>Preencha os campos manualmente com os dados do processo.</div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Upload */}
        {mode === 'upload' && (
          <div className="card" style={{ padding: '28px' }}>
            <div style={sectionHeader}>Upload da Petição Inicial</div>
            <div
              style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', background: uploadFile ? 'rgba(201,168,76,0.05)' : 'transparent', borderColor: uploadFile ? 'var(--gold)' : 'var(--border)' }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--gold)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = uploadFile ? 'var(--gold)' : 'var(--border)'; }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input id="file-input" type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{uploadFile ? '📄' : '⬆'}</div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-2)' }}>
                {uploadFile ? uploadFile.name : 'Clique ou arraste o arquivo aqui'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>PDF, DOCX ou TXT — petição inicial</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setMode('escolha')} className="btn-ghost">← Voltar</button>
              <button onClick={handleUpload} disabled={!uploadFile || extracting} className="btn-gold" style={{ flex: 1, justifyContent: 'center' }}>
                {extracting ? 'Extraindo dados com IA...' : 'Extrair Dados →'}
              </button>
            </div>
            {extracting && (
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-4)' }}>
                Analisando documento com GPT-4o-mini... aguarde alguns segundos.
              </p>
            )}
          </div>
        )}

        {/* STEP 2: Form */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit}>
            {extracted && (
              <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>
                ✓ Dados extraídos automaticamente da petição inicial. Revise antes de salvar.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Seção: Identificação */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={sectionHeader}>Identificação do Processo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Número do Processo (CNJ)</label>
                    <input style={inputStyle} value={form.numero_processo} onChange={e => setField('numero_processo', e.target.value)} placeholder="1234567-89.2024.8.26.0100" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tribunal</label>
                    <input style={inputStyle} value={form.tribunal} onChange={e => setField('tribunal', e.target.value)} placeholder="TJSP, TRT, STJ..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Comarca</label>
                    <input style={inputStyle} value={form.comarca} onChange={e => setField('comarca', e.target.value)} placeholder="São Paulo" />
                  </div>
                  <div>
                    <label style={labelStyle}>Vara</label>
                    <input style={inputStyle} value={form.vara} onChange={e => setField('vara', e.target.value)} placeholder="15ª Vara Cível" />
                  </div>
                  <div>
                    <label style={labelStyle}>Juiz</label>
                    <input style={inputStyle} value={form.juiz} onChange={e => setField('juiz', e.target.value)} placeholder="Dr. Roberto Costa" />
                  </div>
                  <div>
                    <label style={labelStyle}>Classe Processual</label>
                    <input style={inputStyle} value={form.classe_processual} onChange={e => setField('classe_processual', e.target.value)} placeholder="Procedimento Comum Cível" />
                  </div>
                  <div>
                    <label style={labelStyle}>Assunto</label>
                    <input style={inputStyle} value={form.assunto} onChange={e => setField('assunto', e.target.value)} placeholder="Indenização por Danos Morais" />
                  </div>
                </div>
              </div>

              {/* Seção: Partes */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={sectionHeader}>Partes do Processo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#ef4444' }}>Polo Ativo (Autor)</label>
                    <input style={inputStyle} value={form.polo_ativo_nome} onChange={e => setField('polo_ativo_nome', e.target.value)} placeholder="Nome do autor" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#ef4444' }}>CPF/CNPJ (Autor)</label>
                    <input style={inputStyle} value={form.polo_ativo_cpf} onChange={e => setField('polo_ativo_cpf', e.target.value)} placeholder="123.456.789-00" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#ef4444' }}>Advogado (Autor)</label>
                    <input style={inputStyle} value={form.polo_ativo_advogado} onChange={e => setField('polo_ativo_advogado', e.target.value)} placeholder="Dr. Paulo Mendes" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#ef4444' }}>OAB (Autor)</label>
                    <input style={inputStyle} value={form.polo_ativo_oab} onChange={e => setField('polo_ativo_oab', e.target.value)} placeholder="OAB/SP 45.231" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'var(--gold)' }}>Polo Passivo / Réu (nosso cliente)</label>
                    <input style={inputStyle} value={form.polo_passivo_nome} onChange={e => setField('polo_passivo_nome', e.target.value)} placeholder="Nome do réu" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'var(--gold)' }}>CPF/CNPJ (Réu)</label>
                    <input style={inputStyle} value={form.polo_passivo_cpf} onChange={e => setField('polo_passivo_cpf', e.target.value)} placeholder="33.000.167/0001-01" />
                  </div>
                </div>
              </div>

              {/* Seção: Valores e Prazos */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={sectionHeader}>Valores, Prazos e Classificação</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Valor da Causa (R$)</label>
                    <input type="number" style={inputStyle} value={form.valor_causa} onChange={e => setField('valor_causa', e.target.value)} placeholder="285000" />
                  </div>
                  <div>
                    <label style={labelStyle}>Prazo de Contestação</label>
                    <input type="date" style={inputStyle} value={form.prazo_contestacao} onChange={e => setField('prazo_contestacao', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Classificação de Risco</label>
                    <select style={inputStyle} value={form.risco} onChange={e => setField('risco', e.target.value)}>
                      <option value="baixo">Baixo</option>
                      <option value="medio">Médio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cliente (Polo Passivo)</label>
                    <select style={inputStyle} value={form.client_id} onChange={e => setField('client_id', e.target.value)}>
                      <option value="">Selecionar cliente cadastrado...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" id="tutela" checked={form.tutela_urgencia} onChange={e => setField('tutela_urgencia', e.target.checked)} style={{ width: 'auto', accentColor: 'var(--gold)' }} />
                    <label htmlFor="tutela" style={{ fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Há pedido de tutela de urgência</label>
                  </div>
                </div>
              </div>

              {/* Seção: Fatos */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={sectionHeader}>Resumo dos Fatos</div>
                <textarea
                  style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: '1.5' }}
                  value={form.fatos_resumidos}
                  onChange={e => setField('fatos_resumidos', e.target.value)}
                  placeholder="Resumo dos fatos alegados pelo autor..."
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setMode(extracted ? 'upload' : 'escolha')} className="btn-ghost">
                  ← Voltar
                </button>
                <button type="submit" disabled={loading} className="btn-gold" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
                  {loading ? 'Criando processo...' : 'Criar Processo →'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
