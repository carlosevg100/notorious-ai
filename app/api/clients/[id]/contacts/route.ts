import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
);

async function getFirmId(req: NextRequest) {
  const token = req.cookies.get('sb-access-token')?.value || req.headers.get('authorization')?.replace('Bearer ','');
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return null;
  const { data: u } = await supabase.from('users').select('firm_id').eq('id', data.user.id).single();
  return u?.firm_id || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firmId = await getFirmId(req);
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabase.from('client_contacts').select('*').eq('client_id', id).eq('firm_id', firmId).order('created_at');
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firmId = await getFirmId(req);
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabase.from('client_contacts').insert({ ...body, client_id: id, firm_id: firmId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
