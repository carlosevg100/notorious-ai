"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return await file.text();
    }
    // Use pdfjs-dist in browser — no server-side PDF parsing needed
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const chunks: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      chunks.push(content.items.map((item: {str?: string} & object) => ('str' in item ? (item as {str:string}).str : '') || '').join(' '));
    }
    return chunks.join(' ').replace(/\s+/g, ' ').trim().substring(0, 12000);
  } catch (e) {
    console.error('PDF extraction error:', e);
    return '';
  }
}

interface Client {
  id: string;
  name: string;
  type?: string;
}

export default function NewProcessoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client_id");

  const [step, setStep] = useState(preselectedClientId ? 2 : 1);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState("PJ");
  const [savingClient, setSavingClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    numero_processo: "",
    tribunal: "",
    comarca: "",
    vara: "",
    juiz: "",
    valor_causa: "",
    polo_ativo_nome: "",
    polo_passivo_nome: "",
    fase: "recebido",
    risco: "medio",
  });
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.ok) setClients(await res.json());
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  async function createNewClient() {
    if (!newClientName.trim()) return;
    setSavingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim(), type: newClientType }),
      });
      if (res.ok) {
        const created = await res.json();
        await loadClients();
        setSelectedClientId(created.id);
        setShowNewClient(false);
        setNewClientName("");
      }
    } finally {
      setSavingClient(false);
    }
  }

  const [uploadStatus, setUploadStatus] = useState<string>("");

  async function handleUpload() {
    if (!file || !selectedClientId) return;
    setUploading(true);
    try {
      // Step 1: Extract text in browser (fast, no server timeout)
      setUploadStatus("Lendo documento...");
      const extractedText = await extractTextFromPDF(file);
      
      // Step 2: Upload file + extracted text to server
      setUploadStatus("Enviando arquivo...");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_id", selectedClientId);
      if (extractedText) formData.append("extracted_text", extractedText);
      
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro no upload");
        return;
      }
      setUploadStatus("Analisando com IA...");
      const data = await res.json();
      router.push(`/dashboard/processos/${data.processoId}`);
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  }

  async function handleManual() {
    if (!selectedClientId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          numero_processo: form.numero_processo || undefined,
          tribunal: form.tribunal || undefined,
          comarca: form.comarca || undefined,
          vara: form.vara || undefined,
          juiz: form.juiz || undefined,
          valor_causa: form.valor_causa ? Number(form.valor_causa) : undefined,
          polo_ativo: form.polo_ativo_nome ? { nome: form.polo_ativo_nome } : undefined,
          polo_passivo: form.polo_passivo_nome ? { nome: form.polo_passivo_nome } : undefined,
          fase: form.fase,
          risco: form.risco,
        }),
      });
      if (res.ok) {
        const p = await res.json();
        router.push(`/dashboard/processos/${p.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao criar processo");
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>Novo Processo</h1>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, alignItems: "center" }}>
        {[1, 2].map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13,
              background: step >= s ? "var(--gold)" : "var(--bg-3)",
              color: step >= s ? "#000" : "var(--text-3)",
              border: `1px solid ${step >= s ? "var(--gold)" : "var(--border)"}`,
            }}>
              {s}
            </div>
            <span style={{ fontSize: 13, color: step >= s ? "var(--text)" : "var(--text-3)", fontWeight: step === s ? 600 : 400 }}>
              {s === 1 ? "Selecionar Cliente" : "Dados do Processo"}
            </span>
            {s < 2 && <span style={{ color: "var(--text-4)", margin: "0 4px" }}>›</span>}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Selecione o Cliente</h2>
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              style={{
                width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                color: selectedClientId ? "var(--text)" : "var(--text-3)",
                borderRadius: 8, padding: "10px 14px", fontSize: 13,
              }}
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type || "PJ"})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowNewClient(!showNewClient)}>
              + Criar novo cliente
            </button>
          </div>
          {showNewClient && (
            <div style={{ background: "var(--bg-2)", borderRadius: 8, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
              <input
                autoFocus
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNewClient()}
                placeholder="Nome do cliente"
                style={{
                  width: "100%", background: "var(--bg-3)", border: "1px solid var(--border)",
                  color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 8,
                }}
              />
              <select
                value={newClientType}
                onChange={e => setNewClientType(e.target.value)}
                style={{ width: "100%", background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}
              >
                <option value="PJ">Pessoa Jurídica (PJ)</option>
                <option value="PF">Pessoa Física (PF)</option>
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowNewClient(false)}>Cancelar</button>
                <button className="btn-gold" style={{ fontSize: 12 }} onClick={createNewClient} disabled={savingClient || !newClientName.trim()}>
                  {savingClient ? "Criando..." : "Criar"}
                </button>
              </div>
            </div>
          )}
          <button className="btn-gold" onClick={() => setStep(2)} disabled={!selectedClientId} style={{ width: "100%" }}>
            Continuar →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setStep(1)}>← Voltar</button>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>
              Cliente: <strong style={{ color: "var(--text)" }}>{selectedClient?.name}</strong>
            </span>
          </div>

          <div style={{ display: "flex", marginBottom: 20, background: "var(--bg-2)", borderRadius: 8, padding: 4, gap: 4, border: "1px solid var(--border)" }}>
            {(["upload", "manual"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 500, border: "none",
                  cursor: "pointer", background: mode === m ? "var(--bg-3)" : "transparent",
                  color: mode === m ? "var(--gold)" : "var(--text-3)", transition: "all 0.15s",
                }}
              >
                {m === "upload" ? "📄 Upload da Inicial" : "✏️ Criar Manualmente"}
              </button>
            ))}
          </div>

          {mode === "upload" && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Upload da Petição Inicial</h3>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "var(--gold)" : file ? "#22c55e" : "var(--border-2)"}`,
                  borderRadius: 10, padding: 40, textAlign: "center", cursor: "pointer",
                  background: dragging ? "var(--gold-bg)" : "var(--bg-2)", transition: "all 0.15s", marginBottom: 16,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  style={{ display: "none" }}
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    <button style={{ marginTop: 10, fontSize: 11, color: "var(--text-4)", background: "none", border: "none", cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); setFile(null); }}>Trocar arquivo</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Arraste o arquivo aqui</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>ou clique para selecionar</div>
                    <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 8 }}>PDF, DOC, DOCX, TXT</div>
                  </div>
                )}
              </div>
              <div style={{ background: "var(--bg-2)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-3)", border: "1px solid var(--border)" }}>
                ⏳ A IA irá extrair automaticamente dados da inicial em segundo plano.
              </div>
              <button className="btn-gold" onClick={handleUpload} disabled={!file || uploading} style={{ width: "100%" }}>
                {uploading ? "Enviando..." : "Enviar e Criar Processo"}
              </button>
            </div>
          )}

          {mode === "manual" && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Dados do Processo</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { key: "numero_processo", label: "Número do Processo", placeholder: "1234567-89.2024.8.26.0100" },
                  { key: "tribunal", label: "Tribunal", placeholder: "TJSP, TRT2..." },
                  { key: "comarca", label: "Comarca", placeholder: "São Paulo" },
                  { key: "vara", label: "Vara", placeholder: "1ª Vara Cível" },
                  { key: "juiz", label: "Juiz", placeholder: "Nome do magistrado" },
                  { key: "valor_causa", label: "Valor da Causa (R$)", placeholder: "50000" },
                  { key: "polo_ativo_nome", label: "Polo Ativo (Autor)", placeholder: "Nome do autor" },
                  { key: "polo_passivo_nome", label: "Polo Passivo (Réu)", placeholder: "Nome do réu" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>{label}</label>
                    <input
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>Fase</label>
                  <select value={form.fase} onChange={e => setForm(prev => ({ ...prev, fase: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
                    <option value="recebido">Recebido</option>
                    <option value="extracao">Extração</option>
                    <option value="docs_solicitados">Docs Solicitados</option>
                    <option value="docs_recebidos">Docs Recebidos</option>
                    <option value="contestacao_gerando">Gerando Contestação</option>
                    <option value="contestacao_revisao">Revisão</option>
                    <option value="protocolado">Protocolado</option>
                    <option value="aguardando_replica">Aguardando Réplica</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>Risco</label>
                  <select value={form.risco} onChange={e => setForm(prev => ({ ...prev, risco: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
                    <option value="baixo">Baixo</option>
                    <option value="medio">Médio</option>
                    <option value="alto">Alto</option>
                  </select>
                </div>
              </div>
              <button className="btn-gold" onClick={handleManual} disabled={saving} style={{ width: "100%", marginTop: 20 }}>
                {saving ? "Criando..." : "Criar Processo"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
