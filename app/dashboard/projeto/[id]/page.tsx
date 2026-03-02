"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Extraction {
  doc_type: string; parties: string[]; key_dates: any[];
  deadlines: any[]; risk_flags: any[]; summary: string;
}
interface Document {
  id: string; name: string; file_path: string; file_type: string;
  ai_status: string; created_at: string;
  document_extractions?: Extraction[];
}
interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  documents: Document[];
}
interface ChatMsg { id: string; role: string; content: string; created_at: string; }

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<'docs' | 'chat' | 'draft'>('docs');
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [draftType, setDraftType] = useState("Petição Inicial");
  const [draftPosition, setDraftPosition] = useState("");
  const [draftFacts, setDraftFacts] = useState("");
  const [draftResult, setDraftResult] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => { if (tab === 'chat') { loadChat(); } }, [tab, id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
    else router.push('/dashboard');
    setLoading(false);
  }

  async function loadChat() {
    const res = await fetch(`/api/chat?project_id=${id}`);
    if (res.ok) setChatMessages(await res.json());
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [id]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      setUploadProgress(10);
      const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
      if (!allowed.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc') && !file.name.endsWith('.txt')) {
        alert(`Tipo não suportado: ${file.name}`);
        continue;
      }

      // Upload to Supabase Storage
      const filePath = `${id}/${Date.now()}_${file.name}`;
      setUploadProgress(30);
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadErr) { alert(`Erro ao fazer upload: ${uploadErr.message}`); continue; }
      setUploadProgress(50);

      // Register document in DB
      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, file_path: filePath, file_type: file.type, project_id: id })
      });
      if (!docRes.ok) continue;
      const newDoc = await docRes.json();
      setUploadProgress(60);

      // Extract text and run AI
      await runAIExtraction(newDoc.id, file);
      setUploadProgress(100);
    }

    setUploading(false);
    setUploadProgress(0);
    loadProject();
  }

  async function runAIExtraction(docId: string, file: File) {
    let text = '';
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Read as ArrayBuffer and send to extraction API with file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docId', docId);
        const res = await fetch('/api/documents/extract-file', { method: 'POST', body: formData });
        if (res.ok) { loadProject(); return; }
        text = `[PDF: ${file.name}]`;
      } else {
        text = `[Documento: ${file.name}]`;
      }
    } catch (e) {
      text = `[Documento: ${file.name} — erro ao ler]`;
    }

    await fetch(`/api/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || `Documento: ${file.name}` })
    });
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatMessages(prev => [...prev, { id: 'tmp', role: 'user', content: msg, created_at: new Date().toISOString() }]);
    
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, project_id: id })
    });
    
    if (res.ok) {
      const { response } = await res.json();
      setChatMessages(prev => [...prev.slice(0, -1), 
        { id: 'u', role: 'user', content: msg, created_at: new Date().toISOString() },
        { id: 'a', role: 'assistant', content: response, created_at: new Date().toISOString() }
      ]);
    }
    setChatLoading(false);
  }

  async function generateDraft(e: React.FormEvent) {
    e.preventDefault();
    setDraftLoading(true);
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: draftType, area: project?.area, clientPosition: draftPosition, facts: draftFacts })
    });
    if (res.ok) {
      const { draft } = await res.json();
      setDraftResult(draft);
    }
    setDraftLoading(false);
  }

  if (loading || !project) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/dashboard')} className="btn-ghost" style={{ padding: '6px 12px' }}>← Voltar</button>
            <div>
              <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{project.name}</h1>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span className="badge-gray">{project.area}</span>
                <span style={{ fontSize: '12px', color: riskColor[project.risk_level] || '#888' }}>● {project.risk_level}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>{project.documents?.length || 0} documentos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginTop: '16px', borderBottom: '1px solid var(--border)' }}>
          {([['docs', '▦ Documentos'], ['chat', '◈ Chat IA'], ['draft', '✦ Elaboração']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 20px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontSize: '13px',
                color: tab === t ? 'var(--gold)' : 'var(--text-4)',
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
                fontWeight: tab === t ? '600' : '400', transition: 'all 0.15s'
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* DOCS TAB */}
      {tab === 'docs' && (
        <div style={{ padding: '24px 28px' }}>
          {/* Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#C9A84C' : 'var(--border)'}`,
              borderRadius: '12px', padding: '40px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'rgba(201,168,76,0.05)' : 'var(--bg-2)',
              marginBottom: '24px', transition: 'all 0.15s'
            }}>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={e => e.target.files && uploadFiles(Array.from(e.target.files))} />
            {uploading ? (
              <div>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚡</div>
                <div style={{ fontSize: '14px', color: 'var(--gold)', fontWeight: '600', marginBottom: '8px' }}>Analisando com IA...</div>
                <div style={{ width: '200px', height: '4px', background: 'var(--bg-3)', borderRadius: '2px', margin: '0 auto' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#C9A84C', borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📎</div>
                <div style={{ fontSize: '14px', color: dragging ? 'var(--gold)' : 'var(--text-2)', fontWeight: '600', marginBottom: '6px' }}>
                  {dragging ? 'Solte para fazer upload' : 'Arraste documentos aqui'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>PDF, DOCX, DOC, TXT · A IA analisa automaticamente</div>
              </>
            )}
          </div>

          {/* Documents List */}
          {project.documents.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>Nenhum documento ainda. Faça o upload acima.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {project.documents.map(doc => {
                const ext = doc.document_extractions?.[0];
                const isExpanded = expandedDoc === doc.id;
                return (
                  <div key={doc.id} className="card" style={{ padding: '16px', border: isExpanded ? '1px solid var(--gold-border)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>{doc.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')} · {' '}
                          {doc.ai_status === 'complete' ? <span style={{ color: '#22c55e' }}>✓ Análise concluída</span>
                            : doc.ai_status === 'processing' ? <span style={{ color: '#C9A84C' }}>⟳ Analisando com IA...</span>
                            : doc.ai_status === 'failed' ? <span style={{ color: '#ef4444' }}>✗ Falha na análise</span>
                            : <span style={{ color: '#888' }}>Pendente</span>}
                        </div>
                      </div>
                      {ext && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length > 0 && (
                            <span className="badge-red">{(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length} risco{(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length > 1 ? 's' : ''} alto{(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length > 1 ? 's' : ''}</span>
                          )}
                          {(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length > 0 && (
                            <span className="badge-red">{(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length} prazo{(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length > 1 ? 's' : ''} urgente{(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isExpanded && ext && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>Tipo de Documento</div>
                            <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: '600' }}>{ext.doc_type}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>Partes</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{(ext.parties || []).join(', ')}</div>
                          </div>
                        </div>

                        {ext.summary && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>Resumo</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6' }}>{ext.summary}</div>
                          </div>
                        )}

                        {(ext.risk_flags || []).length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px' }}>Riscos Identificados</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(ext.risk_flags || []).map((r: any, i: number) => (
                                <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: '6px', border: `1px solid ${r.severity === 'alto' ? '#ef444430' : r.severity === 'medio' ? '#eab30830' : '#22c55e30'}`, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: r.severity === 'alto' ? '#ef4444' : r.severity === 'medio' ? '#eab308' : '#22c55e', fontWeight: '700', textTransform: 'uppercase', minWidth: '40px' }}>{r.severity}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{r.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(ext.deadlines || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px' }}>Prazos</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(ext.deadlines || []).map((d: any, i: number) => (
                                <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: '6px', border: `1px solid ${d.urgency === 'alta' ? '#ef444430' : '#eab30830'}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: d.urgency === 'alta' ? '#ef4444' : '#eab308', minWidth: '80px' }}>{d.date}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{d.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CHAT TAB */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--gold)' }}>◈</div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-2)', margin: '0 0 8px' }}>Chat IA — {project.name}</p>
                <p style={{ fontSize: '12px', margin: 0 }}>A IA conhece todos os documentos deste caso. Pergunte qualquer coisa.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg, i) => (
                <div key={msg.id + i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.role === 'user' ? 'rgba(201,168,76,0.15)' : 'var(--bg-2)',
                    border: `1px solid ${msg.role === 'user' ? '#C9A84C30' : 'var(--border)'}`,
                    fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.role === 'assistant' && (
                      <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '600', marginBottom: '6px' }}>◈ Notorious AI</div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '600', marginBottom: '6px' }}>◈ Notorious AI</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
          <form onSubmit={sendChat} style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: '12px' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="Pergunte sobre o caso, documentos, prazos, estratégias..."
              style={{ flex: 1 }} disabled={chatLoading} />
            <button type="submit" className="btn-gold" disabled={chatLoading || !chatInput.trim()}>Enviar</button>
          </form>
        </div>
      )}

      {/* DRAFT TAB */}
      {tab === 'draft' && (
        <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: draftResult ? '1fr 1fr' : '1fr', gap: '24px' }}>
          <div>
            <form onSubmit={generateDraft}>
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: '600', color: 'var(--gold)' }}>✦ Elaboração de Documento</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Tipo de Documento</label>
                  <select value={draftType} onChange={e => setDraftType(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}>
                    {['Petição Inicial', 'Contestação', 'Réplica', 'Recurso de Apelação', 'Recurso Especial', 'Agravo de Instrumento', 'Contrato', 'Parecer Jurídico', 'Notificação Extrajudicial', 'Acordo de Confidencialidade'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Posição do Cliente</label>
                  <input value={draftPosition} onChange={e => setDraftPosition(e.target.value)}
                    placeholder="Ex: Reclamante, trabalhador demitido sem justa causa..." required />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Fatos Relevantes</label>
                  <textarea value={draftFacts} onChange={e => setDraftFacts(e.target.value)}
                    placeholder="Descreva os fatos principais do caso, documentos relevantes, argumentos a serem desenvolvidos..."
                    required rows={6}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" className="btn-gold" disabled={draftLoading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                  {draftLoading ? '✦ Gerando documento...' : '✦ Gerar Documento com IA'}
                </button>
              </div>
            </form>
          </div>

          {draftResult && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{draftType}</h3>
                <button className="btn-ghost" style={{ fontSize: '12px' }}
                  onClick={() => navigator.clipboard.writeText(draftResult)}>
                  Copiar
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.8', maxHeight: '600px', overflowY: 'auto' }}>
                {draftResult}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
