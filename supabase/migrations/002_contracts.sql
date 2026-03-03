-- Gestao de Contratos — Migration 002

-- contracts
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  name text not null,
  contract_type text, -- Prestacao de Servicos / Locacao / Compra e Venda / Trabalhista / Societario / NDA / Financiamento / Franquia / Outros
  status text default 'rascunho', -- vigente / vencido / renovacao / rescindido / aguardando_assinatura / rascunho
  parties jsonb,
  value numeric,
  currency text default 'BRL',
  start_date date,
  end_date date,
  auto_renew boolean default false,
  renewal_notice_days int default 30,
  file_path text,
  file_type text,
  version int default 1,
  tags text[],
  notes text,
  responsible_lawyer text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- contract_extractions
create table if not exists public.contract_extractions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  summary text,
  key_obligations jsonb,
  penalties jsonb,
  termination_clauses jsonb,
  confidentiality boolean,
  non_compete boolean,
  governing_law text,
  dispute_resolution text,
  risk_level text,
  risk_flags jsonb,
  fraud_risk jsonb,
  raw_extraction jsonb,
  created_at timestamptz default now()
);

-- contract_alerts
create table if not exists public.contract_alerts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  contract_id uuid references public.contracts(id) on delete cascade,
  type text,
  message text,
  alert_date date,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- contract_versions
create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  version int,
  file_path text,
  uploaded_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table public.contracts enable row level security;
alter table public.contract_extractions enable row level security;
alter table public.contract_alerts enable row level security;
alter table public.contract_versions enable row level security;

-- Policies
create policy "contracts_firm" on public.contracts for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);

create policy "contract_extractions_firm" on public.contract_extractions for all using (
  contract_id in (
    select c.id from public.contracts c
    join public.users u on c.firm_id = u.firm_id
    where u.id = auth.uid()
  )
);

create policy "contract_alerts_firm" on public.contract_alerts for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);

create policy "contract_versions_firm" on public.contract_versions for all using (
  contract_id in (
    select c.id from public.contracts c
    join public.users u on c.firm_id = u.firm_id
    where u.id = auth.uid()
  )
);
