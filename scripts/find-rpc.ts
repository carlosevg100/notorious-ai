import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

async function main() {
  // Try some common Supabase admin functions
  const functions = ['exec', 'execute', 'run_sql', 'admin_run', 'pg_execute']
  for (const fn of functions) {
    const { error } = await supabase.rpc(fn, { sql: 'SELECT 1' })
    if (!error || !error.message.includes('not found')) {
      console.log('Found RPC:', fn, error?.message || 'SUCCESS')
    }
  }
  
  // Try to call extensions
  const { data, error } = await supabase.rpc('pg_get_object_address', { classid: 0, objid: 0, objsubid: 0 }).catch(() => ({ data: null, error: null }))
  console.log('pg_get_object_address:', error?.message || data)
}

main()
