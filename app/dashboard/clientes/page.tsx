"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  type?: string;
  cnpj?: string;
  created_at: string;
  processos_count?: number;
}

interface Processo {
  id: string;
  client_id: string;
  risco?: string;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PJ");
  const [newCnpj, setNewCnpj] = useState("");
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

      const enriched = clientsData.map(c => ({
        ...c,
        processos_count: processosData.filter(p => p.client_id === c.id).length,
      }));
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
      const body: Record<string, string> = { name: newName.trim(), type: newType };
      if (newCnpj.trim()) body.cnpj = newCnpj.trim();
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        setNewName("");
        setNewType("PJ");
        setNewCnpj("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>CLIENTES</h1>
        <button className="btn-gold" onClick={() => setShowForm(v => !v)}>+ Novo Cliente</button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 16, borderColor: "var(--gold-border)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Nome *
              </label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createCliente()}
                placeholder="Nome do cliente"
                style={{
                  width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                  color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tipo
              </label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                style={{
                  width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                  color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 13,
                }}
              >
                <option value="PJ">PJ</option>
                <option value="PF">PF</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                CNPJ/CPF
              </label>
              <input
                value={newCnpj}
                onChange={e => setNewCnpj(e.target.value)}
                placeholder="Opcional"
                style={{
                  width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)",
                  color: "var(--text)", borderRadius: 6, padding: "7px 10px", fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setNewName(""); setNewCnpj(""); }} style={{ fontSize: 12 }}>
                Cancelar
              </button>
              <button className="btn-gold" onClick={createCliente} disabled={saving || !newName.trim()} style={{ fontSize: 12 }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            Carregando...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            Nenhum cliente cadastrado.{" "}
            <button onClick={() => setShowForm(true)} style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
              + Novo Cliente
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-3)" }}>
                {["Nome", "Tipo", "Processos Ativos", "Criado em", "→"].map(col => (
                  <th key={col} style={{
                    padding: "9px 14px", fontWeight: 600, textAlign: "left", fontSize: 10,
                    color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "11px 14px", fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                      background: c.type === "PF" ? "rgba(59,130,246,0.15)" : "rgba(139,92,246,0.15)",
                      color: c.type === "PF" ? "#3b82f6" : "#8b5cf6",
                    }}>
                      {c.type || "PJ"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-2)" }}>
                    {c.processos_count || 0}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-3)", fontSize: 12 }}>
                    {fmtDate(c.created_at)}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-3)" }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
