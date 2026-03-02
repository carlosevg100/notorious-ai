"use client";
import Link from "next/link";

const CASES = [
  { id: 1, name: "Demissão sem justa causa — Metalúrgica ABC", area: "Trabalhista", client: "João Silva", risk: "red", deadline: "05/03/2026" },
  { id: 2, name: "Rescisão contratual — TechBrasil Ltda", area: "Contratos", client: "TechBrasil Ltda", risk: "yellow", deadline: "12/03/2026" },
  { id: 3, name: "Recuperação judicial — Grupo Nordeste S.A.", area: "M&A", client: "Grupo Nordeste S.A.", risk: "red", deadline: "07/03/2026" },
  { id: 4, name: "Embargo de obra — Condomínio Vista Verde", area: "Cível", client: "Condomínio Vista Verde", risk: "green", deadline: "20/03/2026" },
];

const DEADLINES = [
  { name: "Contestação — Proc. 1234-56.2026", date: "05/03", urgency: "red",    case: "Metalúrgica ABC" },
  { name: "Recurso Especial — STJ",            date: "07/03", urgency: "red",    case: "Grupo Nordeste" },
  { name: "Réplica — 2ª Vara Cível SP",        date: "10/03", urgency: "yellow", case: "Vista Verde" },
  { name: "Audiência de conciliação",           date: "12/03", urgency: "yellow", case: "TechBrasil" },
  { name: "Prazo para manifestação CARF",       date: "18/03", urgency: "green",  case: "Tributário Geral" },
];

const ALERTS = [
  { type: "warning", text: "Cláusula de não-concorrência atípica detectada", doc: "Contrato TechBrasil_v3.pdf", time: "há 12 min" },
  { type: "info",    text: "Nova jurisprudência STJ sobre rescisão indireta",  doc: "REsp 2.143.871-SP",         time: "há 1h" },
  { type: "success", text: "Prazo identificado em PDF: 05/03/2026 às 23h59",   doc: "Notificação_ABC.pdf",       time: "há 2h" },
];

const DOCS = [
  { name: "Petição Inicial — Grupo Nordeste.pdf",    status: "Análise pendente",    size: "2.4 MB" },
  { name: "Contrato de Prestação_TechBrasil_v3.pdf", status: "⚠ 3 riscos detectados", size: "856 KB" },
  { name: "Notificação Extrajudicial_ABC.pdf",       status: "✓ Analisado",         size: "341 KB" },
];

export default function Dashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top Bar */}
      <div style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>Olá, Dr. Cristiano 👋</h1>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-4)" }}>
            Hoje é segunda-feira — <span style={{ color: "#ef4444", fontWeight: "600" }}>3 itens críticos</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 14px", cursor: "text", width: "260px" }}>
            <span style={{ fontSize: "14px", color: "var(--text-4)" }}>◎</span>
            <span style={{ fontSize: "13px", color: "var(--text-4)" }}>Pesquisa global...</span>
            <kbd style={{ marginLeft: "auto", background: "var(--bg-4)", border: "1px solid var(--border-2)", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", color: "var(--text-5)" }}>⌘K</kbd>
          </div>
          <div style={{ position: "relative", width: "36px", height: "36px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px" }}>
            🔔
            <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "14px", height: "14px", background: "#ef4444", borderRadius: "50%", fontSize: "9px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>3</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Casos Ativos",     value: "23", sub: "+2 esta semana",    color: "var(--gold)" },
            { label: "Prazos Críticos",  value: "3",  sub: "Próximos 7 dias",   color: "#ef4444" },
            { label: "Docs Pendentes",   value: "8",  sub: "Aguardando análise", color: "#eab308" },
            { label: "Alertas IA",       value: "5",  sub: "Hoje",              color: "#8b5cf6" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600", marginBottom: "8px" }}>{s.label}</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-5)", marginTop: "6px" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Cases */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Casos Ativos</h3>
              <Link href="/dashboard/casos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {CASES.map(c => (
                <Link href="/dashboard/casos" key={c.id} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "4px" }}>{c.name}</div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span className="badge-gray">{c.area}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-4)" }}>{c.client}</span>
                        </div>
                      </div>
                      <div style={{ marginLeft: "8px", textAlign: "right" }}>
                        <span className={`badge-${c.risk}`}>{c.risk === "red" ? "Alto" : c.risk === "yellow" ? "Médio" : "Baixo"}</span>
                        <div style={{ fontSize: "10px", color: "var(--text-5)", marginTop: "4px" }}>{c.deadline}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Deadlines */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Prazos Críticos</h3>
              <Link href="/dashboard/prazos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {DEADLINES.map((d, i) => (
                <div key={i} style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: `1px solid ${d.urgency === "red" ? "#ef444430" : d.urgency === "yellow" ? "#eab30830" : "#22c55e30"}`, display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ minWidth: "40px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: d.urgency === "red" ? "#ef4444" : d.urgency === "yellow" ? "#ca8a04" : "#16a34a" }}>{d.date}</div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-4)", marginTop: "2px" }}>{d.case}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* AI Alerts */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}><span style={{ color: "var(--gold)", marginRight: "6px" }}>◈</span>Alertas IA</h3>
              <span className="badge-gold">5 novos</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {ALERTS.map((a, i) => (
                <div key={i} style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: `1px solid ${a.type === "warning" ? "#eab30820" : a.type === "info" ? "#3b82f620" : "#22c55e20"}` }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span>{a.type === "warning" ? "⚠️" : a.type === "info" ? "📋" : "✅"}</span>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "4px" }}>{a.text}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-4)" }}>{a.doc} · {a.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Documentos para Revisão</h3>
              <Link href="/dashboard/documentos" style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {DOCS.map((d, i) => (
                <div key={i} style={{ padding: "12px", background: "var(--bg-2)", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>📄</span>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    <div style={{ fontSize: "11px", color: d.status.includes("⚠") ? "#ca8a04" : d.status.includes("✓") ? "#16a34a" : "var(--text-4)", marginTop: "2px" }}>{d.status}</div>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--text-5)", whiteSpace: "nowrap" }}>{d.size}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px" }}>
              <button className="btn-ghost" style={{ width: "100%", justifyContent: "center" }}>+ Enviar documento</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
