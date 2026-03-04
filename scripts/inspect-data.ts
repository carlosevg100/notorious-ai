import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fbgqzouxbagmmlzibyhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3F6b3V4YmFnbW1semlieWhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjE1MSwiZXhwIjoyMDg4MDUyMTUxfQ.p_SD9mQxanP0VHQqpm0NCqbRiuHk1MPGr-1dAAZqp2s'
)

const FIRM_ID = '1f430c10-550a-4267-9193-e03c831fc394'

async function main() {
  const { data: clients } = await supabase.from('clients').select('*').eq('firm_id', FIRM_ID).limit(3)
  console.log('CLIENTS:', JSON.stringify(clients?.slice(0,2), null, 2))
  
  const { data: projects } = await supabase.from('projects').select('*').eq('firm_id', FIRM_ID).limit(3)
  console.log('\nPROJECTS:', JSON.stringify(projects?.slice(0,2), null, 2))
  
  const { data: docs } = await supabase.from('documents').select('*').eq('firm_id', FIRM_ID).limit(2)
  console.log('\nDOCUMENTS:', JSON.stringify(docs?.slice(0,1), null, 2))
}

main()
