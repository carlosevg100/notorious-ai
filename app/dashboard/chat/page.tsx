"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Project { id: string; name: string; area: string; }

export default function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])); }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}><span style={{ color: 'var(--gold)' }}>◈</span> Chat IA</h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-4)' }}>Selecione um caso para conversar com a IA</p>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
          {projects.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-4)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--gold)' }}>◈</div>
              <p style={{ margin: 0 }}>Crie um projeto primeiro para usar o Chat IA.</p>
              <Link href="/dashboard"><button className="btn-gold" style={{ marginTop: '16px' }}>Ir para Dashboard</button></Link>
            </div>
          ) : projects.map(p => (
            <Link key={p.id} href={`/dashboard/projeto/${p.id}?tab=chat`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(201,168,76,0.1)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontSize: '16px' }}>◈</div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}><span className="badge-gray">{p.area}</span></div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--gold)' }}>Abrir chat →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
