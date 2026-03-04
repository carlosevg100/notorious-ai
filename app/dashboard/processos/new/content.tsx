"use client";
import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewProcessoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (clientId) fd.append("client_id", clientId);
      const res = await fetch("/api/intake", { method: "POST", body: fd });
      const data = await res.json();
      if (data.processo_id) {
        router.push(`/dashboard/processos/${data.processo_id}`);
      } else {
        setError("Erro ao criar processo. Tente novamente.");
        setUploading(false);
      }
    } catch {
      setError("Erro ao criar processo. Tente novamente.");
      setUploading(false);
    }
  }, [clientId, router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  if (uploading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTop: "3px solid var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 14, color: "var(--text-3)" }}>Analisando documento...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "32px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "var(--text)", textAlign: "center" }}>
          Novo Processo
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-4)", textAlign: "center", marginBottom: 32 }}>
          Faça upload da petição inicial para criar o processo automaticamente
        </p>

        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: 280, border: `2px dashed ${dragging ? "var(--gold)" : "var(--border-2)"}`,
            borderRadius: 16, cursor: "pointer", gap: 12,
            background: dragging ? "var(--gold-bg)" : "var(--bg-3)",
            transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 48, color: dragging ? "var(--gold)" : "var(--text-4)" }}>↑</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: dragging ? "var(--gold)" : "var(--text-2)" }}>
            Solte o PDF aqui ou clique para selecionar
          </div>
          <div style={{ fontSize: 12, color: "var(--text-4)" }}>PDF, DOCX, TXT</div>
          <input type="file" accept=".pdf,.docx,.txt" hidden onChange={handleChange} />
        </label>

        {error && (
          <div style={{ marginTop: 16, fontSize: 13, color: "#ef4444", padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
