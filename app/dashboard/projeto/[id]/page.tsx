"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Extraction {
  doc_type: string; parties: string[]; key_dates: any[];
  deadlines: any[]; risk_flags: any[]; summary: string; raw_extraction?: any;
}
interface Document {
  id: string; name: string; file_path: string; file_type: string;
  ai_status: string; created_at: string;
  document_extractions?: Extraction[];
}
interface Contract {
  id: string; name: string; status: string; value: number | null;
  end_date: string | null; contract_type: string;
  contract_extractions?: { risk_level: string; risk_flags: any[] }[];
}
interface Project {
  id: string; name: string; area: string; status: string; risk_level: string;
  client_id: string | null;
  clients?: { id: string; name: string; type: string } | null;
  documents: Document[];
}
interface ChatMsg { id: string; role: string; content: string; created_at: string; }

type Tab = 'docs' | 'chat' | 'draft' | 'extraction' | 'contratos' | 'fraude' | 'prazos';

const riskColor: Record<string, string> = { alto: '#ef4444', medio: '#eab308', baixo: '#22c55e' };

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    vigente:               { label: 'Vigente',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    vencido:               { label: 'Vencido',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    renovacao:             { label: 'Renovação',      color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    rescindido:            { label: 'Rescindido',     color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    aguardando_assinatura: { label: 'Ag. Assinatura', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    rascunho:              { label: 'Rascunho',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  };
  const s = map[status] || { label: status, color: '#888', bg: 'transparent' };
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('docs');
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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [fraudFile, setFraudFile] = useState<File | null>(null);
  const [fraudResult, setFraudResult] = useState<any>(null);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [autoContestacao, setAutoContestacao] = useState("");
  const [autoContestacaoLoading, setAutoContestacaoLoading] = useState(false);
  const [autoContestacaoStats, setAutoContestacaoStats] = useState<any>(null);
  const [autoContestacaoEditable, setAutoContestacaoEditable] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fraudInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => { if (tab === 'chat') { loadChat(); } }, [tab, id]);
  useEffect(() => { if (tab === 'contratos' && project?.client_id) { loadContracts(); } }, [tab, project]);
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

  async function loadContracts() {
    if (!project?.client_id) return;
    const res = await fetch(`/api/contratos?client_id=${project.client_id}`);
    if (res.ok) setContracts(await res.json());
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
      const docExts = ['.pdf', '.docx', '.doc', '.txt'];
      const isDoc = allowed.includes(file.type) || docExts.some(e => file.name.toLowerCase().endsWith(e));
      if (!isDoc && !isAudioFile(file)) {
        alert(`Tipo não suportado: ${file.name}`);
        continue;
      }

      const filePath = `${id}/${Date.now()}_${file.name}`;
      setUploadProgress(30);
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadErr) { alert(`Erro ao fazer upload: ${uploadErr.message}`); continue; }
      setUploadProgress(50);

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, file_path: filePath, file_type: file.type, project_id: id })
      });
      if (!docRes.ok) continue;
      const newDoc = await docRes.json();
      setUploadProgress(60);

      await runAIExtraction(newDoc.id, file);
      setUploadProgress(100);
    }

    setUploading(false);
    setUploadProgress(0);
    loadProject();
  }

  async function runAIExtraction(docId: string, file: File) {
    // Route audio files to the transcription endpoint
    if (isAudioFile(file)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docId', docId);
      const res = await fetch('/api/documents/transcribe-audio', { method: 'POST', body: formData });
      if (res.ok) { loadProject(); return; }
      return;
    }

    let text = '';
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docId', docId);
        const res = await fetch('/api/documents/extract-file', { method: 'POST', body: formData });
        if (res.ok) { loadProject(); return; }
        text = `[PDF: ${file.name}]`;
      } else {
        text = `[Documento: ${file.name}]`;
      }
    } catch { text = `[Documento: ${file.name} — erro ao ler]`; }

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
    if (res.ok) { const { draft } = await res.json(); setDraftResult(draft); }
    setDraftLoading(false);
  }

  function isAudioFile(file: File): boolean {
    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm', 'video/webm', 'video/mp4'];
    const audioExts = ['.mp3', '.mp4', '.wav', '.m4a', '.ogg', '.webm'];
    return audioTypes.includes(file.type) || audioExts.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  async function generateAutoContestacao() {
    setAutoContestacaoLoading(true);
    setAutoContestacao("");
    setAutoContestacaoStats(null);
    try {
      const res = await fetch('/api/drafts/auto-contestacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoContestacao(data.draft);
        setAutoContestacaoStats(data.stats);
      }
    } catch {}
    setAutoContestacaoLoading(false);
  }

  async function runFraudScan() {
    if (!fraudFile) return;
    setFraudLoading(true);
    setFraudResult(null);
    try {
      const formData = new FormData();
      formData.append('file', fraudFile);
      const res = await fetch('/api/contratos/analise-fraude', { method: 'POST', body: formData });
      if (res.ok) setFraudResult(await res.json());
      else setFraudResult({ error: 'Análise falhou. Tente novamente.' });
    } catch { setFraudResult({ error: 'Erro de rede.' }); }
    setFraudLoading(false);
  }

  if (loading || !project) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const TABS: [Tab, string][] = [
    ['docs',       '▦ Documentos'],
    ['contratos',  '▤ Contratos'],
    ['chat',       '◈ Chat IA'],
    ['draft',      '✦ Elaboração'],
    ['extraction', '⚙ Extração IA'],
    ['fraude',     '🔍 Fraude'],
    ['prazos',     '◷ Prazos'],
  ];

  // Collect all deadlines from documents
  const allDeadlines = project.documents.flatMap(doc => {
    const ext = doc.document_extractions?.[0];
    if (!ext) return [];
    return (ext.deadlines || []).map((d: any) => ({ ...d, docName: doc.name }));
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 28px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-4)', marginBottom: '10px' }}>
          <Link href="/dashboard/clientes" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Clientes</Link>
          {project.clients && (
            <>
              <span>›</span>
              <Link href={`/dashboard/clientes/${project.clients.id}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                {project.clients.name}
              </Link>
            </>
          )}
          <span>›</span>
          <span style={{ color: 'var(--text-3)' }}>{project.name}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => project.clients ? router.push(`/dashboard/clientes/${project.clients.id}`) : router.push('/dashboard')} className="btn-ghost" style={{ padding: '6px 12px' }}>← Voltar</button>
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
        <div style={{ display: 'flex', gap: '0', marginTop: '14px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontSize: '12px', whiteSpace: 'nowrap',
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
              accept=".pdf,.docx,.doc,.txt,.mp3,.mp4,.wav,.m4a,.ogg,.webm"
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
                <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>PDF, DOCX, DOC, TXT · MP3, MP4, WAV, M4A, OGG, WEBM · A IA analisa automaticamente</div>
              </>
            )}
          </div>

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
                      <span style={{ fontSize: '20px' }}>
                        {doc.file_type === 'audio' || ['.mp3', '.mp4', '.wav', '.m4a', '.ogg', '.webm'].some(e => doc.name.toLowerCase().endsWith(e)) ? '🎙' : '📄'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>{doc.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')} · {' '}
                          {doc.ai_status === 'complete' ? <span style={{ color: '#22c55e' }}>✓ Análise concluída</span>
                            : doc.ai_status === 'processing' ? <span style={{ color: '#C9A84C' }}>⟳ Analisando...</span>
                            : doc.ai_status === 'failed' ? <span style={{ color: '#ef4444' }}>✗ Falha</span>
                            : <span style={{ color: '#888' }}>Pendente</span>}
                        </div>
                      </div>
                      {ext && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length > 0 && (
                            <span className="badge-red">{(ext.risk_flags || []).filter((r: any) => r.severity === 'alto').length} risco(s) alto</span>
                          )}
                          {(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length > 0 && (
                            <span className="badge-red">{(ext.deadlines || []).filter((d: any) => d.urgency === 'alta').length} prazo(s) urgente</span>
                          )}
                        </div>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isExpanded && ext && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        {/* Transcription section for audio files */}
                        {((ext as any).raw_extraction?.transcription) && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🎙</span> Transcrição
                            </div>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                              {(ext as any).raw_extraction.transcription}
                            </div>
                          </div>
                        )}
                        {/* Audio legal intelligence */}
                        {((ext as any).raw_extraction?.relevant_facts?.length > 0) && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Fatos Relevantes</div>
                            {((ext as any).raw_extraction.relevant_facts as string[]).map((f, i) => (
                              <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
                                <span style={{ color: 'var(--text-5)', flexShrink: 0 }}>{i + 1}.</span>{f}
                              </div>
                            ))}
                          </div>
                        )}
                        {((ext as any).raw_extraction?.key_statements?.length > 0) && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Declarações Importantes</div>
                            {((ext as any).raw_extraction.key_statements as string[]).map((s, i) => (
                              <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', padding: '6px 10px', background: 'rgba(201,168,76,0.05)', border: '1px solid var(--gold-border)', borderRadius: '4px', marginBottom: '4px' }}>"{s}"</div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>Tipo</div>
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
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px' }}>Riscos</div>
                            {(ext.risk_flags || []).map((r: any, i: number) => (
                              <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: '6px', border: `1px solid ${r.severity === 'alto' ? '#ef444430' : r.severity === 'medio' ? '#eab30830' : '#22c55e30'}`, display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: r.severity === 'alto' ? '#ef4444' : r.severity === 'medio' ? '#eab308' : '#22c55e', fontWeight: '700', textTransform: 'uppercase', minWidth: '40px' }}>{r.severity}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{r.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(ext.deadlines || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px' }}>Prazos</div>
                            {(ext.deadlines || []).map((d: any, i: number) => (
                              <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: '6px', border: `1px solid ${d.urgency === 'alta' ? '#ef444430' : '#eab30830'}`, display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: d.urgency === 'alta' ? '#ef4444' : '#eab308', minWidth: '80px' }}>{d.date}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{d.description}</span>
                              </div>
                            ))}
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

      {/* CONTRATOS TAB */}
      {tab === 'contratos' && (
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>▤ Contratos do Cliente</h2>
              {!project.client_id && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>
                  Este caso não está vinculado a um cliente. Os contratos são exibidos quando o caso tem um cliente.
                </p>
              )}
            </div>
            <a href="/dashboard/contratos" className="btn-gold" style={{ fontSize: '12px', padding: '7px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              ✦ Adicionar Contrato
            </a>
          </div>

          {contracts.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-4)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>▤</div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--text-2)' }}>Nenhum contrato vinculado</p>
              <p style={{ margin: 0, fontSize: '13px' }}>
                {project.client_id ? 'Adicione contratos na aba Contratos, vinculando ao cliente.' : 'Vincule este caso a um cliente para ver contratos relacionados.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {contracts.map(c => {
                const today = new Date(); today.setHours(0,0,0,0);
                const days = c.end_date ? Math.floor((new Date(c.end_date).getTime() - today.getTime()) / 86400000) : null;
                const isUrgent = days !== null && days >= 0 && days <= 30;
                const ext = c.contract_extractions?.[0];
                return (
                  <div key={c.id} className="card" style={{ padding: '16px', cursor: 'pointer', border: `1px solid ${isUrgent ? '#ef444420' : 'var(--border)'}` }}
                    onClick={() => router.push(`/dashboard/contratos/${c.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '6px' }}>{c.name}</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {c.contract_type && <span className="badge-gray">{c.contract_type}</span>}
                          {statusBadge(c.status)}
                          {ext?.risk_level && (
                            <span style={{ fontSize: '11px', color: riskColor[ext.risk_level] || '#888' }}>● {ext.risk_level}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {days !== null && (
                          <div style={{ fontSize: '12px', color: isUrgent ? '#ef4444' : 'var(--text-4)', fontWeight: isUrgent ? '600' : '400' }}>
                            {days === 0 ? 'Vence hoje' : days < 0 ? `Venceu ${Math.abs(days)}d atrás` : `${days}d restantes`}
                          </div>
                        )}
                        {c.value && (
                          <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.value)}
                          </div>
                        )}
                      </div>
                    </div>
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
                <p style={{ fontSize: '12px', margin: 0 }}>A IA conhece todos os documentos deste caso.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg, i) => (
                <div key={msg.id + i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.role === 'user' ? 'rgba(201,168,76,0.15)' : 'var(--bg-2)',
                    border: `1px solid ${msg.role === 'user' ? '#C9A84C30' : 'var(--border)'}`,
                    fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', whiteSpace: 'pre-wrap'
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
        <div style={{ padding: '24px 28px' }}>
          {/* Auto-contestação button */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))', border: '1px solid var(--gold-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: autoContestacao ? '16px' : '0' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '4px' }}>✨ Gerar Contestação Automática</div>
                <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>A IA lê todos os documentos do caso e elabora uma contestação completa automaticamente</div>
              </div>
              <button onClick={generateAutoContestacao} className="btn-gold" disabled={autoContestacaoLoading}
                style={{ flexShrink: 0, marginLeft: '16px' }}>
                {autoContestacaoLoading ? '✨ Gerando...' : '✨ Gerar Automático'}
              </button>
            </div>

            {autoContestacaoLoading && (
              <div style={{ padding: '12px 16px', background: 'rgba(201,168,76,0.1)', borderRadius: '6px', fontSize: '12px', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--gold-border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                IA analisando todos os documentos do caso...
              </div>
            )}

            {autoContestacao && (
              <div>
                {autoContestacaoStats && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>
                      <span style={{ color: 'var(--gold)', fontWeight: '600' }}>{autoContestacaoStats.documentsAnalyzed}</span> documentos analisados
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>
                      <span style={{ color: 'var(--gold)', fontWeight: '600' }}>{autoContestacaoStats.partiesIdentified}</span> partes identificadas
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>
                      <span style={{ color: 'var(--gold)', fontWeight: '600' }}>{autoContestacaoStats.factsExtracted}</span> fatos extraídos
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => navigator.clipboard.writeText(autoContestacao)}>Copiar</button>
                  <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => {
                    const blob = new Blob([autoContestacao], { type: 'text/plain' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `contestacao-${project?.name || 'caso'}.txt`; a.click();
                  }}>Baixar .txt</button>
                  <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => setAutoContestacaoEditable(!autoContestacaoEditable)}>
                    {autoContestacaoEditable ? 'Fechar edição' : 'Editar'}
                  </button>
                </div>
                <textarea
                  value={autoContestacao}
                  onChange={e => setAutoContestacao(e.target.value)}
                  readOnly={!autoContestacaoEditable}
                  rows={24}
                  style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.8', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', cursor: autoContestacaoEditable ? 'text' : 'default', opacity: autoContestacaoEditable ? 1 : 0.9 }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: draftResult ? '1fr 1fr' : '1fr', gap: '24px' }}>
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
                    placeholder="Descreva os fatos principais do caso..."
                    required rows={6}
                    style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" className="btn-gold" disabled={draftLoading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                  {draftLoading ? '✦ Gerando...' : '✦ Gerar Documento com IA'}
                </button>
              </div>
            </form>
          </div>
          {draftResult && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{draftType}</h3>
                <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => navigator.clipboard.writeText(draftResult)}>Copiar</button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.8', maxHeight: '600px', overflowY: 'auto' }}>
                {draftResult}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* EXTRACTION TAB */}
      {tab === 'extraction' && (
        <div style={{ padding: '24px 28px' }}>
          {project.documents.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-4)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙</div>
              <p style={{ margin: 0, fontSize: '13px' }}>Nenhum documento analisado ainda. Faça upload na aba Documentos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {project.documents.map(doc => {
                const ext = doc.document_extractions?.[0] as any;
                const fraudRisk = ext?.raw_extraction?.fraud_risk || ext?.fraud_risk;
                if (!ext) return (
                  <div key={doc.id} className="card" style={{ padding: '16px', opacity: 0.6 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>📄 {doc.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '4px' }}>
                      {doc.ai_status === 'processing' ? '⟳ Análise em andamento...' : 'Sem extração disponível'}
                    </div>
                  </div>
                );
                return (
                  <div key={doc.id} className="card" style={{ padding: '20px' }}>
                    {fraudRisk?.detected && (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444440', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', marginBottom: '6px' }}>
                          🚨 Possível Fraude — Confiança: {fraudRisk.confidence?.toUpperCase()}
                        </div>
                        {(fraudRisk.indicators || []).map((ind: string, i: number) => (
                          <div key={i} style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>• {ind}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gold)', marginBottom: '4px' }}>{ext.doc_type || 'Documento'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>📄 {doc.name}</div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#22c55e' }}>✓ Análise completa</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Partes</div>
                        {((ext.parties as any[]) || []).map((p: any, i: number) => (
                          <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '3px' }}>
                            {typeof p === 'object' ? `${p.name} (${p.role})` : p}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Datas-chave</div>
                        {((ext.key_dates as any[]) || []).slice(0, 4).map((d: any, i: number) => (
                          <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '3px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-3)' }}>{d.date}</span> — {d.description}
                          </div>
                        ))}
                      </div>
                    </div>
                    {ext.summary && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '600' }}>Resumo</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.7' }}>{ext.summary}</div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {((ext.risk_flags as any[]) || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Riscos</div>
                          {((ext.risk_flags as any[]) || []).map((r: any, i: number) => (
                            <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-3)', borderRadius: '4px', border: `1px solid ${r.severity === 'alto' ? '#ef444430' : r.severity === 'medio' ? '#eab30830' : '#22c55e30'}`, marginBottom: '4px', display: 'flex', gap: '8px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', color: r.severity === 'alto' ? '#ef4444' : r.severity === 'medio' ? '#eab308' : '#22c55e', textTransform: 'uppercase', minWidth: '36px' }}>{r.severity}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{r.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {((ext.deadlines as any[]) || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Prazos</div>
                          {((ext.deadlines as any[]) || []).map((d: any, i: number) => (
                            <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-3)', borderRadius: '4px', border: `1px solid ${d.urgency === 'alta' ? '#ef444430' : '#eab30830'}`, marginBottom: '4px', display: 'flex', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: d.urgency === 'alta' ? '#ef4444' : '#eab308', minWidth: '60px' }}>{d.date}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{d.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FRAUDE TAB */}
      {tab === 'fraude' && (
        <div style={{ padding: '24px 28px' }}>
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: 'var(--gold)' }}>🔍 Análise de Fraude</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-4)' }}>
              Faça upload de qualquer documento deste caso para análise de fraude com IA.
            </p>
            <div
              onClick={() => fraudInputRef.current?.click()}
              style={{
                border: `2px dashed ${fraudFile ? '#C9A84C' : 'var(--border)'}`,
                borderRadius: '10px', padding: '32px', textAlign: 'center', cursor: 'pointer',
                background: fraudFile ? 'rgba(201,168,76,0.05)' : 'var(--bg-2)', marginBottom: '16px', transition: 'all 0.15s'
              }}>
              <input ref={fraudInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx,.doc,.txt"
                onChange={e => e.target.files?.[0] && setFraudFile(e.target.files[0])} />
              {fraudFile ? (
                <div>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: '600' }}>{fraudFile.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '4px' }}>{(fraudFile.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📎</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '600', marginBottom: '4px' }}>Clique para selecionar um documento</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>PDF, DOCX, DOC, TXT</div>
                </>
              )}
            </div>
            <button onClick={runFraudScan} className="btn-gold" disabled={!fraudFile || fraudLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
              {fraudLoading ? '🔍 Analisando...' : '🔍 Executar Análise de Fraude'}
            </button>
          </div>

          {fraudResult && (
            <div className="card" style={{ padding: '24px' }}>
              {fraudResult.error ? (
                <div style={{ color: '#ef4444', fontSize: '13px' }}>✗ {fraudResult.error}</div>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600' }}>Resultado da Análise</h3>
                  {fraudResult.fraud_risk?.detected ? (
                    <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444440', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>
                        🚨 Possível Fraude Detectada
                      </div>
                      <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px' }}>
                        Nível de confiança: <strong>{fraudResult.fraud_risk.confidence?.toUpperCase()}</strong>
                      </div>
                      {(fraudResult.fraud_risk.indicators || []).map((ind: string, i: number) => (
                        <div key={i} style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>• {ind}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e40', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>✓ Nenhuma Fraude Detectada</div>
                      <div style={{ fontSize: '12px', color: '#86efac', marginTop: '4px' }}>O documento parece legítimo com base na análise de IA.</div>
                    </div>
                  )}
                  {fraudResult.summary && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '600' }}>Resumo da Análise</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6' }}>{fraudResult.summary}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* PRAZOS TAB */}
      {tab === 'prazos' && (
        <div style={{ padding: '24px 28px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>◷ Prazos do Caso</h3>
            {allDeadlines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-4)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>◷</div>
                <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--text-2)' }}>Nenhum prazo identificado</p>
                <p style={{ margin: 0, fontSize: '12px' }}>Faça upload de documentos na aba Documentos para a IA identificar prazos automaticamente.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allDeadlines
                  .sort((a: any, b: any) => (a.urgency === 'alta' ? -1 : 1))
                  .map((d: any, i: number) => (
                    <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: '8px', border: `1px solid ${d.urgency === 'alta' ? '#ef444430' : d.urgency === 'media' ? '#eab30830' : 'var(--border)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: d.urgency === 'alta' ? '#ef4444' : d.urgency === 'media' ? '#eab308' : 'var(--text-2)', marginBottom: '4px' }}>
                            {d.date}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{d.description}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '4px' }}>
                            Documento: {d.docName}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px',
                          background: d.urgency === 'alta' ? 'rgba(239,68,68,0.1)' : d.urgency === 'media' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                          color: d.urgency === 'alta' ? '#ef4444' : d.urgency === 'media' ? '#eab308' : '#22c55e',
                          textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0,
                        }}>
                          {d.urgency === 'alta' ? 'Urgente' : d.urgency === 'media' ? 'Médio' : 'Normal'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
