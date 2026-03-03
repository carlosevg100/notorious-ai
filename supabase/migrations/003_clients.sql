-- Migration 003: Clients table + link projects and contracts to clients

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id),
  name text not null,
  type text default 'pessoa_juridica', -- pessoa_fisica / pessoa_juridica
  document text, -- CPF or CNPJ
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_firm" ON public.clients FOR ALL USING (
  firm_id IN (SELECT firm_id FROM public.users WHERE id = auth.uid())
);

-- Add client_id to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Add client_id to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
