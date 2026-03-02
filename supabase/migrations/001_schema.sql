-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- firms
create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- users (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid references public.firms(id),
  email text,
  name text,
  role text default 'advogado',
  created_at timestamptz default now()
);

-- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  name text not null,
  area text not null,
  status text default 'ativo',
  risk_level text default 'baixo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  firm_id uuid references public.firms(id),
  name text not null,
  file_path text,
  file_type text,
  upload_status text default 'uploaded',
  ai_status text default 'pending',
  created_at timestamptz default now()
);

-- document_extractions
create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  doc_type text,
  parties jsonb,
  key_dates jsonb,
  deadlines jsonb,
  risk_flags jsonb,
  summary text,
  raw_extraction jsonb,
  created_at timestamptz default now()
);

-- chat_messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id),
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

-- ai_alerts
create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  project_id uuid references public.projects(id),
  document_id uuid references public.documents(id),
  type text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_alerts enable row level security;

-- Policies
create policy "firm_access" on public.firms for all using (
  id in (select firm_id from public.users where id = auth.uid())
);
create policy "user_self" on public.users for all using (id = auth.uid());
create policy "user_insert_self" on public.users for insert with check (id = auth.uid());
create policy "projects_firm" on public.projects for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);
create policy "documents_firm" on public.documents for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);
create policy "extractions_firm" on public.document_extractions for all using (
  document_id in (
    select d.id from public.documents d
    join public.users u on d.firm_id = u.firm_id
    where u.id = auth.uid()
  )
);
create policy "chat_firm" on public.chat_messages for all using (
  project_id in (
    select p.id from public.projects p
    join public.users u on p.firm_id = u.firm_id
    where u.id = auth.uid()
  )
);
create policy "alerts_firm" on public.ai_alerts for all using (
  firm_id in (select firm_id from public.users where id = auth.uid())
);

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "upload_docs" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid() is not null);
create policy "read_docs" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid() is not null);
create policy "delete_docs" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid() is not null);
