"use client";
import { useState } from "react";

const SCHEMA_SQL = `-- Notorious AI — Schema Migration
-- Paste this in: supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new

create extension if not exists "uuid-ossp";

create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid references public.firms(id),
  email text, name text, role text default 'advogado',
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  name text not null, area text not null,
  status text default 'ativo', risk_level text default 'baixo',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  firm_id uuid references public.firms(id),
  name text not null, file_path text, file_type text,
  upload_status text default 'uploaded', ai_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  doc_type text, parties jsonb, key_dates jsonb, deadlines jsonb,
  risk_flags jsonb, summary text, raw_extraction jsonb,
  created_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id),
  role text not null, content text not null,
  created_at timestamptz default now()
);

create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  project_id uuid references public.projects(id),
  document_id uuid references public.documents(id),
  type text, message text, is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_alerts enable row level security;

create policy "firm_access" on public.firms for all using (id in (select firm_id from public.users where id = auth.uid()));
create policy "user_self" on public.users for all using (id = auth.uid());
create policy "user_insert" on public.users for insert with check (true);
create policy "projects_firm" on public.projects for all using (firm_id in (select firm_id from public.users where id = auth.uid()));
create policy "documents_firm" on public.documents for all using (firm_id in (select firm_id from public.users where id = auth.uid()));
create policy "extractions_firm" on public.document_extractions for all using (document_id in (select d.id from public.documents d join public.users u on d.firm_id = u.firm_id where u.id = auth.uid()));
create policy "chat_firm" on public.chat_messages for all using (project_id in (select p.id from public.projects p join public.users u on p.firm_id = u.firm_id where u.id = auth.uid()));
create policy "alerts_firm" on public.ai_alerts for all using (firm_id in (select firm_id from public.users where id = auth.uid()));`;

export default function SetupPage() {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(SCHEMA_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
      <div style={{ maxWidth:'800px', width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <h1 style={{ color:'#fff', fontSize:'24px', margin:'0 0 8px' }}>Notorious <span style={{ color:'#C9A84C' }}>AI</span> — Setup</h1>
          <p style={{ color:'#666', fontSize:'13px', margin:0 }}>Apply the database schema to activate the app</p>
        </div>
        <div style={{ background:'#141414', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'32px' }}>
          <h2 style={{ color:'#C9A84C', margin:'0 0 20px', fontSize:'15px' }}>Instructions</h2>
          {[
            '1. Open: supabase.com/dashboard/project/fbgqzouxbagmmlzibyhl/sql/new',
            '2. Copy the SQL below',
            '3. Paste it in the Supabase SQL Editor and click Run',
            '4. Come back and go to /login to create your account',
          ].map((s,i) => <div key={i} style={{ padding:'10px 14px', background:'#1a1a1a', borderRadius:'6px', border:'1px solid #2a2a2a', fontSize:'12px', color:'#ccc', marginBottom:'8px' }}>{s}</div>)}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'20px 0 10px' }}>
            <span style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px' }}>Migration SQL</span>
            <button onClick={copy} style={{ padding:'7px 16px', background:copied?'#22c55e':'#C9A84C', color:'#000', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
              {copied ? '✓ Copied!' : 'Copy SQL'}
            </button>
          </div>
          <textarea readOnly value={SCHEMA_SQL} style={{ width:'100%', height:'280px', background:'#111', border:'1px solid #333', borderRadius:'8px', padding:'14px', color:'#888', fontSize:'11px', fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }} />
        </div>
        <div style={{ textAlign:'center', marginTop:'20px' }}>
          <a href="/login" style={{ color:'#C9A84C', textDecoration:'none', fontSize:'13px' }}>→ Already done? Go to login</a>
        </div>
      </div>
    </div>
  );
}
