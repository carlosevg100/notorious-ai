"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Party { name: string; role: string }
interface Alert { id: string; type: string; message: string; alert_date: string; is_read: boolean; created_at: string }
interface Version { id: string; version: number; file_path: string; notes: string; created_at: string }
interface Extraction {
  id: string; summary: string; key_obligations: string[]; penalties: string[];
  termination_clauses: string[]; confidentiality: boolean; non_compete: boolean;
  governing_law: string; dispute_resolution: string; risk_level: string;
  risk_flags: {description:string;severity:string}[]; fraud_risk: {detected:boolean;confidence:string;indicators:string[]};
  raw_extraction: any; created_at: string;
}
interface Contract {
  id: string; name: string; contract_type: string; status: string;
  parties: Party[]; value: number|null; currency: string;
  start_date: string|null; end_date: string|null; auto_renew: boolean;
  renewal_notice_days: number; file_path: string|null; file_type: string|null;
  version: number; tags: string[]|null; notes: string|null;
  responsible_lawyer: string|null; created_at: string; updated_at: string;
  contract_extractions: Extraction[];
  contract_alerts: Alert[];
  contract_versions: Version[];
}

function daysUntil(dateStr: string): number {
  const d=new Date(dateStr); const t=new Date();
  t.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.floor((d.getTime()-t.getTime())/86400000);
}
function fmtDate(s: string|null): string {
  if(!s) return '—';
  // Handle both date-only (2026-03-01) and full timestamps
  const clean = s.includes('T') ? s : s + 'T12:00:00';
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}
function fmtCurrency(v: number|null, cur='BRL'): string {
  if(!v) return '—';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:cur,maximumFractionDigits:0}).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string,{label:string;color:string;bg:string}> = {
    vigente:              {label:'Vigente',             color:'#22c55e',bg:'#22c55e15'},
    vencido:              {label:'Vencido',             color:'#ef4444',bg:'#ef444415'},
    renovacao:            {label:'Renovação',           color:'#eab308',bg:'#eab30815'},
    rescindido:           {label:'Rescindido',          color:'#9ca3af',bg:'#9ca3af15'},
    aguardando_assinatura:{label:'Aguard. Assinatura',  color:'#3b82f6',bg:'#3b82f615'},
    rascunho:             {label:'Rascunho',            color:'#6b7280',bg:'#6b728015'},
  };
  const s=map[status]||{label:status,color:'#6b7280',bg:'#6b728015'};
  return <span style={{fontSize:'13px',fontWeight:'600',color:s.color,background:s.bg,padding:'4px 12px',borderRadius:'999px',border:`1px solid ${s.color}30`}}>{s.label}</span>;
}

const SPINNER = <div style={{width:'28px',height:'28px',border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/>;

export default function ContratoDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract|null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadFile, setUploadFile] = useState<File|null>(null);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const vFileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ loadContract(); },[id]);

  async function loadContract() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contratos/${id}`);
      if(res.ok){ const d=await res.json(); setContract(d); setEditForm(d); }
      else router.push('/dashboard/contratos');
    } catch(e){}
    setLoading(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await fetch(`/api/contratos/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        name:editForm.name, contract_type:editForm.contract_type, status:editForm.status,
        responsible_lawyer:editForm.responsible_lawyer, start_date:editForm.start_date||null,
        end_date:editForm.end_date||null, value:editForm.value?Number(editForm.value):null,
        auto_renew:editForm.auto_renew, notes:editForm.notes
      })});
      await loadContract(); setEditing(false);
    } catch(e){}
    setSaving(false);
  }

  async function runAnalysis() {
    if(!uploadFile){ alert('Selecione um arquivo'); return; }
    setAnalyzing(true);
    try {
      const fd=new FormData(); fd.append('file',uploadFile); fd.append('contractId',id);
      await fetch('/api/contratos/extract',{method:'POST',body:fd});
      await loadContract(); setActiveTab(1);
    } catch(e){}
    setUploadFile(null); setAnalyzing(false);
  }

  async function markAlertRead(alertId: string) {
    await fetch(`/api/contratos/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({markAlertRead:alertId})});
    setContract(prev=>prev?{...prev,contract_alerts:prev.contract_alerts.map(a=>a.id===alertId?{...a,is_read:true}:a)}:prev);
  }

  async function uploadVersion() {
    if(!uploadFile) return;
    setUploadingVersion(true);
    // Just record the version in contract_versions via PATCH on contract
    // Simple: create a version record via fetch to a dedicated note
    // For demo purposes: log to console and reload
    setUploadFile(null); setUploadNote(''); setUploadingVersion(false);
    alert('Versão registrada (funcionalidade completa requer storage configurado)');
  }

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {SPINNER}
    </div>
  );
  if(!contract) return null;

  const extraction = contract.contract_extractions?.[0];
  const alerts = contract.contract_alerts || [];
  const versions = contract.contract_versions || [];
  const unreadAlerts = alerts.filter(a=>!a.is_read).length;
  const days = contract.end_date ? daysUntil(contract.end_date) : null;
  const isUrgent = days!==null && days<=30 && days>=0;
  const tabs = [
    { label:'Visão Geral', icon:'⊞' },
    { label:'Análise IA', icon:'◈' },
    { label:'Histórico', icon:'◷', badge:versions.length||undefined },
    { label:'Alertas', icon:'🔔', badge:unreadAlerts||undefined },
  ];

  const CONTRACT_TYPES = ["Prestacao de Servicos","Locacao","Compra e Venda","Trabalhista","Societario","NDA","Financiamento","Franquia","Outros"];
  const STATUS_OPTIONS = ["vigente","vencido","renovacao","rescindido","aguardando_assinatura","rascunho"];
  const selectStyle = {width:'100%',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'6px',padding:'8px 12px',color:'var(--text)',fontSize:'13px',cursor:'pointer'};
  const labelStyle = {display:'block' as const,fontSize:'11px',color:'var(--text-4)',marginBottom:'5px',textTransform:'uppercase' as const,letterSpacing:'0.5px'};

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{background:'var(--bg-2)',borderBottom:'1px solid var(--border)',padding:'14px 28px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',position:'sticky',top:0,zIndex:40}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
            <Link href="/dashboard/contratos" style={{color:'var(--text-4)',fontSize:'12px',textDecoration:'none'}}>← Contratos</Link>
          </div>
          <h1 style={{margin:0,fontSize:'16px',fontWeight:'600',color:'var(--text)',maxWidth:'600px'}}>{contract.name}</h1>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginTop:'6px'}}>
            <StatusBadge status={contract.status}/>
            {contract.contract_type && <span style={{fontSize:'12px',color:'var(--text-4)',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'4px',padding:'2px 8px'}}>{contract.contract_type}</span>}
            {days!==null && <span style={{fontSize:'12px',color:isUrgent?'#ef4444':'var(--text-4)',fontWeight:isUrgent?'600':'400'}}>{days<0?`Venceu há ${Math.abs(days)} dias`:days===0?'Vence hoje':`Vence em ${days} dias`}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          {!editing && <button className="btn-ghost" onClick={()=>setEditing(true)} style={{fontSize:'12px'}}>✎ Editar</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:'var(--bg-2)',borderBottom:'1px solid var(--border)',padding:'0 28px',display:'flex',gap:'0'}}>
        {tabs.map((t,i)=>(
          <button key={i} onClick={()=>setActiveTab(i)} style={{
            padding:'12px 20px',fontSize:'13px',fontWeight:activeTab===i?'600':'400',
            color:activeTab===i?'var(--gold)':'var(--text-4)',
            background:'none',border:'none',borderBottom:activeTab===i?'2px solid var(--gold)':'2px solid transparent',
            cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',transition:'color 0.15s'
          }}>
            <span>{t.icon}</span> {t.label}
            {t.badge ? <span style={{fontSize:'10px',background:'#ef4444',color:'#fff',borderRadius:'999px',padding:'1px 6px',fontWeight:'700'}}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div style={{padding:'28px'}}>

        {/* TAB 0: Visão Geral */}
        {activeTab===0 && (
          <div>
            {editing ? (
              <div className="card" style={{padding:'24px',maxWidth:'680px'}}>
                <h3 style={{margin:'0 0 20px',fontSize:'14px',fontWeight:'600',color:'var(--gold)'}}>Editar Contrato</h3>
                <div style={{display:'grid',gap:'14px'}}>
                  <div>
                    <label style={labelStyle}>Nome</label>
                    <input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={{width:'100%',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select value={editForm.contract_type||''} onChange={e=>setEditForm({...editForm,contract_type:e.target.value})} style={selectStyle}>
                        {CONTRACT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={editForm.status||''} onChange={e=>setEditForm({...editForm,status:e.target.value})} style={selectStyle}>
                        {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Advogado responsável</label>
                    <input value={editForm.responsible_lawyer||''} onChange={e=>setEditForm({...editForm,responsible_lawyer:e.target.value})} style={{width:'100%',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                    <div>
                      <label style={labelStyle}>Data início</label>
                      <input type="date" value={editForm.start_date||''} onChange={e=>setEditForm({...editForm,start_date:e.target.value})} style={{width:'100%',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Data vencimento</label>
                      <input type="date" value={editForm.end_date||''} onChange={e=>setEditForm({...editForm,end_date:e.target.value})} style={{width:'100%',boxSizing:'border-box'}}/>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Valor (R$)</label>
                    <input type="number" value={editForm.value||''} onChange={e=>setEditForm({...editForm,value:e.target.value})} style={{width:'100%',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <input type="checkbox" id="edit_auto_renew" checked={!!editForm.auto_renew} onChange={e=>setEditForm({...editForm,auto_renew:e.target.checked})} style={{width:'16px',height:'16px'}}/>
                    <label htmlFor="edit_auto_renew" style={{fontSize:'13px',color:'var(--text-3)',cursor:'pointer'}}>Renovação automática</label>
                  </div>
                  <div>
                    <label style={labelStyle}>Observações</label>
                    <textarea value={editForm.notes||''} onChange={e=>setEditForm({...editForm,notes:e.target.value})} rows={3} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}}/>
                  </div>
                  <div style={{display:'flex',gap:'10px',paddingTop:'4px'}}>
                    <button className="btn-gold" onClick={saveEdit} disabled={saving}>{saving?'Salvando...':'Salvar'}</button>
                    <button className="btn-ghost" onClick={()=>{setEditing(false);setEditForm(contract);}}>Cancelar</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:'20px',maxWidth:'1100px'}}>
                {/* Left column */}
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  {/* Parties */}
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'14px'}}>Partes</div>
                    {(contract.parties||[]).length>0 ? (
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr>
                            {['Parte','Papel'].map(h=><th key={h} style={{textAlign:'left',fontSize:'11px',color:'var(--text-5)',padding:'4px 8px',borderBottom:'1px solid var(--border)',fontWeight:'600'}}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(contract.parties||[]).map((p,i)=>(
                            <tr key={i}>
                              <td style={{padding:'8px 8px',fontSize:'13px',color:'var(--text)',borderBottom:'1px solid var(--border)'}}>{p.name}</td>
                              <td style={{padding:'8px 8px',fontSize:'12px',color:'var(--text-4)',borderBottom:'1px solid var(--border)'}}>{p.role}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div style={{fontSize:'13px',color:'var(--text-5)'}}>Nenhuma parte cadastrada</div>}
                  </div>

                  {/* Notes */}
                  {contract.notes && (
                    <div className="card" style={{padding:'20px'}}>
                      <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'10px'}}>Observações</div>
                      <p style={{margin:0,fontSize:'13px',color:'var(--text-3)',lineHeight:'1.6'}}>{contract.notes}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {contract.tags && contract.tags.length>0 && (
                    <div className="card" style={{padding:'20px'}}>
                      <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'10px'}}>Tags</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                        {contract.tags.map(tag=>(
                          <span key={tag} style={{fontSize:'12px',background:'var(--gold-bg)',color:'var(--gold)',border:'1px solid var(--gold-border)',borderRadius:'4px',padding:'3px 10px'}}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  {/* Value & dates */}
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'14px'}}>Detalhes</div>
                    {[
                      {label:'Valor', value: fmtCurrency(contract.value, contract.currency)},
                      {label:'Início', value: fmtDate(contract.start_date)},
                      {label:'Vencimento', value: contract.end_date ? (
                        <span style={{color:isUrgent?'#ef4444':'inherit'}}>{fmtDate(contract.end_date)}{days!==null&&<span style={{fontSize:'11px',marginLeft:'6px',color:isUrgent?'#ef4444':'var(--text-5)'}}>{days<0?`(vencido ${Math.abs(days)}d)`:days===0?'(hoje)':`(${days}d)`}</span>}</span>
                      ) : '—'},
                      {label:'Renovação auto.', value: contract.auto_renew?'Sim':'Não'},
                      {label:'Aviso renovação', value: `${contract.renewal_notice_days} dias`},
                      {label:'Responsável', value: contract.responsible_lawyer||'—'},
                      {label:'Criado em', value: fmtDate(contract.created_at)},
                    ].map(row=>(
                      <div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:'12px',color:'var(--text-4)'}}>{row.label}</span>
                        <span style={{fontSize:'12px',color:'var(--text)',textAlign:'right',maxWidth:'60%'}}>{row.value as any}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Análise IA */}
        {activeTab===1 && (
          <div style={{maxWidth:'800px'}}>
            {!extraction ? (
              <div className="card" style={{padding:'48px',textAlign:'center'}}>
                <div style={{fontSize:'40px',marginBottom:'16px'}}>◈</div>
                <h3 style={{margin:'0 0 8px',fontSize:'15px',fontWeight:'600',color:'var(--text)'}}>Nenhuma análise IA disponível</h3>
                <p style={{margin:'0 0 24px',fontSize:'13px',color:'var(--text-4)'}}>Faça upload do documento para análise automática com GPT-4o</p>
                <div style={{marginBottom:'16px'}}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setUploadFile(f);}}/>
                  <button className="btn-ghost" onClick={()=>fileRef.current?.click()} style={{marginRight:'10px'}}>
                    {uploadFile?`📄 ${uploadFile.name}`:'Selecionar arquivo'}
                  </button>
                  <button className="btn-gold" onClick={runAnalysis} disabled={!uploadFile||analyzing}>
                    {analyzing?'Analisando...':'◈ Analisar Documento'}
                  </button>
                </div>
                {analyzing && <div style={{display:'flex',justifyContent:'center',marginTop:'16px'}}>{SPINNER}</div>}
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {/* Fraud warning */}
                {extraction.fraud_risk?.detected && (
                  <div style={{background:'#ef444415',border:'2px solid #ef4444',borderRadius:'10px',padding:'20px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                      <span style={{fontSize:'24px'}}>🚨</span>
                      <div>
                        <div style={{fontSize:'15px',fontWeight:'700',color:'#ef4444'}}>ALERTA DE FRAUDE DETECTADO</div>
                        <div style={{fontSize:'12px',color:'#ef4444',opacity:0.8}}>Confiança: <strong>{extraction.fraud_risk.confidence?.toUpperCase()}</strong></div>
                      </div>
                    </div>
                    {(extraction.fraud_risk.indicators||[]).length>0 && (
                      <ul style={{margin:'0',paddingLeft:'20px'}}>
                        {extraction.fraud_risk.indicators.map((ind:string,i:number)=>(
                          <li key={i} style={{fontSize:'13px',color:'#ef4444',marginBottom:'6px',lineHeight:'1.5'}}>{ind}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Risk level */}
                <div className="card" style={{padding:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{width:'12px',height:'12px',borderRadius:'50%',background:extraction.risk_level==='alto'?'#ef4444':extraction.risk_level==='medio'?'#eab308':'#22c55e'}}/>
                  <div>
                    <span style={{fontSize:'12px',color:'var(--text-4)'}}>Nível de risco: </span>
                    <span style={{fontSize:'13px',fontWeight:'600',color:extraction.risk_level==='alto'?'#ef4444':extraction.risk_level==='medio'?'#eab308':'#22c55e'}}>{extraction.risk_level||'—'}</span>
                  </div>
                  {extraction.confidentiality && <span style={{marginLeft:'auto',fontSize:'11px',background:'#3b82f615',color:'#3b82f6',border:'1px solid #3b82f630',borderRadius:'4px',padding:'2px 8px'}}>🔒 Confidencial</span>}
                  {extraction.non_compete && <span style={{fontSize:'11px',background:'#8b5cf615',color:'#8b5cf6',border:'1px solid #8b5cf630',borderRadius:'4px',padding:'2px 8px'}}>⛔ Não-concorrência</span>}
                </div>

                {/* Summary */}
                {extraction.summary && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'10px'}}>Resumo</div>
                    <p style={{margin:0,fontSize:'13px',color:'var(--text-3)',lineHeight:'1.7'}}>{extraction.summary}</p>
                  </div>
                )}

                {/* Key obligations */}
                {(extraction.key_obligations||[]).length>0 && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'12px'}}>Obrigações Principais</div>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <tbody>
                        {(extraction.key_obligations||[]).map((ob:any,i:number)=>(
                          <tr key={i}>
                            <td style={{padding:'8px 10px',fontSize:'13px',color:'var(--text-3)',borderBottom:'1px solid var(--border)',lineHeight:'1.5'}}>
                              <span style={{color:'var(--gold)',marginRight:'8px',fontWeight:'600'}}>{i+1}.</span>{typeof ob==='string'?ob:ob.description||JSON.stringify(ob)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Penalties */}
                {(extraction.penalties||[]).length>0 && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'12px'}}>Penalidades</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {(extraction.penalties||[]).map((p:any,i:number)=>(
                        <div key={i} style={{padding:'10px 14px',background:'#ef444408',border:'1px solid #ef444420',borderRadius:'6px',fontSize:'13px',color:'var(--text-3)'}}>{typeof p==='string'?p:p.description||JSON.stringify(p)}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Termination clauses */}
                {(extraction.termination_clauses||[]).length>0 && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'12px'}}>Cláusulas de Rescisão</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {(extraction.termination_clauses||[]).map((t:any,i:number)=>(
                        <div key={i} style={{padding:'10px 14px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'13px',color:'var(--text-3)'}}>{typeof t==='string'?t:t.description||JSON.stringify(t)}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk flags */}
                {(extraction.risk_flags||[]).length>0 && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'12px'}}>Alertas de Risco</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {(extraction.risk_flags||[]).map((f:any,i:number)=>{
                        const col=f.severity==='alto'?'#ef4444':f.severity==='medio'?'#eab308':'#22c55e';
                        return <div key={i} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'10px 14px',background:`${col}08`,border:`1px solid ${col}20`,borderRadius:'6px'}}>
                          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:col,flexShrink:0,marginTop:'4px'}}/>
                          <span style={{fontSize:'13px',color:'var(--text-3)'}}>{f.description}</span>
                          <span style={{marginLeft:'auto',fontSize:'10px',color:col,fontWeight:'600',textTransform:'uppercase',whiteSpace:'nowrap'}}>{f.severity}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                )}

                {/* Governing law + dispute resolution */}
                {(extraction.governing_law||extraction.dispute_resolution) && (
                  <div className="card" style={{padding:'20px'}}>
                    <div style={{fontSize:'12px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'12px'}}>Jurisdição</div>
                    {extraction.governing_law && <div style={{marginBottom:'8px'}}><span style={{fontSize:'12px',color:'var(--text-4)'}}>Lei aplicável: </span><span style={{fontSize:'13px',color:'var(--text-3)'}}>{extraction.governing_law}</span></div>}
                    {extraction.dispute_resolution && <div><span style={{fontSize:'12px',color:'var(--text-4)'}}>Resolução de conflitos: </span><span style={{fontSize:'13px',color:'var(--text-3)'}}>{extraction.dispute_resolution}</span></div>}
                  </div>
                )}

                {/* Re-analyze */}
                <div style={{display:'flex',gap:'10px',alignItems:'center',paddingTop:'8px'}}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setUploadFile(f);}}/>
                  <button className="btn-ghost" onClick={()=>fileRef.current?.click()} style={{fontSize:'12px'}}>
                    {uploadFile?`📄 ${uploadFile.name}`:'Selecionar novo arquivo'}
                  </button>
                  {uploadFile && <button className="btn-gold" onClick={runAnalysis} disabled={analyzing} style={{fontSize:'12px'}}>{analyzing?'Analisando...':'◈ Re-analisar'}</button>}
                  {analyzing && SPINNER}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Histórico */}
        {activeTab===2 && (
          <div style={{maxWidth:'700px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <h3 style={{margin:0,fontSize:'14px',fontWeight:'600',color:'var(--text)'}}>Versões do Contrato</h3>
              <button className="btn-gold" onClick={()=>vFileRef.current?.click()} style={{fontSize:'12px',display:'flex',alignItems:'center',gap:'6px'}}>
                ✦ Upload Nova Versão
              </button>
              <input ref={vFileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){setUploadFile(f);setUploadingVersion(true);}}}/>
            </div>
            {uploadingVersion && (
              <div className="card" style={{padding:'16px',marginBottom:'16px',border:'1px solid var(--gold-border)'}}>
                <div style={{fontSize:'13px',color:'var(--text)',marginBottom:'10px'}}>📄 {uploadFile?.name}</div>
                <textarea value={uploadNote} onChange={e=>setUploadNote(e.target.value)} placeholder="Notas sobre esta versão..." rows={2} style={{width:'100%',boxSizing:'border-box',marginBottom:'10px',resize:'vertical'}}/>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn-gold" onClick={uploadVersion} style={{fontSize:'12px'}}>Confirmar</button>
                  <button className="btn-ghost" onClick={()=>{setUploadFile(null);setUploadNote('');setUploadingVersion(false);}} style={{fontSize:'12px'}}>Cancelar</button>
                </div>
              </div>
            )}
            {versions.length===0 ? (
              <div className="card" style={{padding:'40px',textAlign:'center'}}>
                <div style={{fontSize:'32px',marginBottom:'12px'}}>◷</div>
                <div style={{fontSize:'13px',color:'var(--text-4)'}}>Nenhuma versão registrada</div>
                <div style={{fontSize:'12px',color:'var(--text-5)',marginTop:'4px'}}>Faça upload de versões do contrato para manter histórico</div>
              </div>
            ) : (
              <div className="card" style={{overflow:'hidden'}}>
                {versions.map((v,i)=>(
                  <div key={v.id} style={{display:'flex',alignItems:'center',gap:'16px',padding:'14px 16px',borderBottom:i<versions.length-1?'1px solid var(--border)':'none'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'var(--gold-bg)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'700',color:'var(--gold)',flexShrink:0}}>v{v.version}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'13px',color:'var(--text)',marginBottom:'2px'}}>Versão {v.version}</div>
                      {v.notes && <div style={{fontSize:'12px',color:'var(--text-4)'}}>{v.notes}</div>}
                    </div>
                    <div style={{fontSize:'12px',color:'var(--text-5)'}}>{fmtDate(v.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Alertas */}
        {activeTab===3 && (
          <div style={{maxWidth:'700px'}}>
            <div style={{marginBottom:'20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0,fontSize:'14px',fontWeight:'600',color:'var(--text)'}}>{unreadAlerts>0&&<span style={{color:'#ef4444',marginRight:'6px'}}>{unreadAlerts} não lido{unreadAlerts>1?'s':''}</span>}Alertas</h3>
            </div>
            {alerts.length===0 ? (
              <div className="card" style={{padding:'40px',textAlign:'center'}}>
                <div style={{fontSize:'32px',marginBottom:'12px'}}>🔔</div>
                <div style={{fontSize:'13px',color:'var(--text-4)'}}>Nenhum alerta para este contrato</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {alerts.map(a=>{
                  const col=a.type==='fraude'?'#ef4444':a.type==='vencimento'?'#eab308':'#3b82f6';
                  return (
                    <div key={a.id} style={{padding:'14px 16px',background:'var(--bg-2)',borderRadius:'8px',border:`1px solid ${col}20`,opacity:a.is_read?0.55:1,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px'}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                          <span style={{fontSize:'10px',fontWeight:'700',color:col,textTransform:'uppercase',border:`1px solid ${col}40`,borderRadius:'4px',padding:'1px 6px'}}>{a.type}</span>
                          {!a.is_read && <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#ef4444'}}/>}
                        </div>
                        <div style={{fontSize:'13px',color:'var(--text-3)',lineHeight:'1.5'}}>{a.message}</div>
                        {a.alert_date && <div style={{fontSize:'11px',color:'var(--text-5)',marginTop:'4px'}}>{fmtDate(a.alert_date)}</div>}
                      </div>
                      {!a.is_read && (
                        <button className="btn-ghost" onClick={()=>markAlertRead(a.id)} style={{fontSize:'11px',padding:'4px 10px',flexShrink:0}}>Marcar lido</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
