import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
);
const tables = ['firms','firm_users','clients','projects','documents','prazos','pecas','chat_messages'];
async function main() {
  const results = await Promise.all(tables.map(async t => {
    const r = await supabase.from(t).select('*').limit(1);
    return {table: t, ok: r.error == null, error: r.error?.message};
  }));
  results.forEach(r => console.log(r.ok ? 'OK' : 'MISS', r.table, r.error || ''));
}
main();
