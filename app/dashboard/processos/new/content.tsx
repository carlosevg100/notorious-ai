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

type UploadStep = "reading" | "uploading" | "analyzing";

export default function NewProcessoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client_id");

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<UploadStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<UploadStep>>(new Set());
  const [error, setError] = useState("");

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState("PJ");
  const [savingClient, setSavingClient] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then((data: Client[]) => {
      setClients(data);
      if (preselectedClientId) {
        const c = data.find((c: Client) => c.id === preselectedClientId);
        if (c) setSelectedClientName(c.name);
      }
    }).catch(() => {});
  }, [preselectedClientId]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function createCliente() {
    if (!newClientName.trim()) return;
    setSavingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim(), type: newClientType }),
      });
      if (res.ok) {
        const created: Client = await res.json();
        setClients(prev => [...prev, created]);
        setSelectedClientId(created.id);
        setSelectedClientName(created.name);
        setShowNewClient(false);
        setNewClientName("");
      }
    } finally {
      setSavingClient(false);
    }
  }

  async function handleSubmit() {
    if (!selectedClientId || !file) return;
    setUploading(true);
    setError("");
    setCompletedSteps(new Set());

    try {
      // Step 1: Read / extract text
      setCurrentStep("reading");
      const extractedText = await extractTextFromPDF(file);
      setCompletedSteps(prev => new Set([...prev, "reading"]));

      // Step 2: Upload
      setCurrentStep("uploading");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_id", selectedClientId);
      if (extractedText) formData.append("extracted_text", extractedText);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload falhou");
      const data = await res.json();
      setCompletedSteps(prev => new Set([...prev, "uploading"]));

      const processoId = data.processoId || data.processo_id || data.id;

      // Step 3: Analyze (already done in upload route when extracted_text was provided)
      setCurrentStep("analyzing");
      // If server didn't extract (no text), trigger now
      if (processoId && !data.extracted) {
        await fetch(`/api/processos/${processoId}/extrair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      setCompletedSteps(prev => new Set([...prev, "analyzing"]));

      if (processoId) {
        router.push(`/dashboard/processos/${processoId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      setError("Erro ao criar processo. Tente novamente.");
      setUploading(false);
      setCurrentStep(null);
    }
  }

  const STEPS: { key: UploadStep; label: string }[] = [
    { key: "reading", label: "Lendo documento..." },
    { key: "uploading", label: "Enviando arquivo..." },
    { key: "analyzing", label: "Analisando com IA..." },
  ];

  if (uploading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 32px" }}>
        <div className="card" style={{ padding: "32px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 24, color: "var(--text-2)" }}>
            Criando processo...
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {STEPS.map(s => {
              const done = completedSteps.has(s.key);
              const active = currentStep === s.key;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    background: done ? "#22c55e" : active ? "var(--gold)" : "var(--bg-3)",
                    border: `2px solid ${done ? "#22c55e" : active ? "var(--gold)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000",
                    animation: active ? "pulse 1.5s ease-in-out infinite" : "none",
                  }}>
                    {done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 13, color: done ? "var(--text-2)" : active ? "var(--text)" : "var(--text-4)", fontWeight: active ? 600 : 400 }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 28, letterSpacing: "-0.01em" }}>
        Novo Processo
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Cliente */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
            Cliente *
          </label>
          {preselectedClientId && selectedClientName ? (
            <div style={{
              padding: "10px 14px", border: "1px solid var(--gold-border)", borderRadius: 8,
              background: "var(--gold-bg)", fontSize: 13, fontWeight: 600, color: "var(--gold)",
            }}>
              {selectedClientName}
            </div>
          ) : (
            <div>
              <select
                value={selectedClientId}
                onChange={e => {
                  if (e.target.value === "__new__") {
                    setShowNewClient(true);
                    setSelectedClientId("");
                  } else {
                    setSelectedClientId(e.target.value);
                    setShowNewClient(false);
                  }
                }}
                style={{
                  width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                  color: selectedClientId ? "var(--text)" : "var(--text-4)", borderRadius: 8,
                  padding: "10px 14px", fontSize: 13,
                }}
              >
                <option value="">Selecionar cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__new__">+ Criar novo cliente</option>
              </select>

              {showNewClient && (
                <div style={{
                  marginTop: 10, padding: "14px 16px", background: "var(--bg-3)",
                  border: "1px solid var(--border)", borderRadius: 8,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 10 }}>Novo cliente</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      autoFocus
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      placeholder="Nome do cliente"
                      style={{
                        flex: 1, background: "var(--bg-2)", border: "1px solid var(--border)",
                        color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 13,
                      }}
                    />
                    <select
                      value={newClientType}
                      onChange={e => setNewClientType(e.target.value)}
                      style={{
                        background: "var(--bg-2)", border: "1px solid var(--border)",
                        color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 13,
                      }}
                    >
                      <option value="PJ">PJ</option>
                      <option value="PF">PF</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowNewClient(false)}>Cancelar</button>
                    <button className="btn-gold" style={{ fontSize: 12 }} onClick={createCliente} disabled={savingClient || !newClientName.trim()}>
                      {savingClient ? "Salvando..." : "Criar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Petição Inicial */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
            Petição Inicial *
          </label>
          <div
            onClick={() => !file && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              height: 140, border: `2px dashed ${dragging ? "var(--gold)" : file ? "var(--gold-border)" : "var(--border-2)"}`,
              borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", cursor: file ? "default" : "pointer", gap: 8,
              background: dragging ? "var(--gold-bg)" : file ? "rgba(201,168,76,0.05)" : "var(--bg-3)",
              transition: "all 0.15s",
            }}
          >
            {file ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)" }}>
                  ✓ {file.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                >
                  Trocar arquivo
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, color: "var(--text-4)" }}>↑</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                  Arraste ou clique para selecionar a petição inicial
                </div>
                <div style={{ fontSize: 11, color: "var(--text-4)" }}>PDF, TXT, DOCX</div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-gold"
          style={{ width: "100%", justifyContent: "center", padding: "12px 20px", fontSize: 14, fontWeight: 600 }}
          onClick={handleSubmit}
          disabled={!selectedClientId || !file || uploading}
        >
          Criar Processo e Analisar →
        </button>
      </div>
    </div>
  );
}
