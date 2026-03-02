"use client";
import { useState } from "react";

const TEAM = [
  { name: "Dr. Cristiano Galves", role: "Sócio Senior", area: "Trabalhista / Empresarial", office: "São Paulo", email: "cristiano@bluz.adv.br", oab: "OAB/SP 123.456", status: "admin" },
  { name: "Dra. Fernanda Luz", role: "Sócia Fundadora", area: "M&A / Contratos", office: "São Paulo", email: "fernanda@bluz.adv.br", oab: "OAB/SP 98.765", status: "admin" },
  { name: "Dr. Rafael Barcellos", role: "Sócio", area: "Tributário", office: "São Paulo", email: "rafael@bluz.adv.br", oab: "OAB/SP 201.334", status: "member" },
  { name: "Dra. Camila Nakashima", role: "Associada Senior", area: "Trabalhista", office: "Londrina", email: "camila@bluz.adv.br", oab: "OAB/PR 45.678", status: "member" },
  { name: "Dr. Marcos Delgado", role: "Associado", area: "Cível", office: "Florianópolis", email: "marcos@bluz.adv.br", oab: "OAB/SC 32.100", status: "member" },
  { name: "Dra. Luiza Fontana", role: "Associada", area: "Contratos / M&A", office: "Miami", email: "luiza@bluz.adv.br", oab: "OAB/SP 187.432", status: "member" },
  { name: "Dr. Thiago Assunção", role: "Estagiário Senior", area: "Trabalhista", office: "São Paulo", email: "thiago@bluz.adv.br", oab: "OAB/SP Est.", status: "viewer" },
];

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<'firm' | 'team' | 'plan' | 'ai'>('firm');

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          <span style={{ color: 'var(--gold)', marginRight: '8px' }}>⚙</span>Configurações
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-4)' }}>B/Luz Advogados · Plano Enterprise</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', padding: '0 28px' }}>
        {[
          { id: 'firm', label: 'Escritório' },
          { id: 'team', label: 'Equipe' },
          { id: 'plan', label: 'Plano' },
          { id: 'ai', label: 'IA' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
            padding: '14px 20px', background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
            color: tab === t.id ? '#C9A84C' : '#666',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '28px' }}>
        {tab === 'firm' && (
          <div style={{ maxWidth: '640px' }}>
            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', color: '#000', fontWeight: '800'
                }}>B</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>B/Luz Advogados</h2>
                  <div style={{ fontSize: '13px', color: 'var(--text-4)', marginTop: '4px' }}>Sociedade de Advogados</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'Razão Social', value: 'B/Luz Advogados S.S.' },
                  { label: 'CNPJ', value: '12.345.678/0001-99' },
                  { label: 'OAB/SP', value: 'DR 123.456-A' },
                  { label: 'Endereço', value: 'Av. Paulista, 1374 · São Paulo/SP' },
                  { label: 'Telefone', value: '+55 (11) 3045-6789' },
                  { label: 'E-mail', value: 'contato@bluz.adv.br' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{f.label}</label>
                    <input defaultValue={f.value} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button className="btn-gold">Salvar alterações</button>
                <button className="btn-ghost">Cancelar</button>
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '600' }}>Filiais</h3>
              {[
                { city: 'São Paulo', state: 'SP', role: 'Sede', lawyers: 18 },
                { city: 'Londrina', state: 'PR', role: 'Filial', lawyers: 3 },
                { city: 'Florianópolis', state: 'SC', role: 'Filial', lawyers: 2 },
                { city: 'Miami', state: 'FL', role: 'International', lawyers: 2 },
              ].map(o => (
                <div key={o.city} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #111', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{o.city}, {o.state}</span>
                    <span className="badge-gray" style={{ marginLeft: '8px' }}>{o.role}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>{o.lawyers} advogados</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'team' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>{TEAM.length} membros</div>
              <button className="btn-gold">+ Convidar membro</button>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Advogado', 'Área', 'Escritório', 'Acesso', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-4)', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAM.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', minWidth: '36px',
                            background: 'linear-gradient(135deg, rgba(201,168,76,0.3), rgba(201,168,76,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', color: 'var(--gold)', fontWeight: '700'
                          }}>{m.name.split(' ').map(n => n[0]).slice(1,3).join('')}</div>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-5)' }}>{m.role} · {m.oab}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-3)' }}>{m.area}</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge-gray">{m.office}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={m.status === 'admin' ? 'badge-gold' : m.status === 'member' ? 'badge-green' : 'badge-gray'}>
                          {m.status === 'admin' ? 'Admin' : m.status === 'member' ? 'Membro' : 'Visualizador'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'plan' && (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ background: 'linear-gradient(135deg, #141414, #1a1510)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div className="badge-gold" style={{ marginBottom: '10px', display: 'inline-block' }}>Plano Atual</div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--gold)' }}>Enterprise</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: '13px' }}>B/Luz Advogados · 25 usuários</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)' }}>R$ 4.900</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>/mês · cobrado anualmente</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  '✓ Usuários ilimitados (add-on)',
                  '✓ Casos ilimitados',
                  '✓ IA Notorious v2.1',
                  '✓ Biblioteca compartilhada',
                  '✓ Suporte prioritário',
                  '✓ API access',
                  '✓ Treinamento personalizado',
                  '✓ Relatórios avançados',
                ].map(f => (
                  <div key={f} style={{ fontSize: '12px', color: 'var(--text-3)' }}>{f}</div>
                ))}
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button className="btn-ghost">Gerenciar assinatura</button>
                <button className="btn-ghost">Faturamento</button>
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '600' }}>Uso Este Mês</h3>
              {[
                { label: 'Documentos analisados', used: 234, limit: 'Ilimitado' },
                { label: 'Peças geradas com IA', used: 47, limit: 'Ilimitado' },
                { label: 'Pesquisas jurídicas', used: 89, limit: 'Ilimitado' },
                { label: 'Armazenamento', used: '14.2 GB', limit: '100 GB' },
              ].map(u => (
                <div key={u.label} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{u.label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '600' }}>{u.used} / {u.limit}</span>
                  </div>
                  {u.label === 'Armazenamento' && (
                    <div style={{ height: '4px', background: '#1f1f1f', borderRadius: '2px' }}>
                      <div style={{ width: '14.2%', height: '100%', background: '#C9A84C', borderRadius: '2px' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div style={{ maxWidth: '640px' }}>
            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '13px', fontWeight: '600' }}>Preferências de IA</h3>
              {[
                { label: 'Idioma padrão', value: 'Português (Brasil)', type: 'select', options: ['Português (Brasil)', 'Inglês'] },
                { label: 'Tom das peças geradas', value: 'Formal (padrão)', type: 'select', options: ['Formal (padrão)', 'Técnico', 'Combativo'] },
                { label: 'Tribunal principal', value: 'São Paulo (TJ-SP, TRT-2)', type: 'select', options: ['São Paulo (TJ-SP, TRT-2)', 'Brasília (STF, STJ)', 'Paraná (TJ-PR, TRT-9)'] },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{f.label}</label>
                  <select defaultValue={f.value}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {[
                { label: 'Alertas automáticos de prazo em PDFs', checked: true },
                { label: 'Detectar cláusulas de risco em contratos', checked: true },
                { label: 'Sugerir jurisprudência ao abrir caso', checked: true },
                { label: 'Notificações de novas decisões relevantes', checked: false },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{t.label}</span>
                  <div style={{
                    width: '40px', height: '22px', borderRadius: '11px',
                    background: t.checked ? '#C9A84C' : '#2a2a2a',
                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '2px', left: t.checked ? '20px' : '2px',
                      transition: 'left 0.2s'
                    }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '20px' }}>
                <button className="btn-gold">Salvar preferências</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
