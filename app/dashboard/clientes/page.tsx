"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  type?: string;
  created_at: string;
  processos_count?: number;
  criticos_count?: number;
}

interface Processo {
  id: string;
  client_id: string;
  prazo_contestacao?: string;
  tutela_urgencia?: boolean;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PJ");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/processos"),
      ]);
      const clientsData: Client[] = cRes.ok ? await cRes.json() : [];
      const processosData: Processo[] = pRes.ok ? await pRes.json() : [];

      const enriched = clientsData.map(c => {
        const cProcessos = processosData.filter(p => p.client_id === c.id);
        const criticos = cProcessos.filter(p => {
          const dias = p.prazo_contestacao
            ? Math.ceil((new Date(p.prazo_contestacao).getTime() - Date.now()) / 86400000)
            : null;
          return (dias !== null && dias <= 5) || p.tutela_urgencia;
        });
        return { ...c, processos_count: cProcessos.length, criticos_count: criticos.length };
      });
      setClients(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCliente() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: newType }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewName("");
        setNewType("PJ");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Clientes</h1>
          <p style={{ color: "var(--text-3)", fontSize: 13, margin: "4px 0 0" }}>
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-gold" onClick={() => setShowModal(true)}>+ Novo Cliente</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div>Nenhum cliente cadastrado ainda.</div>
          <button className="btn-gold" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>+ Novo Cliente</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {clients.map(c => (
            <div
              key={c.id}
              className="card"
              onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
              style={{ padding: "18px 20px", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--gold)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 24 }}>🏢</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                  background: c.type === "PF" ? "#3b82f620" : "#8b5cf620",
                  color: c.type === "PF" ? "#3b82f6" : "#8b5cf6",
                }}>
                  {c.type || "PJ"}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.processos_count || 0}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>processo{c.processos_count !== 1 ? "s" : ""}</div>
                </div>
                {(c.criticos_count || 0) > 0 && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{c.criticos_count}</div>
                    <div style={{ fontSize: 10, color: "#ef4444" }}>crítico{c.criticos_count !== 1 ? "s" : ""}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "#00000088", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ padding: 28, width: 380, borderColor: "var(--gold-border)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Novo Cliente</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-3)", display: "block", marginBottom: 6 }}>Nome *</label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createCliente()}
                placeholder="Nome do cliente"
                style={{
                  width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                  color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13,
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--text-3)", display: "block", marginBottom: 6 }}>Tipo</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}
              >
                <option value="PJ">Pessoa Jurídica (PJ)</option>
                <option value="PF">Pessoa Física (PF)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-gold" onClick={createCliente} disabled={saving || !newName.trim()}>
                {saving ? "Salvando..." : "Criar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
