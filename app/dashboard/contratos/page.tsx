"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Party { name: string; role: string }
interface Extraction { id: string; risk_level: string; summary: string; fraud_risk?: any }
interface Contract {
  id: string; name: string; contract_type: string; status: string;
  parties: Party[]; value: number | null; currency: string;
  start_date: string | null; end_date: string | null;
  auto_renew: boolean; responsible_lawyer: string | null;
  created_at: string; contract_extractions: Extraction[];
}

const CONTRACT_TYPES = ["Prestacao de Servicos","Locacao","Compra e Venda","Trabalhista","Societario","NDA","Financiamento","Franquia","Outros"];
const STATUS_OPTIONS = ["vigente","vencido","renovacao","rescindido","aguardando_assinatura","rascunho"];
const RISK_OPTIONS = ["alto","medio","baixo"];

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr); const t = new Date();
  t.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.floor((d.getTime()-t.getTime())/(86400000));
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string,{label:string;color:string;bg:string}> = {
    vigente:              { label:'Vigente',              color:'#22c55e', bg:'#22c55e15' },
    vencido:              { label:'Vencido',              color:'#ef4444', bg:'#ef444415' },
    renovacao:            { label:'Renovação',            color:'#eab308', bg:'#eab30815' },
    rescindido:           { label:'Rescindido',           color:'#9ca3af', bg:'#9ca3af15' },
    aguardando_assinatura:{ label:'Aguard. Assinatura',   color:'#3b82f6', bg:'#3b82f615' },
    rascunho:             { label:'Rascunho',             color:'#6b7280', bg:'#6b728015' },
  };
  const s = map[status] || { label: status, color:'#6b7280', bg:'#6b728015' };
  return (
    <span style={{ fontSize:'11px', fontWeight:'600', color:s.color, background:s.bg,
      padding:'2px 8px', borderRadius:'999px', border:`1px solid ${s.color}30`, whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  );
}

function RiskDot({ level }: { level?: string }) {
  const color = level==='alto'?'#ef4444':level==='medio'?'#eab308':level==='baixo'?'#22c55e':'#6b7280';
  return <span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:color,flexShrink:0}} title={level||'—'}/>;
}

const SPINNER = <div style={{width:'24px',height:'24px',border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />;

export default function ContratosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRisk, setFilterRisk] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:'', contract_type:'Prestacao de Servicos', status:'rascunho', responsible_lawyer:'', start_date:'', end_date:'', value:'', auto_renew:false, notes:'' });
  const [file, setFile] = useState<File|null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [modalError, setModalError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadContracts(); }, []);

  async function loadContracts() {
    setLoading(true);
    try {
      const res = await fetch('/api/contratos');
      if (res.ok) setContracts(await res.json());
    } catch(e) {}
    setLoading(false);
  }

  // Stats
  const today = new Date(); today.setHours(0,0,0,0);
  const total = contracts.length;
  const vigentes = contracts.filter(c=>c.status==='vigente').length;
  const vencendo30 = contracts.filter(c=>{
    if(!c.end_date||c.status==='vencido') return false;
    const d=daysUntil(c.end_date); return d>=0&&d<=30;
  }).length;
  const valorTotal = contracts.reduce((sum,c)=>sum+(c.value||0),0);

  // Filtered list
  const filtered = contracts.filter(c=>{
    const q = search.toLowerCase();
    if(q && !c.name.toLowerCase().includes(q) && !JSON.stringify(c.parties||[]).toLowerCase().includes(q)) return false;
    if(filterStatus && c.status!==filterStatus) return false;
    if(filterType && c.contract_type!==filterType) return false;
    if(filterRisk) {
      const rl = c.contract_extractions?.[0]?.risk_level;
      if(rl!==filterRisk) return false;
    }
    return true;
  });

  function resetModal() {
    setStep(1); setFile(null); setExtractionResult(null); setModalError('');
    setForm({name:'',contract_type:'Prestacao de Servicos',status:'rascunho',responsible_lawyer:'',start_date:'',end_date:'',value:'',auto_renew:false,notes:''});
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if(f) setFile(f);
  }

  async function runAnalysis() {
    if(!file){ setModalError('Selecione um arquivo.'); return; }
    setAnalyzing(true); setStep(3); setModalError('');
    try {
      // 1. Create contract
      const body: any = { name: form.name, contract_type: form.contract_type, status: form.status };
      if(form.responsible_lawyer) body.responsible_lawyer = form.responsible_lawyer;
      if(form.start_date) body.start_date = form.start_date;
      if(form.end_date) body.end_date = form.end_date;
      if(form.value) body.value = parseFloat(form.value);
      body.auto_renew = form.auto_renew;
      if(form.notes) body.notes = form.notes;

      const cRes = await fetch('/api/contratos',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!cRes.ok){ const e=await cRes.json(); throw new Error(e.error||'Erro ao criar contrato'); }
      const contract = await cRes.json();

      // 2. Extract
      const fd = new FormData();
      fd.append('file', file);
      fd.append('contractId', contract.id);
      const eRes = await fetch('/api/contratos/extract',{ method:'POST', body:fd });
      if(!eRes.ok){ const e=await eRes.json(); throw new Error(e.error||'Erro na extração'); }
      const { extraction } = await eRes.json();
      setExtractionResult({ contract, extraction });
    } catch(err:any) {
      setModalError(err.message);
      setStep(2);
    }
    setAnalyzing(false);
  }

  function closeModal() {
    setShowModal(false); resetModal();
    loadContracts();
  }

  const selectStyle = { width:'100%', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'13px', cursor:'pointer' };
  const labelStyle = { display:'block' as const, fontSize:'11px', color:'var(--text-3)', marginBottom:'5px', textTransform:'uppercase' as const, letterSpacing:'0.5px', fontWeight:'600' as const };
  const inputStyle = { width:'100%', boxSizing:'border-box' as const };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{background:'var(--bg-2)',borderBottom:'1px solid var(--border)',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:40}}>
        <div>
          <h1 style={{margin:0,fontSize:'16px',fontWeight:'600',color:'var(--text)'}}>▤ Contratos</h1>
          <p style={{margin:0,fontSize:'12px',color:'var(--text-4)'}}>Repositório de contratos com análise IA</p>
        </div>
        <button className="btn-gold" onClick={()=>{resetModal();setShowModal(true);}} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 18px',fontSize:'13px'}}>
          ✦ Novo Contrato
        </button>
      </div>

      <div style={{padding:'24px 28px'}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
          {[
            {label:'Total Contratos',value:String(total),color:'var(--gold)'},
            {label:'Vigentes',value:String(vigentes),color:'#22c55e'},
            {label:'Vencendo em 30 dias',value:String(vencendo30),color:vencendo30>0?'#ef4444':'var(--text-4)'},
            {label:'Valor Total',value:valorTotal>0?fmtCurrency(valorTotal):'—',color:'#3b82f6'},
          ].map(s=>(
            <div key={s.label} className="card" style={{padding:'16px'}}>
              <div style={{fontSize:'11px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600',marginBottom:'8px'}}>{s.label}</div>
              <div style={{fontSize:'26px',fontWeight:'700',color:s.color,lineHeight:1}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{display:'flex',gap:'10px',marginBottom:'20px',flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, partes..." style={{flex:'1',minWidth:'200px',height:'36px',padding:'0 12px',fontSize:'13px'}} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...selectStyle,width:'auto',height:'36px',fontSize:'12px'}}>
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{...selectStyle,width:'auto',height:'36px',fontSize:'12px'}}>
            <option value="">Todos os tipos</option>
            {CONTRACT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterRisk} onChange={e=>setFilterRisk(e.target.value)} style={{...selectStyle,width:'auto',height:'36px',fontSize:'12px'}}>
            <option value="">Todo risco</option>
            {RISK_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          {(search||filterStatus||filterType||filterRisk) && (
            <button className="btn-ghost" style={{height:'36px',fontSize:'12px'}} onClick={()=>{setSearch('');setFilterStatus('');setFilterType('');setFilterRisk('');}}>✕ Limpar</button>
          )}
        </div>

        {/* Contract list */}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'60px'}}>{SPINNER}</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{padding:'60px',textAlign:'center'}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>▤</div>
            <div style={{fontSize:'16px',fontWeight:'600',color:'var(--text)',marginBottom:'8px'}}>
              {contracts.length===0?'Nenhum contrato ainda':'Nenhum resultado encontrado'}
            </div>
            <p style={{color:'var(--text-4)',fontSize:'13px',margin:'0 0 20px'}}>
              {contracts.length===0?'Clique em "Novo Contrato" para adicionar seu primeiro contrato.':'Tente ajustar os filtros de busca.'}
            </p>
            {contracts.length===0 && (
              <button className="btn-gold" onClick={()=>{resetModal();setShowModal(true);}}>✦ Adicionar Contrato</button>
            )}
          </div>
        ) : (
          <div className="card" style={{overflow:'hidden'}}>
            {/* Table header */}
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.4fr 1fr 1fr 80px',gap:'0',borderBottom:'1px solid var(--border)',padding:'10px 16px',background:'var(--bg-2)'}}>
              {['Contrato','Tipo','Partes','Status','Vencimento','Risco'].map(h=>(
                <div key={h} style={{fontSize:'11px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:'600'}}>{h}</div>
              ))}
            </div>
            {filtered.map((c,i)=>{
              const extraction = c.contract_extractions?.[0];
              const parties = (c.parties||[]).slice(0,2);
              const days = c.end_date ? daysUntil(c.end_date) : null;
              const isUrgent = days!==null && days<=30 && days>=0;
              return (
                <div key={c.id} onClick={()=>router.push(`/dashboard/contratos/${c.id}`)}
                  style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.4fr 1fr 1fr 80px',gap:'0',
                    padding:'14px 16px',borderBottom:i<filtered.length-1?'1px solid var(--border)':'none',
                    cursor:'pointer',transition:'background 0.15s',alignItems:'center'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-2)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  {/* Name */}
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'var(--text)',marginBottom:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'280px'}}>{c.name}</div>
                    {c.responsible_lawyer && <div style={{fontSize:'11px',color:'var(--text-5)'}}>{c.responsible_lawyer}</div>}
                  </div>
                  {/* Type */}
                  <div>
                    <span style={{fontSize:'11px',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'4px',padding:'2px 6px',color:'var(--text-3)',whiteSpace:'nowrap'}}>
                      {c.contract_type||'—'}
                    </span>
                  </div>
                  {/* Parties */}
                  <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    {parties.length>0 ? parties.map((p,pi)=>(
                      <div key={pi} style={{fontSize:'11px',color:'var(--text-3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'180px'}}>
                        <span style={{color:'var(--text-4)'}}>{p.role}: </span>{p.name}
                      </div>
                    )) : <span style={{fontSize:'11px',color:'var(--text-5)'}}>—</span>}
                    {(c.parties||[]).length>2 && <span style={{fontSize:'10px',color:'var(--text-5)'}}>+{(c.parties||[]).length-2} partes</span>}
                  </div>
                  {/* Status */}
                  <div><StatusBadge status={c.status}/></div>
                  {/* End date */}
                  <div>
                    {c.end_date ? (
                      <div>
                        <div style={{fontSize:'12px',color:isUrgent?'#ef4444':'var(--text-3)'}}>{new Date(c.end_date+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                        {days!==null && (
                          <div style={{fontSize:'11px',color:isUrgent?'#ef4444':days<0?'#6b7280':'var(--text-5)',fontWeight:isUrgent?'600':'400'}}>
                            {days<0?`${Math.abs(days)}d atrás`:days===0?'Hoje':`${days}d`}
                          </div>
                        )}
                      </div>
                    ) : <span style={{fontSize:'11px',color:'var(--text-5)'}}>Indeterminado</span>}
                  </div>
                  {/* Risk */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <RiskDot level={extraction?.risk_level}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
          <div className="card" style={{width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto',padding:'28px',position:'relative'}}>
            <button onClick={closeModal} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',color:'var(--text-4)',cursor:'pointer',fontSize:'20px',lineHeight:1}}>✕</button>

            {/* Step indicator */}
            <div style={{display:'flex',gap:'8px',marginBottom:'24px',alignItems:'center'}}>
              {[1,2,3].map(n=>(
                <div key={n} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',
                    background:step>=n?'var(--gold)':'var(--bg-3)',color:step>=n?'#000':'var(--text-4)',border:`1px solid ${step>=n?'var(--gold)':'var(--border)'}`}}>
                    {n}
                  </div>
                  {n<3 && <div style={{width:'32px',height:'2px',background:step>n?'var(--gold)':'var(--border)'}}/>}
                </div>
              ))}
              <span style={{fontSize:'12px',color:'var(--text-4)',marginLeft:'8px'}}>
                {step===1?'Informações':step===2?'Documento':analyzing?'Analisando...':'Resultado'}
              </span>
            </div>

            {/* Step 1: Metadata */}
            {step===1 && (
              <div>
                <h2 style={{margin:'0 0 20px',fontSize:'15px',fontWeight:'600',color:'var(--text)'}}>✦ Novo Contrato — Informações</h2>
                <div style={{marginBottom:'14px'}}>
                  <label style={labelStyle}>Nome do contrato *</label>
                  <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Contrato de Prestação de Serviços — Cliente X" style={inputStyle}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select value={form.contract_type} onChange={e=>setForm({...form,contract_type:e.target.value})} style={selectStyle}>
                      {CONTRACT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={selectStyle}>
                      {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:'14px'}}>
                  <label style={labelStyle}>Advogado responsável</label>
                  <input value={form.responsible_lawyer} onChange={e=>setForm({...form,responsible_lawyer:e.target.value})} placeholder="Ex: Dr. Cristiano Gimenez" style={inputStyle}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
                  <div>
                    <label style={labelStyle}>Data de início</label>
                    <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Data de vencimento</label>
                    <input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} style={inputStyle}/>
                  </div>
                </div>
                <div style={{marginBottom:'14px'}}>
                  <label style={labelStyle}>Valor (R$)</label>
                  <input type="number" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} placeholder="Ex: 150000" style={inputStyle}/>
                </div>
                <div style={{marginBottom:'14px',display:'flex',alignItems:'center',gap:'10px'}}>
                  <input type="checkbox" id="auto_renew" checked={form.auto_renew} onChange={e=>setForm({...form,auto_renew:e.target.checked})} style={{width:'16px',height:'16px',cursor:'pointer'}}/>
                  <label htmlFor="auto_renew" style={{fontSize:'13px',color:'var(--text-3)',cursor:'pointer'}}>Renovação automática</label>
                </div>
                <div style={{marginBottom:'20px'}}>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={3} placeholder="Notas internas..." style={{width:'100%',boxSizing:'border-box',resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                  <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button className="btn-gold" onClick={()=>{if(!form.name.trim()){alert('Nome obrigatório');return;}setStep(2);}} style={{gap:'6px'}}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: File upload */}
            {step===2 && (
              <div>
                <h2 style={{margin:'0 0 20px',fontSize:'15px',fontWeight:'600',color:'var(--text)'}}>Anexar Documento</h2>
                <div
                  onDragOver={e=>{e.preventDefault();setDragging(true);}}
                  onDragLeave={()=>setDragging(false)}
                  onDrop={handleDrop}
                  onClick={()=>fileRef.current?.click()}
                  style={{border:`2px dashed ${dragging?'var(--gold)':'var(--border)'}`,borderRadius:'10px',padding:'48px 24px',
                    textAlign:'center',cursor:'pointer',background:dragging?'var(--gold-bg)':'var(--bg-2)',transition:'all 0.15s',marginBottom:'16px'}}>
                  <div style={{fontSize:'36px',marginBottom:'12px'}}>📄</div>
                  {file ? (
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'600',color:'var(--gold)',marginBottom:'4px'}}>{file.name}</div>
                      <div style={{fontSize:'12px',color:'var(--text-4)'}}>{(file.size/1024).toFixed(0)} KB · clique para trocar</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:'14px',color:'var(--text-3)',marginBottom:'6px'}}>Arraste ou clique para selecionar</div>
                      <div style={{fontSize:'12px',color:'var(--text-5)'}}>PDF, DOCX, TXT</div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f);}}/>
                </div>
                {modalError && <div style={{padding:'10px 14px',background:'#ef444415',border:'1px solid #ef444430',borderRadius:'6px',color:'#ef4444',fontSize:'12px',marginBottom:'14px'}}>{modalError}</div>}
                <div style={{display:'flex',gap:'10px',justifyContent:'space-between'}}>
                  <button className="btn-ghost" onClick={()=>setStep(1)}>← Voltar</button>
                  <div style={{display:'flex',gap:'10px'}}>
                    <button className="btn-ghost" onClick={()=>{ /* Create without file */ runAnalysis(); }} style={{fontSize:'12px'}}>Pular análise</button>
                    <button className="btn-gold" onClick={runAnalysis} disabled={!file} style={{opacity:file?1:0.5}}>
                      Analisar com IA →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Analysis result */}
            {step===3 && (
              <div>
                <h2 style={{margin:'0 0 20px',fontSize:'15px',fontWeight:'600',color:'var(--text)'}}>Análise IA</h2>
                {analyzing ? (
                  <div style={{textAlign:'center',padding:'48px 24px'}}>
                    <div style={{marginBottom:'20px',display:'flex',justifyContent:'center'}}>{SPINNER}</div>
                    <div style={{fontSize:'14px',color:'var(--text-3)',marginBottom:'8px'}}>IA analisando contrato...</div>
                    <div style={{fontSize:'12px',color:'var(--text-5)'}}>Extraindo cláusulas, partes, datas e riscos</div>
                  </div>
                ) : extractionResult ? (
                  <div>
                    <div style={{background:'var(--bg-2)',borderRadius:'8px',padding:'16px',marginBottom:'16px',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:'11px',color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px',fontWeight:'600'}}>Resumo</div>
                      <p style={{margin:0,fontSize:'13px',color:'var(--text-3)',lineHeight:'1.6'}}>{extractionResult.extraction?.summary||'—'}</p>
                    </div>
                    {extractionResult.extraction?.risk_level && (
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'12px 16px',background:'var(--bg-2)',borderRadius:'8px',border:'1px solid var(--border)'}}>
                        <RiskDot level={extractionResult.extraction.risk_level}/>
                        <div>
                          <span style={{fontSize:'12px',color:'var(--text-4)'}}>Nível de risco: </span>
                          <span style={{fontSize:'12px',fontWeight:'600',color:extractionResult.extraction.risk_level==='alto'?'#ef4444':extractionResult.extraction.risk_level==='medio'?'#eab308':'#22c55e'}}>{extractionResult.extraction.risk_level}</span>
                        </div>
                        {extractionResult.extraction?.fraud_risk?.detected && (
                          <span style={{marginLeft:'auto',fontSize:'11px',background:'#ef444415',color:'#ef4444',border:'1px solid #ef444430',borderRadius:'4px',padding:'2px 8px',fontWeight:'600'}}>🚨 Fraude detectada</span>
                        )}
                      </div>
                    )}
                    {modalError && <div style={{padding:'10px 14px',background:'#ef444415',border:'1px solid #ef444430',borderRadius:'6px',color:'#ef4444',fontSize:'12px',marginBottom:'14px'}}>{modalError}</div>}
                    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'20px'}}>
                      <button className="btn-ghost" onClick={closeModal}>Fechar</button>
                      <button className="btn-gold" onClick={()=>{
                        router.push(`/dashboard/contratos/${extractionResult.contract.id}`);
                        setShowModal(false);
                      }}>
                        Ver Contrato →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{textAlign:'center',padding:'40px'}}>
                    <div style={{color:'#ef4444',marginBottom:'12px'}}>Erro na análise</div>
                    <div style={{fontSize:'12px',color:'var(--text-4)',marginBottom:'16px'}}>{modalError}</div>
                    <button className="btn-gold" onClick={()=>setStep(2)}>← Tentar novamente</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
