-- litigancia_analyses
create table if not exists public.litigancia_analyses (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id) on delete cascade,
  advogado_nome text not null,
  advogado_oab text,
  advogado_estado text,
  result jsonb,
  created_at timestamptz default now()
);

alter table public.litigancia_analyses enable row level security;

create policy "litigancia_firm" on public.litigancia_analyses for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);

-- gratuidade_analyses
create table if not exists public.gratuidade_analyses (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id) on delete cascade,
  nome text not null,
  cpf text,
  result jsonb,
  created_at timestamptz default now()
);

alter table public.gratuidade_analyses enable row level security;

create policy "gratuidade_firm" on public.gratuidade_analyses for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);
